import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendMessageWithQuickReplies, sendCarousel, CarouselElement } from '@/lib/facebook/messenger';
import { generateChatResponse, RichChatResponse, analyzeProductImage } from '@/lib/ai/gemini';
import { detectIntent } from '@/lib/ai/intent-detector';
import { supabaseAdmin } from '@/lib/supabase';

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'smarthub_verify_token_2024';

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
                .select('*, products(*, product_variants(*))')
                .eq('facebook_page_id', pageId)
                .eq('is_active', true)
                .single();

            if (!shop) {
                console.log(`⚠️ No active shop found for page ${pageId}`);
                continue;
            }

            // Get page access token from shop
            const pageAccessToken = shop.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
            
            if (!pageAccessToken) {
                console.log(`⚠️ No access token for shop ${shop.name}`);
                continue;
            }

            // Process messaging events
            for (const event of entry.messaging || []) {
                const senderId = event.sender.id;

                // 1. Handle attachments (Images)
                if (event.message?.attachments) {
                    for (const attachment of event.message.attachments) {
                        if (attachment.type === 'image') {
                            const imageUrl = attachment.payload.url;
                            console.log(`🖼️ [${shop.name}] Image received from ${senderId}:`, imageUrl);

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
                                    .insert({ shop_id: shop.id, facebook_id: senderId })
                                    .select().single();
                                customer = newCustomer;
                            } else {
                                customer = existingCustomer;
                            }

                            let aiResponse: string;
                            try {
                                const analysis = await analyzeProductImage(imageUrl, shop.products || []);
                                
                                if (analysis.matchedProduct && analysis.confidence > 0.6) {
                                    const product = shop.products?.find((p: any) => 
                                        p.name.toLowerCase() === analysis.matchedProduct?.toLowerCase()
                                    );

                                    if (product) {
                                        const variants = product.product_variants || [];
                                        const available = variants.filter((v: any) => v.stock > 0);
                                        const outOfStock = variants.filter((v: any) => v.stock === 0);

                                        aiResponse = `📸 "${product.name}" олдлоо!\n\n`;
                                        aiResponse += `💰 Үнэ: ${Number(product.price).toLocaleString()}₮\n`;
                                        
                                        if (variants.length > 0) {
                                            if (available.length > 0) {
                                                aiResponse += `✅ Байгаа: ${available.map((v: any) => `${v.color || ''} ${v.size || ''}`).join(', ')}\n`;
                                            }
                                            if (outOfStock.length > 0) {
                                                aiResponse += `❌ Дууссан: ${outOfStock.map((v: any) => `${v.color || ''} ${v.size || ''}`).join(', ')}\n`;
                                            }
                                        } else {
                                            aiResponse += `📦 Үлдэгдэл: ${product.stock > 0 ? `${product.stock}ш` : 'Дууссан'}\n`;
                                        }
                                        
                                        // Send text first
                                        await sendTextMessage({
                                            recipientId: senderId,
                                            message: aiResponse,
                                            pageAccessToken: pageAccessToken,
                                        });

                                        // Send button to order immediately
                                        await sendMessageWithQuickReplies({
                                            recipientId: senderId,
                                            message: "Захиалах уу?",
                                            quickReplies: [
                                                { content_type: 'text', title: 'Тийм, захиалъя', payload: `ORDER_${product.name}` },
                                                { content_type: 'text', title: 'Үгүй', payload: 'NO_ORDER' }
                                            ],
                                            pageAccessToken
                                        });

                                    } else {
                                        aiResponse = `Зургаас "${analysis.description}" харагдаж байна, гэхдээ манай дэлгүүрт олдсонгүй. 😅`;
                                        await sendTextMessage({ recipientId: senderId, message: aiResponse, pageAccessToken });
                                    }
                                } else {
                                    aiResponse = `Уучлаарай, зургийг таньж чадсангүй. Та барааны нэрийг бичээд асууна уу! 🙏`;
                                    await sendTextMessage({ recipientId: senderId, message: aiResponse, pageAccessToken });
                                }
                            } catch (err) {
                                await sendTextMessage({ recipientId: senderId, message: "Зургийг боловсруулахад алдаа гарлаа.", pageAccessToken });
                            }

                            // Save to chat history
                            await supabase.from('chat_history').insert({
                                shop_id: shop.id,
                                customer_id: customer?.id,
                                message: "[Image Attachment]",
                                response: "Image Analysis Result",
                                intent: 'PRODUCT_INQUIRY'
                            });
                        }
                    }
                }

                // 2. Handle text messages
                if (event.message?.text) {
                    const userMessage = event.message.text;
                    console.log(`📩 [${shop.name}] Received:`, userMessage, 'from:', senderId);

                    const intent = detectIntent(userMessage);
                    console.log(`Intent: ${intent.intent}, Confidence: ${intent.confidence}`);

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
                            .insert({ shop_id: shop.id, facebook_id: senderId })
                            .select().single();
                        customer = newCustomer;
                    } else {
                        customer = existingCustomer;
                    }

                    let aiResponseText: string = "";
                    let aiResponseRich: RichChatResponse | null = null;

                    try {
                        const rawResponse = await generateChatResponse(userMessage, {
                            shopName: shop.name,
                            products: (shop.products || []).map((p: any) => ({
                                ...p,
                                variants: p.product_variants || []
                            })),
                            customerName: customer?.name || undefined,
                            orderHistory: customer?.total_orders || 0,
                        });

                        // Parse response
                        if (typeof rawResponse === 'object') {
                            aiResponseRich = rawResponse as RichChatResponse;
                            aiResponseText = aiResponseRich.text;
                        } else {
                            // Check if it looks like JSON (in case Gemini returned stringified JSON)
                            if (rawResponse.trim().startsWith('{')) {
                                try {
                                    aiResponseRich = JSON.parse(rawResponse);
                                    aiResponseText = aiResponseRich?.text || rawResponse;
                                } catch (e) {
                                    aiResponseText = rawResponse;
                                }
                            } else {
                                aiResponseText = rawResponse;
                            }
                        }

                    } catch (aiError: any) {
                        console.error('❌ AI Error:', aiError?.message);
                        // Fallback logic
                        const msg = userMessage.toLowerCase();
                        const products = shop.products || [];
                        const productList = products.slice(0, 3).map((p: any) => `${p.name} (${Number(p.price).toLocaleString()}₮)`).join(', ');

                        if (msg.includes('сайн') || msg.includes('hello')) {
                            aiResponseText = `Сайн байна уу! 😊 ${shop.name}-д тавтай морил! Манайд ${productList} байна.`;
                        } else if (msg.includes('бараа') || msg.includes('бүтээгдэхүүн')) {
                            aiResponseText = `Манайд одоогоор дараах бараанууд байна:\n${products.slice(0, 5).map((p: any) => `- ${p.name} (${Number(p.price).toLocaleString()}₮)`).join('\n')}`;
                        } else {
                            aiResponseText = `Сайн байна уу! 😊 Танд яаж туслах вэ?`;
                        }
                    }

                    // Check for order intent and create order
                    // Note: Moving this BEFORE sending message so we can confirm if needed.
                    // But currently we want AI to handle the convo. 
                    // Let's keep the automated order creation for simple cases, but maybe we should disable it if we want the new interactive flow?
                    // For now, let's keep it but make it smarter later.
                    
                    if (intent.intent === 'ORDER_CREATE' && customer) {
                         // ... existing order logic ...
                         // If we implement the interactive flow, we might want to skip this automatic creation 
                         // and instead let the AI guide the user to the "Order" button.
                         // But for now, let's leave it as a "shortcut".
                         
                         const product = shop.products?.find((p: any) => 
                            userMessage.toLowerCase().includes(p.name.toLowerCase())
                        );

                        if (product) {
                            // Create order logic (simplified for this update)
                            // ... same as before ...
                             const { data: order } = await supabase
                                .from('orders')
                                .insert({
                                    shop_id: shop.id,
                                    customer_id: customer.id,
                                    status: 'pending',
                                    total_amount: product.price,
                                    notes: `Messenger-ээр захиалсан: ${userMessage}`
                                })
                                .select().single();

                            if (order) {
                                await supabase.from('order_items').insert({
                                    order_id: order.id, product_id: product.id, quantity: 1, unit_price: product.price
                                });
                                aiResponseText = `🎉 "${product.name}" захиалга амжилттай бүртгэгдлээ!\n\nҮнэ: ${Number(product.price).toLocaleString()}₮\n\nХүргэлтийн хаягаа мессежээр илгээнэ үү! 📦`;
                                aiResponseRich = null; // Clear rich response to avoid double sending
                            }
                        }
                    }

                    // --- SENDING RESPONSE ---

                    // 1. Send Rich Content (Carousel) if suggested products exist
                    if (aiResponseRich && aiResponseRich.suggestedProducts && aiResponseRich.suggestedProducts.length > 0) {
                        // Send text first
                        await sendTextMessage({ recipientId: senderId, message: aiResponseText, pageAccessToken });

                        // Prepare carousel elements
                        const productCards: CarouselElement[] = [];
                        for (const name of aiResponseRich.suggestedProducts) {
                            // Find product (fuzzy match)
                            const p = shop.products?.find((p:any) => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()));
                            if (p) {
                                productCards.push({
                                    title: p.name,
                                    subtitle: `${p.price.toLocaleString()}₮\n${p.description?.substring(0, 50) || ''}...`,
                                    image_url: p.image_url || 'https://via.placeholder.com/300?text=No+Image', // Fallback image
                                    buttons: [
                                        { type: 'postback', title: 'Захиалах 🛒', payload: `ORDER_${p.name}` },
                                        // { type: 'postback', title: 'Дэлгэрэнгүй ℹ️', payload: `DETAILS_${p.name}` }
                                    ]
                                });
                            }
                        }

                        if (productCards.length > 0) {
                            console.log(`📤 Sending carousel with ${productCards.length} products`);
                            await sendCarousel({ recipientId: senderId, elements: productCards, pageAccessToken });
                        } else {
                            // If no products found for carousel, just ensure text was sent (it was)
                        }

                    } 
                    // 2. Send Quick Replies if available
                    else if (aiResponseRich && aiResponseRich.quickReplies && aiResponseRich.quickReplies.length > 0) {
                        console.log(`📤 Sending message with quick replies`);
                        await sendMessageWithQuickReplies({
                            recipientId: senderId,
                            message: aiResponseText,
                            quickReplies: aiResponseRich.quickReplies.map(qr => ({
                                content_type: 'text',
                                title: qr.title,
                                payload: qr.payload
                            })),
                            pageAccessToken
                        });
                    } 
                    // 3. Standard Text Message
                    else {
                        console.log(`📤 Sending standard text message`);
                        await sendTextMessage({
                            recipientId: senderId,
                            message: aiResponseText,
                            pageAccessToken,
                        });
                    }

                    // Save chat history
                    await supabase.from('chat_history').insert({
                        shop_id: shop.id,
                        customer_id: customer?.id,
                        message: userMessage,
                        response: aiResponseText,
                        intent: intent.intent
                    });
                }

                // Handle postback (button clicks from Carousel or Quick Reply)
                if (event.postback?.payload) {
                    const payload = event.postback.payload;
                    console.log(`👆 Postback received: ${payload}`);

                    if (payload.startsWith('ORDER_')) {
                        const productName = payload.replace('ORDER_', '');
                        // Here we could start the interactive flow
                        await sendTextMessage({
                            recipientId: senderId,
                            message: `✅ "${productName}" сонгогдлоо!\n\nТа хэдэн ширхэг авах вэ? (Жишээ нь: 1)`,
                            pageAccessToken: pageAccessToken,
                        });
                        
                        // We could save state here to know the user is ordering 'productName'
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
