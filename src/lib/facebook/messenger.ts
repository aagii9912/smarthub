const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

interface SendMessageOptions {
    recipientId: string;
    message: string;
    pageAccessToken: string;
}

interface QuickReply {
    content_type: 'text';
    title: string;
    payload: string;
    image_url?: string;
}

interface SendMessageWithQuickRepliesOptions extends SendMessageOptions {
    quickReplies: QuickReply[];
}

export interface CarouselElement {
    title: string;
    subtitle?: string;
    image_url?: string | null;
    default_action?: {
        type: 'web_url';
        url: string;
        webview_height_ratio?: 'tall' | 'full' | 'compact';
    };
    buttons?: Array<{
        type: 'postback' | 'web_url' | 'phone_number';
        title: string;
        payload?: string;
        url?: string;
    }>;
}

export async function sendTextMessage({ recipientId, message, pageAccessToken }: SendMessageOptions) {
    const response = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${pageAccessToken}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: message },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Facebook API error:', error);
        throw new Error(`Failed to send message: ${error.error?.message || 'Unknown error'}`);
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
        console.error('Facebook API error:', error);
        throw new Error(`Failed to send message: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
}

export async function sendCarousel({
    recipientId,
    elements,
    pageAccessToken,
}: {
    recipientId: string;
    elements: CarouselElement[];
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
                        elements: elements.slice(0, 10), // Facebook limit is 10
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Facebook API error:', error);
        throw new Error(`Failed to send carousel: ${error.error?.message || 'Unknown error'}`);
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
    return sendCarousel({
        recipientId,
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
        pageAccessToken,
    });
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
