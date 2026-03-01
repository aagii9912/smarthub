import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, sendTextMessage, sendSenderAction } from '@/lib/facebook/messenger';
import { detectIntent } from '@/lib/ai/intent-detector';
import { shouldReplyToComment } from '@/lib/ai/comment-detector';
import { logger } from '@/lib/utils/logger';
import { routeToAI, analyzeProductImageWithPlan, getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import * as Sentry from '@sentry/nextjs';
import type { ChatMessage, AIEmotion, AIProduct } from '@/types/ai';
import {
    getShopByPageId,
    getShopByInstagramId,
    getAIFeatures,
    getOrCreateCustomer,
    getOrCreateInstagramCustomer,
    updateCustomerInfo,
    getChatHistory,
    saveChatHistory,
    incrementMessageCount,
    buildNotifySettings,
    generateFallbackResponse,
    processAIResponse,
    replyToComment,
    ShopWithProducts,
} from '@/lib/webhook/WebhookService';
import { getMatchingAutomation, executeAutomation } from '@/lib/services/CommentAutomationService';
import crypto from 'crypto';

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'smarthub_verify_token_2024';

/**
 * SEC-8: Verify Facebook X-Hub-Signature-256
 */
function verifyFacebookSignature(rawBodyBuffer: Buffer, signature: string | null): boolean {
    const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
    if (!appSecret) {
        logger.warn('FACEBOOK_APP_SECRET not configured');
        return false;
    }
    if (!signature || !signature.startsWith('sha256=')) return false;

    const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update(rawBodyBuffer)
        .digest('hex');

    const receivedHash = signature.replace('sha256=', '');

    try {
        const match = crypto.timingSafeEqual(
            Buffer.from(expectedHash),
            Buffer.from(receivedHash)
        );
        if (!match) {
            logger.warn('Signature hash comparison failed', {
                expectedPrefix: expectedHash.substring(0, 10),
                receivedPrefix: receivedHash.substring(0, 10),
                secretLength: appSecret.length,
                bodyLength: rawBodyBuffer.length,
            });
        }
        return match;
    } catch {
        return false;
    }
}

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
            text?: string;
            comment_id?: string;
            media_id?: string;
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

// Handle incoming messages (POST request from Facebook/Instagram)
export async function POST(request: NextRequest) {
    try {
        // SEC-8: Verify Facebook X-Hub-Signature-256
        const arrayBuffer = await request.arrayBuffer();
        const rawBodyBuffer = Buffer.from(arrayBuffer);
        const signature = request.headers.get('x-hub-signature-256');

        if (!verifyFacebookSignature(rawBodyBuffer, signature)) {
            logger.warn('Facebook webhook signature mismatch - WARN ONLY MODE', {
                hasSignature: !!signature,
                signaturePrefix: signature?.substring(0, 15),
                secretPrefix: process.env.FACEBOOK_APP_SECRET?.substring(0, 6),
            });
            // TODO: Re-enable strict mode after fixing App Secret
            // return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const rawBodyText = rawBodyBuffer.toString('utf8');
        const body = JSON.parse(rawBodyText);

        // Determine platform type: 'page' for Messenger, 'instagram' for Instagram
        const platform: 'messenger' | 'instagram' = body.object === 'instagram' ? 'instagram' : 'messenger';

        // Validate object type (page or instagram)
        if (body.object !== 'page' && body.object !== 'instagram') {
            return NextResponse.json({ error: 'Invalid object type' }, { status: 400 });
        }

        logger.info(`Webhook received for platform: ${platform}`, {
            object: body.object,
            entryCount: body.entry?.length,
            // Debug: log entry structure for Instagram
            entryIds: body.entry?.map((e: WebhookEntry) => e.id),
            hasChanges: body.entry?.map((e: WebhookEntry) => ({
                id: e.id,
                changesCount: e.changes?.length || 0,
                changeFields: e.changes?.map(c => c.field),
                messagingCount: e.messaging?.length || 0,
            })),
        });

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

            // Process comment events (Facebook feed + Instagram comments)
            for (const change of entry.changes || []) {
                const isFbComment = platform === 'messenger' && change.field === 'feed' && change.value?.item === 'comment';
                const isIgComment = platform === 'instagram' && change.field === 'comments';

                if (isFbComment || isIgComment) {
                    const commentData = change.value;
                    const commentMessage = commentData?.message || commentData?.text || '';
                    const commentId = commentData?.comment_id;
                    const postId = commentData?.post_id || commentData?.media_id || null;
                    const senderId = commentData?.from?.id;

                    // Don't reply to own comments (from page)
                    if (senderId === accountId || !commentId) continue;

                    const currentPlatform = platform === 'instagram' ? 'instagram' as const : 'facebook' as const;

                    logger.info(`[${shop.name}] New ${currentPlatform} comment received`, {
                        commentMessage,
                        senderName: commentData?.from?.name,
                        postId,
                    });

                    // 1. Check Comment Automations first (higher priority)
                    const automation = await getMatchingAutomation(
                        shop.id,
                        postId,
                        commentMessage,
                        currentPlatform
                    );

                    if (automation) {
                        logger.info(`[${shop.name}] Comment automation matched: "${automation.name}"`);
                        await executeAutomation(
                            automation,
                            senderId!,
                            commentId,
                            accessToken,
                            currentPlatform
                        );
                        continue; // Automation handled, skip default comment reply
                    }

                    // 2. Fallback: existing product-related comment reply (Facebook only)
                    if (platform === 'messenger' && shouldReplyToComment(commentMessage)) {
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
                        logger.debug(`[${shop.name}] Comment not matched, skipping`);
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

                    // === REALTIME AI PROCESSING ===
                    try {
                        const previousHistory: ChatMessage[] = await getChatHistory(shop.id, customer.id);

                        // Map products to AI format
                        const mappedProducts: AIProduct[] = shop.products.map(p => ({
                            id: p.id,
                            name: p.name,
                            description: p.description || undefined,
                            price: p.price || 0,
                            stock: p.stock ?? 0,
                            variants: undefined,
                            discount_percent: p.discount_percent ?? undefined,
                        }));

                        // Route to AI
                        const response = await routeToAI(
                            userMessage,
                            {
                                shopId: shop.id,
                                customerId: customer.id,
                                shopName: shop.name,
                                shopDescription: shop.description || undefined,
                                aiInstructions: shop.ai_instructions || undefined,
                                aiEmotion: (shop.ai_emotion || 'friendly') as AIEmotion,
                                customKnowledge: shop.custom_knowledge || undefined,
                                products: mappedProducts,
                                customerName: customer.name || undefined,
                                orderHistory: customer.total_orders || 0,
                                faqs: aiFeatures.faqs,
                                quickReplies: aiFeatures.quickReplies,
                                slogans: aiFeatures.slogans,
                                notifySettings: buildNotifySettings(shop),
                                subscription: {
                                    plan: shop.subscription_plan || 'starter',
                                    status: shop.subscription_status || 'active',
                                },
                                messageCount: customer.message_count || 0,
                            },
                            previousHistory
                        );

                        // Send AI response
                        await sendTextMessage({
                            recipientId: senderId,
                            message: response.text,
                            pageAccessToken: accessToken,
                        });

                        // Process product images if AI requested
                        await processAIResponse(response, senderId, accessToken);

                        // Save to chat history
                        await saveChatHistory(shop.id, customer.id, userMessage, response.text, intent.intent);
                        await incrementMessageCount(customer.id);

                        logger.success(`[${shop.name}] AI response sent to ${senderId}`);

                    } catch (aiError) {
                        logger.error('AI processing error:', { error: aiError });
                        // Send fallback response
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

                            // === REALTIME IMAGE PROCESSING ===
                            try {
                                const planType = getPlanTypeFromSubscription({
                                    plan: shop.subscription_plan || 'starter',
                                    status: shop.subscription_status || 'active',
                                });

                                const productsForAnalysis = shop.products.map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    description: p.description || undefined,
                                }));

                                // Analyze the image
                                const imageAnalysis = await analyzeProductImageWithPlan(
                                    imageUrl,
                                    productsForAnalysis,
                                    planType
                                );

                                let responseMessage = '';

                                if (imageAnalysis.matchedProduct) {
                                    const matchedProduct = shop.products.find(p =>
                                        p.name.toLowerCase().includes(imageAnalysis.matchedProduct!.toLowerCase()) ||
                                        imageAnalysis.matchedProduct!.toLowerCase().includes(p.name.toLowerCase())
                                    );

                                    if (matchedProduct) {
                                        const sizeInfo = matchedProduct.variants ? `\n📏 ${matchedProduct.variants}` : '';
                                        responseMessage = `🏷️ ${matchedProduct.name}\n💰 ${matchedProduct.price?.toLocaleString()}₮\n📦 ${matchedProduct.stock} ширхэг${sizeInfo}`;
                                    }
                                }

                                if (!responseMessage && imageAnalysis.description) {
                                    responseMessage = `Зурагт: ${imageAnalysis.description}\n\nЭнэ бүтээгдэхүүний талаар илүү мэдээлэл хүсвэл бичнэ үү! 😊`;
                                }

                                if (!responseMessage) {
                                    responseMessage = 'Зургийг хүлээж авлаа! Ямар бүтээгдэхүүн сонирхож байна вэ? 📸';
                                }

                                await sendTextMessage({
                                    recipientId: senderId,
                                    message: responseMessage,
                                    pageAccessToken: accessToken,
                                });

                                // Save to history
                                await saveChatHistory(shop.id, customer.id, `[Зураг илгээсэн]`, responseMessage, 'IMAGE_ANALYSIS');

                                logger.success(`[${shop.name}] Image analyzed and response sent`);

                            } catch (imageError) {
                                logger.error('Image processing error:', { error: imageError });
                                await sendTextMessage({
                                    recipientId: senderId,
                                    message: 'Зургийг хүлээж авлаа. Ямар бүтээгдэхүүн сонирхож байгаагаа хэлнэ үү! 📸',
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

        // Sentry monitoring for critical webhook failures
        if (error instanceof Error) {
            Sentry.captureException(error);
        }

        // SEC-9: Mask internal error details in production
        const errorMessage = process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: errorMessage,
        }, { status: 500 });
    }
}
