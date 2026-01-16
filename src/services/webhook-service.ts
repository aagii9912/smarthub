import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { generateChatResponse, ChatMessage } from '@/lib/ai/openai';
import { detectIntent } from '@/lib/ai/intent-detector';
import { shouldReplyToComment, generateCommentReply } from '@/lib/ai/comment-detector';
import { sendTextMessage, sendSenderAction, sendImage, sendImageGallery } from '@/lib/facebook/messenger';
import { getShopByPageId, getShopAIFeatures, getOrCreateCustomer, updateCustomerPhone, ShopData, CustomerData } from './shop-service';

export async function handleWebhookEvent(entry: any) {
    const pageId = entry.id;

    // 1. Get Shop
    const shop = await getShopByPageId(pageId);
    if (!shop) return;

    const pageAccessToken = shop.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
        logger.warn(`No access token for shop ${shop.name}`);
        return;
    }

    // 2. Process Comments
    if (entry.changes) {
        await processComments(entry.changes, shop, pageAccessToken);
    }

    // 3. Process Messages
    if (entry.messaging) {
        await processMessages(entry.messaging, shop, pageAccessToken);
    }
}

async function processComments(changes: any[], shop: ShopData, pageAccessToken: string) {
    const supabase = supabaseAdmin();
    for (const change of changes) {
        if (change.field === 'feed' && change.value?.item === 'comment') {
            const commentData = change.value;
            const commentMessage = commentData.message;
            const commentId = commentData.comment_id;
            const senderId = commentData.from?.id;

            // Don't reply to own comments
            if (senderId === shop.facebook_page_id) continue;

            if (shouldReplyToComment(commentMessage)) {
                const replyMessage = generateCommentReply(shop.name, shop.facebook_page_username);

                try {
                    const response = await fetch(
                        `https://graph.facebook.com/v18.0/${commentId}/comments`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: replyMessage, access_token: pageAccessToken }),
                        }
                    );

                    if (response.ok) {
                        logger.success(`[${shop.name}] Comment reply sent successfully!`);
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
                } catch (error: any) {
                    logger.error(`[${shop.name}] Error replying to comment`, { error: error?.message });
                }
            }
        }
    }
}

async function processMessages(messaging: any[], shop: ShopData, pageAccessToken: string) {
    for (const event of messaging) {
        const senderId = event.sender.id;

        if (event.message?.text) {
            await handleTextMessage(event.message.text, senderId, shop, pageAccessToken);
        }

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

async function handleTextMessage(userMessage: string, senderId: string, shop: ShopData, pageAccessToken: string) {
    const supabase = supabaseAdmin();

    // 1. Send Typing Indicators
    await sendSenderAction(senderId, 'mark_seen', pageAccessToken);
    await sendSenderAction(senderId, 'typing_on', pageAccessToken);

    // 2. Detect Intent
    const intent = detectIntent(userMessage);

    // 3. Get/Create Customer
    const customer = await getOrCreateCustomer(shop.id, senderId, pageAccessToken);
    if (!customer) return; // Should not happen

    // Update phone if found in message
    if (!customer.phone) {
        const phoneMatch = userMessage.match(/(\d{8})/);
        if (phoneMatch) {
            await updateCustomerPhone(customer.id, phoneMatch[1]);
            customer.phone = phoneMatch[1];
        }
    }

    // 4. Get AI Features
    const aiFeatures = await getShopAIFeatures(shop.id);

    // 5. Generate Response
    let aiResponse: string;
    try {
        // Get Chat History
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
                if (h.message) previousHistory.push({ role: 'user', content: h.message });
                if (h.response) previousHistory.push({ role: 'assistant', content: h.response });
            });
        }

        // Generate with delay for realism
        const [response] = await Promise.all([
             generateChatResponse(
                userMessage,
                {
                    shopId: shop.id,
                    customerId: customer.id,
                    shopName: shop.name,
                    shopDescription: shop.description || undefined,
                    aiInstructions: shop.ai_instructions || undefined,
                    aiEmotion: shop.ai_emotion || 'friendly',
                    products: shop.products || [],
                    customerName: customer.name || undefined,
                    orderHistory: customer.total_orders || 0,
                    faqs: aiFeatures.faqs,
                    quickReplies: aiFeatures.quickReplies,
                    slogans: aiFeatures.slogans,
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

         // Send images if requested
         if (imageAction && imageAction.products.length > 0) {
            if (imageAction.products.length === 1 && imageAction.type === 'single') {
                 await sendImage({
                    recipientId: senderId,
                    imageUrl: imageAction.products[0].imageUrl,
                    pageAccessToken: pageAccessToken,
                });
            } else {
                 await sendImageGallery({
                    recipientId: senderId,
                    products: imageAction.products,
                    pageAccessToken: pageAccessToken,
                    confirmMode: imageAction.type === 'confirm',
                });
            }
         }

    } catch (error: any) {
        logger.error('AI Error:', error);
        // Fallback logic could go here or use the one from original code
         aiResponse = `Уучлаарай, одоо системд түр алдаа гарлаа. Удахгүй хариулах болно! 🙏 (Error: ${error.message})`;
    }

    // 6. Send Response
    await sendSenderAction(senderId, 'typing_off', pageAccessToken);

    await supabase.from('chat_history').insert({
        shop_id: shop.id,
        customer_id: customer.id,
        message: userMessage,
        response: aiResponse,
        intent: intent.intent
    });

    await sendTextMessage({
        recipientId: senderId,
        message: aiResponse,
        pageAccessToken: pageAccessToken,
    });
}
