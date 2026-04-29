/**
 * AI Types - Centralized type definitions for AI functionality
 */

// AI Emotion/Personality types
export type AIEmotion = 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';

// Product types used in AI context
export type ProductStatus = 'draft' | 'active' | 'pre_order' | 'coming_soon' | 'discontinued';

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
    delivery_type?: 'included' | 'paid' | 'pickup_only';
    delivery_fee?: number;
    colors?: string[];
    sizes?: string[];
    variants?: AIProductVariant[];
    // Lifecycle status used by the AI to explain availability (#8/#9/#10).
    status?: ProductStatus;
    /** When a `coming_soon` product becomes available. */
    available_from?: string | null;
    /** Expected restock date for a `pre_order` product. */
    pre_order_eta?: string | null;
    /** Per-product AI training note (#2). Concatenated with shop-level. */
    ai_instructions?: string | null;
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
    complaints?: boolean;
    payment_received?: boolean;
    payment_failed?: boolean;
    refund?: boolean;
    new_customer?: boolean;
    subscription?: boolean;
    automation?: boolean;
    plan_limit?: boolean;
    low_stock?: boolean;
    import?: boolean;
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
        ai_model?: import('@/lib/ai/config/plans').AIModel;
        sales_intelligence?: boolean;
        ai_memory?: boolean;
        max_tokens?: number;  // Dynamic token limit based on plan
    };
    // Per-field "AI may share with customer" toggles (issue #5b/#5c).
    // Values below are the actual strings to share — only included in the
    // prompt when their corresponding flag is `true`.
    shopPhone?: string;
    shopAddress?: string;
    shopBusinessHours?: string;
    aiShareFlags?: {
        phone?: boolean;
        address?: boolean;
        hours?: boolean;
        policies?: boolean;
        description?: boolean;
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

// Chat Action types for interactive buttons
export type ChatActionType =
    | 'confirmation'     // Тийм/Үгүй баталгаажуулах
    | 'cart_actions'     // Сагсны үйлдлүүд
    | 'payment_method'   // Төлбөрийн хэрэгсэл
    | 'delivery_option'  // Хүргэлтийн сонголт
    | 'order_actions'    // Захиалгын үйлдлүүд
    | 'support_actions'  // Дэмжлэг
    | 'quantity_select'; // Тоо ширхэг

export interface ActionButton {
    id: string;
    label: string;
    icon?: string;       // emoji or lucide icon name
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
    payload: string;     // action trigger payload
    disabled?: boolean;
}

export interface ChatAction {
    type: ChatActionType;
    buttons: ActionButton[];
    context?: Record<string, unknown>; // order_id, product_id гэх мэт
}

// AI Response
export interface ChatResponse {
    text: string;
    imageAction?: ImageAction;
    quickReplies?: QuickReplyOption[];  // Optional quick reply buttons
    actions?: ChatAction[];             // Interactive action buttons
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
    deliveryMethod?: 'delivery' | 'pickup';
    deliveryFee?: number;
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
