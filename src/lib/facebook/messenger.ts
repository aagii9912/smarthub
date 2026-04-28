import { logger } from '@/lib/utils/logger';
const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

interface SendMessageOptions {
    recipientId: string;
    message: string;
    pageAccessToken: string;
}

interface QuickReply {
    content_type: 'text';
    title: string;
    payload: string;
}

// ... existing code ...
interface SendMessageWithQuickRepliesOptions extends SendMessageOptions {
    quickReplies: QuickReply[];
}

export async function sendSenderAction(
    recipientId: string,
    action: 'mark_seen' | 'typing_on' | 'typing_off',
    pageAccessToken: string
) {
    try {
        const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                sender_action: action,
            }),
        });

        if (!response.ok) {
            logger.warn(`⚠️ Sender action '${action}' failed but continuing...`);
        }
    } catch (error: unknown) {
        logger.warn(`⚠️ Sender action '${action}' network error:`, { error: error });
    }
}

export async function sendTextMessage({ recipientId, message, pageAccessToken }: SendMessageOptions) {
    // Guard against empty messages (Facebook API error #100)
    const text = message?.trim();
    if (!text) {
        logger.warn('⚠️ Attempted to send empty message, using fallback');
        return sendTextMessage({
            recipientId,
            message: 'Уучлаарай, хариултыг боловсруулж чадсангүй. Дахин оролдоно уу! 🙏',
            pageAccessToken,
        });
    }

    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error:', { error: error });
        throw new Error(`Failed to send message: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

// Send a message using Message Tags (for notifications outside 24-hour window)
export async function sendTaggedMessage({
    recipientId,
    message,
    pageAccessToken,
    tag = 'POST_PURCHASE_UPDATE',
}: {
    recipientId: string;
    message: string;
    pageAccessToken: string;
    tag?: 'POST_PURCHASE_UPDATE' | 'CONFIRMED_EVENT_UPDATE' | 'ACCOUNT_UPDATE';
}) {
    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: message },
            messaging_type: 'MESSAGE_TAG',
            tag: tag,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error (tagged message):', { error: error });
        throw new Error(`Failed to send tagged message: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

export async function sendMessageWithQuickReplies({
    recipientId,
    message,
    quickReplies,
    pageAccessToken,
}: SendMessageWithQuickRepliesOptions) {
    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                text: message,
                quick_replies: quickReplies,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error:', { error: error });
        throw new Error(`Failed to send message: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

export async function sendProductCard({
    recipientId,
    product,
    pageAccessToken,
}: {
    recipientId: string;
    product: { name: string; description: string; price: number; imageUrl?: string };
    pageAccessToken: string;
}) {
    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [
                            {
                                title: product.name,
                                subtitle: `${product.price.toLocaleString()}₮\n${product.description || ''}`,
                                image_url: product.imageUrl || undefined,
                                buttons: [
                                    {
                                        type: 'postback',
                                        title: 'Захиалах 🛒',
                                        payload: `ORDER_${product.name}`,
                                    },
                                    {
                                        type: 'postback',
                                        title: 'Дэлгэрэнгүй',
                                        payload: `DETAILS_${product.name}`,
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error:', { error: error });
        throw new Error(`Failed to send product card: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

// Send a single image
export async function sendImage({
    recipientId,
    imageUrl,
    pageAccessToken,
}: {
    recipientId: string;
    imageUrl: string;
    pageAccessToken: string;
}) {
    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'image',
                    payload: {
                        url: imageUrl,
                        is_reusable: true,
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error:', { error: error });
        throw new Error(`Failed to send image: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

// Send multiple products as carousel gallery (max 10)
export async function sendImageGallery({
    recipientId,
    products,
    pageAccessToken,
    confirmMode = false,
}: {
    recipientId: string;
    products: Array<{
        name: string;
        price: number;
        imageUrl: string;
        description?: string;
    }>;
    pageAccessToken: string;
    confirmMode?: boolean; // If true, shows "Энэ үү?" selection mode
}) {
    // Facebook allows max 10 elements in carousel
    const limitedProducts = products.slice(0, 10);

    const elements = limitedProducts.map((product) => ({
        title: product.name,
        subtitle: `${product.price.toLocaleString()}₮${product.description ? `\n${product.description}` : ''}`,
        image_url: product.imageUrl,
        buttons: confirmMode
            ? [
                {
                    type: 'postback',
                    title: 'Энэ нь! ✅',
                    payload: `SELECT_${product.name}`,
                },
            ]
            : [
                {
                    type: 'postback',
                    title: 'Захиалах 🛒',
                    payload: `ORDER_${product.name}`,
                },
                {
                    type: 'postback',
                    title: 'Дэлгэрэнгүй',
                    payload: `DETAILS_${product.name}`,
                },
            ],
    }));

    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements,
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error:', { error: error });
        throw new Error(`Failed to send image gallery: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

/**
 * Send a button template message (up to 3 buttons per message)
 * Facebook Messenger API limit: max 3 buttons per button template
 */
export async function sendButtonTemplate({
    recipientId,
    text,
    buttons,
    pageAccessToken,
}: {
    recipientId: string;
    text: string;
    buttons: Array<{ type: 'postback' | 'web_url' | 'phone_number'; title: string; payload?: string; url?: string }>;
    pageAccessToken: string;
}) {
    // Guard: FB allows max 3 buttons
    const limitedButtons = buttons.slice(0, 3);

    // Button text max 640 chars
    const safeText = text.length > 640 ? text.substring(0, 637) + '...' : text;

    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'button',
                        text: safeText,
                        buttons: limitedButtons,
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Facebook API error (button template):', { error });
        throw new Error(`Failed to send button template: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

/**
 * Convert ChatActions to Messenger button template and send
 * Groups actions into sets of 3 buttons (FB limit)
 */
export async function sendActionsAsButtons({
    recipientId,
    actions,
    pageAccessToken,
    fallbackText = 'Сонголтоо хийнэ үү:',
}: {
    recipientId: string;
    actions: Array<{
        type: string;
        buttons: Array<{
            id?: string;
            label: string;
            payload: string;
            variant?: string;
            icon?: string;
        }>;
        context?: Record<string, unknown>;
    }>;
    pageAccessToken: string;
    fallbackText?: string;
}) {
    // Collect all buttons from all action groups
    const allButtons: Array<{ type: 'postback' | 'web_url' | 'phone_number'; title: string; payload?: string; url?: string }> = [];

    for (const action of actions) {
        for (const btn of action.buttons) {
            // Handle URL buttons (OPEN_URL: or OPEN_QPAY:) as web_url
            if (btn.payload.startsWith('OPEN_URL:') || btn.payload.startsWith('OPEN_QPAY:')) {
                const url = btn.payload.replace(/^OPEN_(URL|QPAY):/, '');
                allButtons.push({
                    type: 'web_url',
                    title: btn.label.substring(0, 20), // FB limit: 20 chars
                    url,
                });
            } else if (btn.payload.startsWith('CALL:')) {
                // Native click-to-call. Payload format: `CALL:+97699XXXXXX`.
                // Meta requires E.164 with leading `+`.
                const phone = btn.payload.slice(5).trim();
                if (/^\+\d{6,15}$/.test(phone)) {
                    allButtons.push({
                        type: 'phone_number',
                        title: btn.label.substring(0, 20),
                        payload: phone,
                    });
                } else {
                    logger.warn('Skipping malformed CALL: button payload', { payload: btn.payload });
                }
            } else {
                allButtons.push({
                    type: 'postback',
                    title: btn.label.substring(0, 20), // FB limit: 20 chars
                    payload: btn.payload,
                });
            }
        }
    }

    if (allButtons.length === 0) return;

    // Send in groups of 3 (FB API limit)
    for (let i = 0; i < allButtons.length; i += 3) {
        const chunk = allButtons.slice(i, i + 3);
        const text = i === 0 ? fallbackText : 'Бусад сонголт:';

        try {
            await sendButtonTemplate({
                recipientId,
                text,
                buttons: chunk,
                pageAccessToken,
            });
        } catch (error) {
            logger.warn('Failed to send action buttons chunk:', { error, chunkIndex: i });
        }
    }
}

export function verifyWebhook(
    mode: string | null,
    token: string | null,
    challenge: string | null,
    verifyToken: string
): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
        return challenge;
    }
    return null;
}
