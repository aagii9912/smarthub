import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendSenderAction } from '@/lib/facebook/messenger';
import { generateChatResponse } from '@/lib/ai/openai';
import { detectIntent } from '@/lib/ai/intent-detector';
import { shouldReplyToComment } from '@/lib/ai/comment-detector';
import { logger } from '@/lib/utils/logger';
import {
    getShopByPageId,
    getAIFeatures,
    getOrCreateCustomer,
    updateCustomerInfo,
    getChatHistory,
    saveChatHistory,
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
        message?: { text?: string };
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

                    // Generate AI response
                    let aiResponse: string;
                    try {
                        logger.info(`[${shop.name}] Generating AI response...`);

                        // Get chat history for context
                        const previousHistory: ChatMessage[] = await getChatHistory(shop.id, customer.id);

                        // Map products to ensure null values are converted to undefined
                        const mappedProducts = shop.products.map(p => ({
                            ...p,
                            discount_percent: p.discount_percent ?? undefined,
                        }));

                        // Generate response with minimum delay for typing animation
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
                                    products: mappedProducts,
                                    customerName: customer.name || undefined,
                                    orderHistory: customer.total_orders || 0,
                                    faqs: aiFeatures.faqs,
                                    quickReplies: aiFeatures.quickReplies,
                                    slogans: aiFeatures.slogans,
                                    notifySettings: buildNotifySettings(shop),
                                },
                                previousHistory
                            ),
                            new Promise(resolve => setTimeout(resolve, 1500))
                        ]);


                        aiResponse = response.text;
                        logger.success('AI response generated', {
                            preview: aiResponse.substring(0, 100) + '...',
                            hasImage: !!response.imageAction
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

                    // Save chat history
                    await saveChatHistory(shop.id, customer.id, userMessage, aiResponse, intent.intent);

                    // Send response to Facebook
                    try {
                        logger.info(`[${shop.name}] Sending response...`);
                        await sendTextMessage({
                            recipientId: senderId,
                            message: aiResponse,
                            pageAccessToken,
                        });
                        logger.success('Message sent successfully!');
                    } catch (sendError) {
                        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
                        logger.error('Failed to send message:', { message: errorMessage });
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
