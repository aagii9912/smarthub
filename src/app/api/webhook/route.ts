import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendSenderAction, sendImage, sendImageGallery } from '@/lib/facebook/messenger';
import { generateChatResponse, ChatResponse, ImageAction } from '@/lib/ai/openai';
import { detectIntent } from '@/lib/ai/intent-detector';
import { shouldReplyToComment, generateCommentReply } from '@/lib/ai/comment-detector';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'smarthub_verify_token_2024';

// Verify webhook (GET request from Facebook)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const result = verifyWebhook(mode, token, challenge, VERIFY_TOKEN);

    if (result) {
        logger.info('Webhook verified successfully');
        return new NextResponse(result, { status: 200 });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Handle incoming messages (POST request from Facebook)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const supabase = supabaseAdmin();

        // Check if this is a page event
        if (body.object !== 'page') {
            return NextResponse.json({ error: 'Invalid object type' }, { status: 400 });
        }

        // Process each entry
        for (const entry of body.entry) {
            const pageId = entry.id;

            // Get shop info from database with access token and AI features
            const { data: shop } = await supabase
                .from('shops')
                .select('*, products(*)')
                .eq('facebook_page_id', pageId)
                .eq('is_active', true)
                .single();

            // Fetch AI features separately for the shop
            let shopFaqs: any[] = [];
            let shopQuickReplies: any[] = [];
            let shopSlogans: any[] = [];

            if (shop) {
                const [faqRes, qrRes, sloganRes] = await Promise.all([
                    supabase.from('shop_faqs').select('question, answer').eq('shop_id', shop.id).eq('is_active', true),
                    supabase.from('shop_quick_replies').select('trigger_words, response, is_exact_match').eq('shop_id', shop.id).eq('is_active', true),
                    supabase.from('shop_slogans').select('slogan, usage_context').eq('shop_id', shop.id).eq('is_active', true)
                ]);
                shopFaqs = faqRes.data || [];
                shopQuickReplies = qrRes.data || [];
                shopSlogans = sloganRes.data || [];
            }

            if (!shop) {
                logger.warn(`No active shop found for page ${pageId}`);
                continue;
            }

            // Get page access token from shop
            const pageAccessToken = shop.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

            if (!pageAccessToken) {
                logger.warn(`No access token for shop ${shop.name}`);
                continue;
            }

            // Process Facebook Page feed events (comments)
            for (const change of entry.changes || []) {
                if (change.field === 'feed' && change.value?.item === 'comment') {
                    const commentData = change.value;
                    const commentMessage = commentData.message;
                    const commentId = commentData.comment_id;
                    const postId = commentData.post_id;
                    const senderId = commentData.from?.id;
                    const senderName = commentData.from?.name;

                    // Don't reply to own comments (from page)
                    if (senderId === pageId) continue;

                    logger.info(`[${shop.name}] New comment received`, {
                        commentMessage,
                        senderName,
                        postId
                    });

                    // Check if comment is product-related
                    if (shouldReplyToComment(commentMessage)) {
                        logger.info(`[${shop.name}] Comment is product-related, replying...`);

                        // Generate reply
                        const replyMessage = generateCommentReply(
                            shop.name,
                            shop.facebook_page_username
                        );

                        // Reply to comment via Facebook Graph API
                        try {
                            const response = await fetch(
                                `https://graph.facebook.com/v18.0/${commentId}/comments`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        message: replyMessage,
                                        access_token: pageAccessToken,
                                    }),
                                }
                            );

                            if (response.ok) {
                                logger.success(`[${shop.name}] Comment reply sent successfully!`);

                                // Log the reply
                                await supabase.from('chat_history').insert({
                                    shop_id: shop.id,
                                    message: `[FB Comment] ${commentMessage}`,
                                    response: replyMessage,
                                    intent: 'COMMENT_REPLY'
                                });
                            } else {
                                const errorData = await response.json();
                                logger.error(`[${shop.name}] Failed to reply to comment`, errorData);
                            }
                        } catch (replyError: any) {
                            logger.error(`[${shop.name}] Error replying to comment`, {
                                error: replyError?.message
                            });
                        }
                    } else {
                        logger.debug(`[${shop.name}] Comment not product-related, skipping`);
                    }
                }
            }

            // Process messaging events
            for (const event of entry.messaging || []) {
                const senderId = event.sender.id;

                // Handle text messages
                if (event.message?.text) {
                    const userMessage = event.message.text;
                    logger.info(`[${shop.name}] Received message`, { userMessage, senderId });

                    // 1. Mark Seen (Safe call)
                    await sendSenderAction(senderId, 'mark_seen', pageAccessToken);

                    // 2. Typing On (Safe call)
                    await sendSenderAction(senderId, 'typing_on', pageAccessToken);

                    // Detect intent
                    const intent = detectIntent(userMessage);
                    logger.debug('Intent detected', { intent: intent.intent, confidence: intent.confidence });

                    // Get or create customer
                    let customer = null;
                    const { data: existingCustomer } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('facebook_id', senderId)
                        .eq('shop_id', shop.id)
                        .single();

                    if (!existingCustomer) {
                        // Try to get user profile from Facebook
                        let userName = null;
                        try {
                            const profileResponse = await fetch(
                                `https://graph.facebook.com/${senderId}?fields=first_name,last_name,name&access_token=${pageAccessToken}`
                            );
                            if (profileResponse.ok) {
                                const profileData = await profileResponse.json();
                                userName = profileData.name || profileData.first_name || null;
                                logger.info('Fetched Facebook profile', { userName, senderId });
                            }
                        } catch (profileError) {
                            logger.warn('Could not fetch Facebook profile', { senderId });
                        }

                        const { data: newCustomer } = await supabase
                            .from('customers')
                            .insert({
                                shop_id: shop.id,
                                facebook_id: senderId,
                                name: userName,
                            })
                            .select()
                            .single();
                        customer = newCustomer;
                    } else {
                        customer = existingCustomer;

                        // Try to extract phone number from message if not already saved
                        if (!customer.phone) {
                            const phoneMatch = userMessage.match(/(\d{8})/);
                            if (phoneMatch) {
                                await supabase
                                    .from('customers')
                                    .update({ phone: phoneMatch[1] })
                                    .eq('id', customer.id);
                                customer.phone = phoneMatch[1];
                                logger.info('Phone extracted from message', { phone: phoneMatch[1] });
                            }
                        }

                        // Update name from Facebook if still null
                        if (!customer.name) {
                            try {
                                const profileResponse = await fetch(
                                    `https://graph.facebook.com/${senderId}?fields=first_name,last_name,name&access_token=${pageAccessToken}`
                                );
                                if (profileResponse.ok) {
                                    const profileData = await profileResponse.json();
                                    const userName = profileData.name || profileData.first_name || null;
                                    if (userName) {
                                        await supabase
                                            .from('customers')
                                            .update({ name: userName })
                                            .eq('id', customer.id);
                                        customer.name = userName;
                                        logger.info('Updated customer name from Facebook', { userName });
                                    }
                                }
                            } catch (profileError) {
                                // Ignore profile fetch errors
                            }
                        }
                    }

                    // Generate AI response with fallback
                    let aiResponse: string;
                    try {
                        logger.info(`[${shop.name}] Generating AI response...`);
                        logger.debug('Products count:', { count: shop.products?.length || 0 });

                        // 1. Get Chat History
                        const { data: historyData } = await supabase
                            .from('chat_history')
                            .select('message, response')
                            .eq('shop_id', shop.id)
                            .eq('customer_id', customer.id)
                            .order('created_at', { ascending: false })
                            .limit(5);

                        const previousHistory: ChatMessage[] = [];
                        if (historyData) {
                            historyData.reverse().forEach(h => {
                                if (h.message) {
                                    previousHistory.push({
                                        role: 'user',
                                        content: h.message
                                    });
                                }
                                if (h.response) {
                                    previousHistory.push({
                                        role: 'assistant',
                                        content: h.response
                                    });
                                }
                            });
                        }


                        // Log AI context for debugging
                        logger.debug('AI Context:', {
                            shopName: shop.name,
                            hasDescription: !!shop.description,
                            hasAiInstructions: !!shop.ai_instructions,
                            aiInstructionsPreview: shop.ai_instructions?.substring(0, 50),
                            productsCount: shop.products?.length || 0,
                            historyLength: previousHistory.length
                        });

                        // Generate response AND wait for a minimum delay (1.5s) to show "typing..."
                        const [response] = await Promise.all([
                            generateChatResponse(
                                userMessage,
                                {
                                    shopId: shop.id,
                                    customerId: customer?.id,
                                    shopName: shop.name,
                                    shopDescription: shop.description || undefined,
                                    aiInstructions: shop.ai_instructions || undefined,
                                    aiEmotion: shop.ai_emotion || 'friendly',
                                    products: shop.products || [],
                                    customerName: customer?.name || undefined,
                                    orderHistory: customer?.total_orders || 0,
                                    // AI Features
                                    faqs: shopFaqs,
                                    quickReplies: shopQuickReplies,
                                    slogans: shopSlogans,
                                    notifySettings: {
                                        order: shop.notify_on_order ?? true,
                                        contact: shop.notify_on_contact ?? true,
                                        support: shop.notify_on_support ?? true,
                                        cancel: shop.notify_on_cancel ?? true,
                                    }
                                },
                                previousHistory
                            ),
                            new Promise(resolve => setTimeout(resolve, 1500))
                        ]);

                        aiResponse = response.text;
                        const imageAction = response.imageAction;
                        logger.success('AI response generated', { preview: aiResponse.substring(0, 100) + '...', hasImage: !!imageAction });

                        // Send product images if AI requested
                        if (imageAction && imageAction.products.length > 0) {
                            try {
                                if (imageAction.products.length === 1 && imageAction.type === 'single') {
                                    // Send single image
                                    await sendImage({
                                        recipientId: senderId,
                                        imageUrl: imageAction.products[0].imageUrl,
                                        pageAccessToken: pageAccessToken,
                                    });
                                } else {
                                    // Send gallery carousel
                                    await sendImageGallery({
                                        recipientId: senderId,
                                        products: imageAction.products,
                                        pageAccessToken: pageAccessToken,
                                        confirmMode: imageAction.type === 'confirm',
                                    });
                                }
                                logger.success(`Sent ${imageAction.products.length} product image(s) in ${imageAction.type} mode`);
                            } catch (imgError: any) {
                                logger.error('Failed to send product images:', { message: imgError?.message });
                            }
                        }
                    } catch (aiError: any) {
                        logger.error('AI Error:', {
                            message: aiError?.message,
                            stack: aiError?.stack,
                            name: aiError?.name
                        });

                        // Intent detector ашиглан fallback хариулт үүсгэх
                        const productList = shop.products?.slice(0, 3).map((p: any) =>
                            `${p.name} (${Number(p.price).toLocaleString()}₮)`
                        ).join(', ');

                        switch (intent.intent) {
                            case 'GREETING':
                                aiResponse = `Сайн байна уу! 😊 ${shop.name}-д тавтай морил! Танд яаж туслах вэ?`;
                                break;
                            case 'PRODUCT_INQUIRY':
                            case 'STOCK_CHECK':
                                aiResponse = productList
                                    ? `Манайд ${productList} зэрэг бүтээгдэхүүн байна! 😊 Аль нь сонирхож байна вэ?`
                                    : 'Бүтээгдэхүүний мэдээлэл удахгүй орно!';
                                break;
                            case 'PRICE_CHECK':
                                aiResponse = 'Ямар бүтээгдэхүүний үнийг мэдэхийг хүсч байна вэ? 💰';
                                break;
                            case 'ORDER_CREATE':
                                aiResponse = 'Захиалга өгөхийг хүсвэл бүтээгдэхүүний нэр, тоо ширхэг, утасны дугаар, хаягаа бичнэ үү! 📦';
                                break;
                            case 'ORDER_STATUS':
                                aiResponse = 'Захиалгын дугаараа хэлнэ үү, би шалгаад хэлье! 🔍';
                                break;
                            case 'THANK_YOU':
                                aiResponse = 'Баярлалаа! Дахиад ирээрэй 😊';
                                break;
                            case 'COMPLAINT':
                                aiResponse = 'Уучлаарай, танд тохиромжгүй байдал үүссэнд харамсаж байна. Асуудлаа дэлгэрэнгүй хэлнэ үү, бид шийдвэрлэхийг хичээнэ! 🙏';
                                break;
                            default:
                                aiResponse = `Уучлаарай, одоо системд түр алдаа гарлаа. Удахгүй хариулах болно! 🙏`;
                        }
                    }

                    // 3. Typing Off (Safe call)
                    await sendSenderAction(senderId, 'typing_off', pageAccessToken);

                    // Note: Order creation is now handled by AI Tools (create_order) in openai.ts

                    // Save chat history
                    await supabase.from('chat_history').insert({
                        shop_id: shop.id,
                        customer_id: customer?.id,
                        message: userMessage,
                        response: aiResponse,
                        intent: intent.intent
                    });

                    // Send response to Facebook
                    try {
                        logger.info(`[${shop.name}] Sending response...`);
                        await sendTextMessage({
                            recipientId: senderId,
                            message: aiResponse,
                            pageAccessToken: pageAccessToken,
                        });
                        logger.success('Message sent successfully!');
                    } catch (sendError: any) {
                        logger.error('Failed to send message:', { message: sendError?.message });
                    }
                }

                // Handle postback (button clicks)
                if (event.postback?.payload) {
                    const payload = event.postback.payload;

                    if (payload.startsWith('ORDER_')) {
                        const productName = payload.replace('ORDER_', '');
                        await sendTextMessage({
                            recipientId: senderId,
                            message: `"${productName}" захиалахыг хүсч байна уу? Хэдэн ширхэг авах вэ? 🛒`,
                            pageAccessToken: pageAccessToken,
                        });
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        logger.error('Webhook error:', { error });
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
