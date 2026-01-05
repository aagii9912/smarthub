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

            if (!shop) {
                console.log(`No shop found for page ${pageId}`);
                continue;
            }

            // Process messaging events
            for (const event of entry.messaging || []) {
                const senderId = event.sender.id;

                // Handle text messages
                if (event.message?.text) {
                    const userMessage = event.message.text;

                    // Detect intent
                    const intent = detectIntent(userMessage);
                    console.log(`Intent: ${intent.intent}, Confidence: ${intent.confidence}`);

                    // Get or create customer
                    let { data: customer } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('facebook_id', senderId)
                        .eq('shop_id', shop.id)
                        .single();

                    if (!customer) {
                        const { data: newCustomer } = await supabase
                            .from('customers')
                            .insert({
                                shop_id: shop.id,
                                facebook_id: senderId,
                            })
                            .select()
                            .single();
                        customer = newCustomer;
                    }

                    // Generate AI response
                    const aiResponse = await generateChatResponse(userMessage, {
                        shopName: shop.name,
                        products: shop.products || [],
                        customerName: customer?.name || undefined,
                        orderHistory: customer?.total_orders || 0,
                    });

                    // Save chat history
                    await supabase.from('chat_history').insert({
                        shop_id: shop.id,
                        customer_id: customer?.id,
                        message: userMessage,
                        response: aiResponse,
                    });

                    // Send response
                    // Send response
                    try {
                        console.log('Sending response to FB:', aiResponse);
                        await sendTextMessage({
                            recipientId: senderId,
                            message: aiResponse,
                            pageAccessToken: PAGE_ACCESS_TOKEN,
                        });
                        console.log('Message sent successfully');
                    } catch (sendError) {
                        console.error('Failed to send message to FB:', sendError);
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
