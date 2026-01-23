import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendSenderAction } from '@/lib/facebook/messenger';
import { routeToAI, analyzeProductImageWithPlan, getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { detectIntent } from '@/lib/ai/intent-detector';
import { shouldReplyToComment } from '@/lib/ai/comment-detector';
import { getCustomerMemory } from '@/lib/ai/tools/memory';
import { logger } from '@/lib/utils/logger';
import {
    getShopByPageId,
    getAIFeatures,
    getOrCreateCustomer,
    updateCustomerInfo,
    getChatHistory,
    saveChatHistory,
    incrementMessageCount,
    buildNotifySettings,
    generateFallbackResponse,
    processAIResponse,
    replyToComment,
} from '@/lib/webhook/WebhookService';
import type { ChatMessage } from '@/types/ai';

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'smarthub_verify_token_2024';

/**
 * Facebook webhook entry type
 */
interface WebhookEntry {
    id: string;
    changes?: Array<{
        field: string;
        value?: {
            item?: string;
            message?: string;
            comment_id?: string;
            post_id?: string;
            from?: { id: string; name?: string };
        };
    }>;
    messaging?: Array<{
        sender: { id: string };
        message?: {
            text?: string;
            attachments?: Array<{
                type: string;
                payload?: { url?: string };
            }>;
        };
        postback?: { payload?: string };
    }>;
}

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

        // Check if this is a page event
        if (body.object !== 'page') {
            return NextResponse.json({ error: 'Invalid object type' }, { status: 400 });
        }

        // Process each entry
        for (const entry of body.entry as WebhookEntry[]) {
            const pageId = entry.id;

            // Get shop info from database
            const shop = await getShopByPageId(pageId);
            if (!shop) {
                logger.warn(`No active shop found for page ${pageId}`);
                continue;
            }

            // Get AI features for this shop
            const aiFeatures = await getAIFeatures(shop.id);

            // Get page access token
            const pageAccessToken = shop.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
            if (!pageAccessToken) {
                logger.warn(`No access token for shop ${shop.name}`);
                continue;
            }

            // Process Facebook Page feed events (comments)
            for (const change of entry.changes || []) {
                if (change.field === 'feed' && change.value?.item === 'comment') {
                    const commentData = change.value;
                    const commentMessage = commentData.message || '';
                    const commentId = commentData.comment_id;
                    const senderId = commentData.from?.id;

                    // Don't reply to own comments (from page)
                    if (senderId === pageId || !commentId) continue;

                    logger.info(`[${shop.name}] New comment received`, {
                        commentMessage,
                        senderName: commentData.from?.name
                    });

                    // Check if comment is product-related and reply
                    if (shouldReplyToComment(commentMessage)) {
                        logger.info(`[${shop.name}] Comment is product-related, replying...`);
                        await replyToComment(
                            shop.id,
                            shop.name,
                            shop.facebook_page_username,
                            commentId,
                            commentMessage,
                            pageAccessToken
                        );
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

                    // Mark Seen & Typing indicators
                    await sendSenderAction(senderId, 'mark_seen', pageAccessToken);
                    await sendSenderAction(senderId, 'typing_on', pageAccessToken);

                    // Detect intent
                    const intent = detectIntent(userMessage);
                    logger.debug('Intent detected', { intent: intent.intent, confidence: intent.confidence });

                    // Get or create customer
                    let customer = await getOrCreateCustomer(shop.id, senderId, pageAccessToken);

                    // Update customer info if needed
                    customer = await updateCustomerInfo(customer, senderId, pageAccessToken, userMessage);

                    // CHECK: Global AI Switch
                    if (shop.is_ai_active === false) {
                        logger.info(`[${shop.name}] AI is globally disabled. Skipping response.`);
                        continue;
                    }

                    // CHECK: Admin Takeover (AI Paused)
                    if (customer.ai_paused_until && new Date(customer.ai_paused_until) > new Date()) {
                        logger.info(`[${shop.name}] AI paused for customer ${customer.id} until ${customer.ai_paused_until}. Skipping.`);
                        continue;
                    }

                    // Generate AI response
                    let aiResponse: string;
                    let aiQuickReplies: Array<{ title: string; payload: string }> | undefined;
                    try {
                        logger.info(`[${shop.name}] Generating AI response...`);

                        // Get chat history for context
                        const previousHistory: ChatMessage[] = await getChatHistory(shop.id, customer.id);

                        // Map products to ensure null values are converted to undefined
                        const mappedProducts = shop.products.map(p => ({
                            ...p,
                            discount_percent: p.discount_percent ?? undefined,
                        }));

                        // Get customer memory (preferences saved by AI)
                        const customerMemory = customer.id
                            ? await getCustomerMemory(customer.id)
                            : undefined;

                        // Generate response with minimum delay for typing animation
                        const [response] = await Promise.all([
                            routeToAI(
                                userMessage,
                                {
                                    shopId: shop.id,
                                    customerId: customer.id,
                                    shopName: shop.name,
                                    shopDescription: shop.description || undefined,
                                    aiInstructions: shop.ai_instructions || undefined,
                                    aiEmotion: shop.ai_emotion || 'friendly',
                                    products: mappedProducts,
                                    customerName: customer.name || undefined,
                                    orderHistory: customer.total_orders || 0,
                                    faqs: aiFeatures.faqs,
                                    quickReplies: aiFeatures.quickReplies,
                                    slogans: aiFeatures.slogans,
                                    notifySettings: buildNotifySettings(shop),
                                    customerMemory: customerMemory || undefined,
                                    // Add subscription for plan-based AI routing
                                    subscription: {
                                        plan: shop.subscription_plan || 'starter',
                                        status: shop.subscription_status || 'active',
                                        trial_ends_at: shop.trial_ends_at || undefined,
                                    },
                                    messageCount: customer.message_count || 0,
                                },
                                previousHistory
                            ),
                            new Promise(resolve => setTimeout(resolve, 1500))
                        ]);


                        aiResponse = response.text;
                        aiQuickReplies = response.quickReplies;
                        logger.success('AI response generated', {
                            preview: aiResponse.substring(0, 100) + '...',
                            hasImage: !!response.imageAction,
                            hasQuickReplies: !!aiQuickReplies
                        });

                        // Process and send product images if AI requested
                        await processAIResponse(response, senderId, pageAccessToken);

                    } catch (aiError) {
                        const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
                        const errorStack = aiError instanceof Error ? aiError.stack : undefined;
                        logger.error('AI Error:', { message: errorMessage, stack: errorStack });

                        // Generate fallback response based on intent
                        aiResponse = generateFallbackResponse(intent, shop.name, shop.products);
                    }

                    // Typing Off
                    await sendSenderAction(senderId, 'typing_off', pageAccessToken);

                    // Save chat history and increment message count
                    await saveChatHistory(shop.id, customer.id, userMessage, aiResponse, intent.intent);

                    // Increment message count for plan-based limiting
                    if (customer.id) {
                        const newCount = await incrementMessageCount(customer.id);
                        logger.info(`Message count for customer ${customer.id}: ${newCount}`);
                    }

                    // Send response to Facebook (with or without quick replies)
                    try {
                        logger.info(`[${shop.name}] Sending response...`);

                        // Check if we have quick replies from AI
                        if (aiQuickReplies && aiQuickReplies.length > 0) {
                            const { sendMessageWithQuickReplies } = await import('@/lib/facebook/messenger');
                            await sendMessageWithQuickReplies({
                                recipientId: senderId,
                                message: aiResponse,
                                quickReplies: aiQuickReplies.map((qr: { title: string; payload: string }) => ({
                                    content_type: 'text' as const,
                                    title: qr.title.substring(0, 20), // Max 20 chars
                                    payload: qr.payload
                                })),
                                pageAccessToken,
                            });
                            logger.success('Message with quick replies sent!');
                        } else {
                            await sendTextMessage({
                                recipientId: senderId,
                                message: aiResponse,
                                pageAccessToken,
                            });
                            logger.success('Message sent successfully!');
                        }
                    } catch (sendError) {
                        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
                        logger.error('Failed to send message:', { message: errorMessage });
                    }
                }

                // Handle image attachments
                // Handle image attachments
                const attachments = event.message?.attachments;
                if (attachments && attachments.length > 0) {
                    const imageAttachment = attachments.find(a => a.type === 'image');
                    if (imageAttachment?.payload?.url) {
                        const imageUrl = imageAttachment.payload.url;
                        logger.info(`[${shop.name}] Received image attachment`, { imageUrl });

                        await sendSenderAction(senderId, 'mark_seen', pageAccessToken);
                        await sendSenderAction(senderId, 'typing_on', pageAccessToken);

                        try {
                            // Analyze image with Vision API (plan-based)
                            const planType = getPlanTypeFromSubscription({
                                plan: (shop as unknown as Record<string, string>).subscription_plan,
                                status: (shop as unknown as Record<string, string>).subscription_status,
                            });
                            const analysis = await analyzeProductImageWithPlan(imageUrl, shop.products, planType);
                            logger.info('Image analysis result:', analysis);

                            let responseMessage: string;
                            if (analysis.isReceipt) {
                                responseMessage = `💰 Төлбөрийн баримтыг хүлээж авлаа! Баярлалаа. \n\nАдмин шалгаад удахгүй баталгаажуулах болно. Түр хүлээнэ үү. 🙏`;
                                // TODO: Notify Admin here (future improvement)
                            } else if (analysis.matchedProduct && analysis.confidence > 0.6) {
                                const product = shop.products.find(p => p.name === analysis.matchedProduct);
                                if (product) {
                                    const price = product.discount_percent
                                        ? Math.round(product.price * (1 - product.discount_percent / 100))
                                        : product.price;
                                    responseMessage = `🎯 Таны зураг дээр "${product.name}" харагдаж байна!\n\n💰 Үнэ: ${price.toLocaleString()}₮\n📦 Үлдэгдэл: ${product.stock} ширхэг\n\nЗахиалах уу? 😊`;
                                } else {
                                    responseMessage = `Зураг дээр ${analysis.description}. Таны хайсан бүтээгдэхүүн манайд байж магадгүй, нэрийг нь хэлнэ үү?`;
                                }
                            } else {
                                responseMessage = `Зураг дээр ${analysis.description}. Аль бүтээгдэхүүнийг хайж байгаагаа хэлнэ үү? 🤔`;
                            }

                            await sendSenderAction(senderId, 'typing_off', pageAccessToken);
                            await sendTextMessage({
                                recipientId: senderId,
                                message: responseMessage,
                                pageAccessToken,
                            });
                        } catch (imageError) {
                            logger.error('Image analysis error:', { error: imageError });
                            await sendTextMessage({
                                recipientId: senderId,
                                message: 'Зургийг таньж чадсангүй. Бүтээгдэхүүний нэрийг бичиж өгнө үү! 📝',
                                pageAccessToken,
                            });
                        }
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
                            pageAccessToken,
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
