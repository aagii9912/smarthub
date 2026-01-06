import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage } from '@/lib/facebook/messenger';
import { generateChatResponse } from '@/lib/ai/gemini';
import { detectIntent } from '@/lib/ai/intent-detector';
import { supabase } from '@/lib/supabase';

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'smarthub_verify_token_2024';
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '';

// Verify webhook (GET request from Facebook)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const result = verifyWebhook(mode, token, challenge, VERIFY_TOKEN);

    if (result) {
        console.log('Webhook verified successfully');
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
        for (const entry of body.entry) {
            const pageId = entry.id;

            // Get shop info from database
            const { data: shop } = await supabase
                .from('shops')
                .select('*, products(*)')
                .eq('facebook_page_id', pageId)
                .single();

            // Fallback хэрэв shop олдохгүй бол
            const shopData = shop || {
                id: 'demo',
                name: 'Demo Shop',
                facebook_page_id: pageId,
                products: [
                    { id: '1', name: 'iPhone 15 Pro', price: 4500000, stock: 10, description: 'Latest iPhone' },
                    { id: '2', name: 'MacBook Air M3', price: 3800000, stock: 5, description: 'Powerful laptop' },
                    { id: '3', name: 'AirPods Pro 2', price: 850000, stock: 20, description: 'Premium earbuds' }
                ]
            };

            if (!shop) {
                console.log(`⚠️ No shop found for page ${pageId}, using demo data`);
            }

            // Process messaging events
            for (const event of entry.messaging || []) {
                const senderId = event.sender.id;

                // Handle text messages
                if (event.message?.text) {
                    const userMessage = event.message.text;
                    console.log('📩 Received message:', userMessage, 'from:', senderId);

                    // Detect intent
                    const intent = detectIntent(userMessage);
                    console.log(`Intent: ${intent.intent}, Confidence: ${intent.confidence}`);

                    // Get or create customer (skip if demo shop)
                    let customer = null;
                    if (shop) {
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
                    }

                    // Generate AI response with fallback
                    let aiResponse: string;
                    try {
                        console.log('🤖 Generating AI response...');
                        console.log('📦 Shop data:', {
                            shopName: shopData.name,
                            productsCount: shopData.products?.length || 0,
                            products: shopData.products || []
                        });
                        console.log('👤 Customer data:', {
                            customerName: customer?.name,
                            orderHistory: customer?.total_orders
                        });

                        aiResponse = await generateChatResponse(userMessage, {
                            shopName: shopData.name,
                            products: shopData.products || [],
                            customerName: customer?.name || undefined,
                            orderHistory: customer?.total_orders || 0,
                        });
                        console.log('✅ AI response generated:', aiResponse.substring(0, 100) + '...');
                    } catch (aiError: any) {
                        console.error('❌ AI Error (Full):', {
                            message: aiError?.message,
                            stack: aiError?.stack,
                            name: aiError?.name,
                            response: aiError?.response?.data,
                            error: aiError
                        });
                        
                        // Fallback хариулт (AI ажиллахгүй үед)
                        const msg = userMessage.toLowerCase();
                        if (msg.includes('сайн') || msg.includes('hello') || msg.includes('hi')) {
                            aiResponse = 'Сайн байна уу! 😊 Танд яаж туслах вэ?';
                        } else if (msg.includes('бараа') || msg.includes('бүтээгдэхүүн') || msg.includes('юу байна')) {
                            aiResponse = 'Манайд iPhone 15 Pro (4,500,000₮), MacBook Air M3 (3,800,000₮), AirPods Pro 2 (850,000₮) байна! Аль нь сонирхож байна вэ? 😊';
                        } else if (msg.includes('үнэ') || msg.includes('хэд')) {
                            aiResponse = 'Үнэ асууж байна уу? Ямар бүтээгдэхүүний үнийг мэдэхийг хүсч байна вэ? iPhone, MacBook эсвэл AirPods?';
                        } else if (msg.includes('баярлалаа') || msg.includes('thank')) {
                            aiResponse = 'Баярлалаа! Дахиад ирээрэй 😊';
                        } else {
                            aiResponse = `Сайн байна уу! 😊 Танд яаж туслах вэ? Бидэнд ${shopData.name} дэлгүүрийн мэдээлэл байна!`;
                        }
                    }

                    // Save chat history (skip if demo shop)
                    if (shop && customer) {
                        await supabase.from('chat_history').insert({
                            shop_id: shop.id,
                            customer_id: customer?.id,
                            message: userMessage,
                            response: aiResponse,
                        });
                    }

                    // Send response to Facebook
                    try {
                        console.log('📤 Sending to FB:', aiResponse.substring(0, 50) + '...');
                        await sendTextMessage({
                            recipientId: senderId,
                            message: aiResponse,
                            pageAccessToken: PAGE_ACCESS_TOKEN,
                        });
                        console.log('✅ Message sent to FB successfully!');
                    } catch (sendError) {
                        console.error('❌ Failed to send message to FB:', sendError);
                        // Continue execution
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
                            pageAccessToken: PAGE_ACCESS_TOKEN,
                        });
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
