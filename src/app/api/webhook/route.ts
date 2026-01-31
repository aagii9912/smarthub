import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendSenderAction } from '@/lib/facebook/messenger';
import { detectIntent } from '@/lib/ai/intent-detector';
import { shouldReplyToComment } from '@/lib/ai/comment-detector';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import {
    getShopByPageId,
    getShopByInstagramId,
    getAIFeatures,
    getOrCreateCustomer,
    getOrCreateInstagramCustomer,
    updateCustomerInfo,
    generateFallbackResponse,
    replyToComment,
    ShopWithProducts,
} from '@/lib/webhook/WebhookService';

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

// Message batching: wait 5 seconds to collect multiple messages before responding
const MESSAGE_BATCH_DELAY_SECONDS = 5;

/**
 * Add message to pending queue for batched processing
 * Returns true if added successfully
 */
async function addToPendingMessages(params: {
    shopId: string;
    customerId: string;
    senderId: string;
    platform: string;
    messageType: 'text' | 'image';
    content?: string;
    imageUrl?: string;
    accessToken: string;
}): Promise<boolean> {
    const supabase = supabaseAdmin();
    const processAfter = new Date(Date.now() + MESSAGE_BATCH_DELAY_SECONDS * 1000);

    const { error } = await supabase.from('pending_messages').insert({
        shop_id: params.shopId,
        customer_id: params.customerId,
        sender_id: params.senderId,
        platform: params.platform,
        message_type: params.messageType,
        content: params.content || null,
        image_url: params.imageUrl || null,
        access_token: params.accessToken,
        process_after: processAfter.toISOString(),
        processed: false,
    });

    if (error) {
        logger.error('Failed to add pending message:', { error });
        return false;
    }

    return true;
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

// Handle incoming messages (POST request from Facebook/Instagram)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Determine platform type: 'page' for Messenger, 'instagram' for Instagram
        const platform: 'messenger' | 'instagram' = body.object === 'instagram' ? 'instagram' : 'messenger';

        // Validate object type (page or instagram)
        if (body.object !== 'page' && body.object !== 'instagram') {
            return NextResponse.json({ error: 'Invalid object type' }, { status: 400 });
        }

        logger.info(`Webhook received for platform: ${platform}`);

        // Process each entry
        for (const entry of body.entry as WebhookEntry[]) {
            const accountId = entry.id; // Page ID for Messenger, or Instagram Business Account ID

            // Get shop based on platform
            let shop: ShopWithProducts | null = null;
            if (platform === 'instagram') {
                shop = await getShopByInstagramId(accountId);
            } else {
                shop = await getShopByPageId(accountId);
            }

            if (!shop) {
                logger.warn(`No active shop found for ${platform} account ${accountId}`);
                continue;
            }

            // Get AI features for this shop
            const aiFeatures = await getAIFeatures(shop.id);

            // Get access token based on platform
            const accessToken = platform === 'instagram'
                ? (shop.instagram_access_token || shop.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN)
                : (shop.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN);

            if (!accessToken) {
                logger.warn(`No access token for shop ${shop.name} on ${platform}`);
                continue;
            }

            // Process Facebook Page feed events (comments) - only for Messenger platform
            if (platform === 'messenger') {
                for (const change of entry.changes || []) {
                    if (change.field === 'feed' && change.value?.item === 'comment') {
                        const commentData = change.value;
                        const commentMessage = commentData.message || '';
                        const commentId = commentData.comment_id;
                        const senderId = commentData.from?.id;

                        // Don't reply to own comments (from page)
                        if (senderId === accountId || !commentId) continue;

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
                                accessToken
                            );
                        } else {
                            logger.debug(`[${shop.name}] Comment not product-related, skipping`);
                        }
                    }
                }
            }

            // Process messaging events (works for both Messenger and Instagram)
            for (const event of entry.messaging || []) {
                const senderId = event.sender.id;

                // Handle text messages
                if (event.message?.text) {
                    const userMessage = event.message.text;
                    logger.info(`[${shop.name}] Received ${platform} message`, { userMessage, senderId });

                    // Mark Seen & Typing indicators
                    await sendSenderAction(senderId, 'mark_seen', accessToken);
                    await sendSenderAction(senderId, 'typing_on', accessToken);

                    // Detect intent
                    const intent = detectIntent(userMessage);
                    logger.debug('Intent detected', { intent: intent.intent, confidence: intent.confidence });

                    // Get or create customer based on platform
                    let customer = platform === 'instagram'
                        ? await getOrCreateInstagramCustomer(shop.id, senderId, accessToken)
                        : await getOrCreateCustomer(shop.id, senderId, accessToken);

                    // Update customer info if needed
                    customer = await updateCustomerInfo(customer, senderId, accessToken, userMessage);

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

                    // === MESSAGE BATCHING ===
                    // Instead of responding immediately, add to pending queue
                    // Cron job will batch multiple messages and respond once
                    const added = await addToPendingMessages({
                        shopId: shop.id,
                        customerId: customer.id,
                        senderId,
                        platform,
                        messageType: 'text',
                        content: userMessage,
                        accessToken,
                    });

                    if (added) {
                        logger.info(`[${shop.name}] Message queued for batched processing`, {
                            senderId,
                            delaySeconds: MESSAGE_BATCH_DELAY_SECONDS
                        });
                    } else {
                        // Fallback: If pending queue fails, respond immediately with fallback
                        logger.warn(`[${shop.name}] Pending queue failed, sending fallback`);
                        const fallback = generateFallbackResponse(intent, shop.name, shop.products);
                        await sendTextMessage({
                            recipientId: senderId,
                            message: fallback,
                            pageAccessToken: accessToken,
                        });
                    }
                }

                // Handle image attachments
                else if (event.message?.attachments) {
                    for (const attachment of event.message.attachments) {
                        if (attachment.type === 'image' && attachment.payload?.url) {
                            const imageUrl = attachment.payload.url;
                            logger.info(`[${shop.name}] Received image from ${platform}`, { imageUrl });

                            // Get or create customer for image processing
                            const customer = platform === 'instagram'
                                ? await getOrCreateInstagramCustomer(shop.id, senderId, accessToken)
                                : await getOrCreateCustomer(shop.id, senderId, accessToken);

                            // Send typing indicator
                            await sendSenderAction(senderId, 'typing_on', accessToken);

                            // CHECK: Global AI Switch
                            if (shop.is_ai_active === false) {
                                logger.info(`[${shop.name}] AI is globally disabled. Skipping image.`);
                                continue;
                            }

                            // === IMAGE BATCHING ===
                            // Add image to pending queue for batched processing
                            const added = await addToPendingMessages({
                                shopId: shop.id,
                                customerId: customer.id,
                                senderId,
                                platform,
                                messageType: 'image',
                                imageUrl,
                                accessToken,
                            });

                            if (added) {
                                logger.info(`[${shop.name}] Image queued for batched processing`, {
                                    senderId,
                                    delaySeconds: MESSAGE_BATCH_DELAY_SECONDS
                                });
                            } else {
                                // Fallback: If pending queue fails, send error message
                                logger.warn(`[${shop.name}] Pending queue failed for image`);
                                await sendTextMessage({
                                    recipientId: senderId,
                                    message: 'Зургийг хүлээж авлаа. Түр хүлээнэ үү! 📸',
                                    pageAccessToken: accessToken,
                                });
                            }
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
                            pageAccessToken: accessToken,
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
