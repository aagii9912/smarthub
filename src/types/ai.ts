/**
 * AI Types - Centralized type definitions for AI functionality
 */

// AI Emotion/Personality types
export type AIEmotion = 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';

// Product types used in AI context
export interface AIProduct {
    id: string;
    name: string;
    price: number;
    stock: number;
    reserved_stock?: number;
    description?: string;
    image_url?: string;
    images?: string[];
    discount_percent?: number | null;
    type?: 'product' | 'service' | 'appointment';
    unit?: string;
    colors?: string[];
    sizes?: string[];
    variants?: AIProductVariant[];
}

export interface AIProductVariant {
    color: string | null;
    size: string | null;
    stock: number;
}

// FAQ type for AI context
export interface AIFAQ {
    question: string;
    answer: string;
}

// Quick Reply type for AI context
export interface AIQuickReply {
    trigger_words: string[];
    response: string;
    is_exact_match?: boolean;
}

// Slogan type for AI context
export interface AISlogan {
    slogan: string;
    usage_context: string;
}

// Notification settings
export interface NotifySettings {
    order: boolean;
    contact: boolean;
    support: boolean;
    cancel: boolean;
}

// Shop policies
export interface ShopPolicies {
    shipping_threshold?: number;
    payment_methods?: string[];
    delivery_areas?: string[];
    return_policy?: string;
}

// Cart types
export interface CartItem {
    id: string;
    product_id: string;
    name: string;
    variant_specs: Record<string, string>;
    quantity: number;
    unit_price: number;
}

export interface Cart {
    id: string;
    items: CartItem[];
    total_amount: number;
}

// Active cart with full item details
export interface ActiveCart {
    id: string;
    items: CartItem[];
    total_amount: number;
}

// Chat context for AI
export interface ChatContext {
    shopId: string;
    customerId?: string;
    shopName: string;
    shopDescription?: string;
    aiInstructions?: string;
    aiEmotion?: AIEmotion;
    products: AIProduct[];
    customerName?: string;
    orderHistory?: number;
    faqs?: AIFAQ[];
    quickReplies?: AIQuickReply[];
    slogans?: AISlogan[];
    notifySettings?: NotifySettings;
    cart?: Cart;
    // Enhanced context for cart system
    shopPolicies?: ShopPolicies;
    customKnowledge?: Record<string, unknown>;
    activeCart?: ActiveCart;
    // AI Memory: stored customer preferences (size, color, style, etc.)
    customerMemory?: Record<string, string | string[] | number>;
    // Plan-based features for dynamic AI behavior
    planFeatures?: {
        ai_model?: 'gemini-2.5-flash-lite' | 'gemini-2.5-flash';
        sales_intelligence?: boolean;
        ai_memory?: boolean;
        max_tokens?: number;  // Dynamic token limit based on plan
    };
}

// Chat message for history
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Image action for product display
export interface ImageAction {
    type: 'single' | 'confirm';
    products: ProductImageData[];
}

export interface ProductImageData {
    name: string;
    price: number;
    imageUrl: string;
    description?: string;
}

// Quick Reply for interactive buttons
export interface QuickReplyOption {
    title: string;      // Display text (max 20 chars)
    payload: string;    // Internal payload for handling
}

// AI Response
export interface ChatResponse {
    text: string;
    imageAction?: ImageAction;
    quickReplies?: QuickReplyOption[];  // Optional quick reply buttons
}

// Tool execution result
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

// Order creation data
export interface CreateOrderData {
    shopId: string;
    customerId: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    items: OrderItemData[];
    notes?: string;
}

export interface OrderItemData {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    variantSpecs?: Record<string, string>;
}
