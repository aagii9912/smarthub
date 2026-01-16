export interface ChatContext {
    shopId: string;
    customerId?: string;
    shopName: string;
    shopDescription?: string;
    aiInstructions?: string;
    aiEmotion?: 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        reserved_stock?: number;
        discount_percent?: number;
        description?: string;
        image_url?: string;  // Product image URL for Messenger
        type?: 'product' | 'service';  // product = бараа, service = үйлчилгээ
        unit?: string;  // e.g., 'ширхэг', 'захиалга', 'цаг'
        variants?: Array<{
            color: string | null;
            size: string | null;
            stock: number;
        }>;
    }>;
    customerName?: string;
    orderHistory?: number;
    // New AI features
    faqs?: Array<{ question: string; answer: string }>;
    quickReplies?: Array<{ trigger_words: string[]; response: string; is_exact_match?: boolean }>;
    slogans?: Array<{ slogan: string; usage_context: string }>;
    // Notification settings
    notifySettings?: {
        order: boolean;
        contact: boolean;
        support: boolean;
        cancel: boolean;
    };
    // NEW: Enhanced context for cart system
    shopPolicies?: {
        shipping_threshold: number;
        payment_methods: string[];
        delivery_areas: string[];
        return_policy?: string;
    };
    customKnowledge?: Record<string, any>;
    activeCart?: {
        id: string;
        items: Array<{
            id: string;
            product_id: string;
            name: string;
            variant_specs: Record<string, string>;
            quantity: number;
            unit_price: number;
        }>;
        total_amount: number;
    };
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Image action to send to Messenger
export interface ImageAction {
    type: 'single' | 'confirm';
    products: Array<{
        name: string;
        price: number;
        imageUrl: string;
        description?: string;
    }>;
}

// Response from generateChatResponse
export interface ChatResponse {
    text: string;
    imageAction?: ImageAction;
}
