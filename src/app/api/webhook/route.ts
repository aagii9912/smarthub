import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendSenderAction } from '@/lib/facebook/messenger';
import { generateChatResponse } from '@/lib/ai/gemini';
import { detectIntent } from '@/lib/ai/intent-detector';
import { supabaseAdmin } from '@/lib/supabase';
import { Content } from '@google/generative-ai';
import { logger } from '@/lib/utils/logger';

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

            // Get shop info from database with access token
            const { data: shop } = await supabase
                .from('shops')
                .select('*, products(*)')
                .eq('facebook_page_id', pageId)
                .eq('is_active', true)
                .single();

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
                        const { data: newCustomer } = await supabase
                            .from('customers')
                            .insert({
                                shop_id: shop.id,
                                facebook_id: senderId,
                            })
                            .select()
                            .single();
                        customer = newCustomer;
                    } else {
                        customer = existingCustomer;
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

                        const previousHistory: Content[] = [];
                        if (historyData) {
                            historyData.reverse().forEach(h => {
                                if (h.message) {
                                    previousHistory.push({
                                        role: 'user',
                                        parts: [{ text: h.message }]
                                    });
                                }
                                if (h.response) {
                                    previousHistory.push({
                                        role: 'model',
                                        parts: [{ text: h.response }]
                                    });
                                }
                            });
                        }

                        // Generate response AND wait for a minimum delay (1.5s) to show "typing..."
                        const [response] = await Promise.all([
                            generateChatResponse(
                                userMessage,
                                {
                                    shopName: shop.name,
                                    products: shop.products || [],
                                    customerName: customer?.name || undefined,
                                    orderHistory: customer?.total_orders || 0,
                                },
                                previousHistory
                            ),
                            new Promise(resolve => setTimeout(resolve, 1500))
                        ]);

                        aiResponse = response;
                        logger.success('AI response generated', { preview: aiResponse.substring(0, 100) + '...' });
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

                    // Check for order intent and create order
                    if (intent.intent === 'ORDER_CREATE' && customer) {
                        // Extract product from message if possible
                        const product = shop.products?.find((p: any) =>
                            userMessage.toLowerCase().includes(p.name.toLowerCase())
                        );

                        if (product) {
                            // Create order
                            const { data: order } = await supabase
                                .from('orders')
                                .insert({
                                    shop_id: shop.id,
                                    customer_id: customer.id,
                                    status: 'pending',
                                    total_amount: product.price,
                                    notes: `Messenger-ээр захиалсан: ${userMessage}`
                                })
                                .select()
                                .single();

                            if (order) {
                                // Add order item
                                await supabase.from('order_items').insert({
                                    order_id: order.id,
                                    product_id: product.id,
                                    quantity: 1,
                                    unit_price: product.price
                                });

                                aiResponse = `🎉 "${product.name}" захиалга амжилттай бүртгэгдлээ!\n\nҮнэ: ${Number(product.price).toLocaleString()}₮\n\nХүргэлтийн хаягаа мессежээр илгээнэ үү! 📦`;
                            }
                        }
                    }

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
