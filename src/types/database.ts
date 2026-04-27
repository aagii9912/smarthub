/**
 * Database Types - Matches actual Supabase schema (all migrations applied)
 */

// ============================================
// SHOPS
// ============================================
export interface Shop {
    id: string;
    name: string;
    user_id?: string;
    owner_name: string | null;
    phone: string | null;
    created_at: string;
    // Facebook Integration
    facebook_page_id: string | null;
    facebook_page_name?: string | null;
    facebook_page_access_token?: string | null;
    facebook_page_username?: string | null;
    // Instagram Integration
    instagram_business_account_id?: string | null;
    instagram_access_token?: string | null;
    instagram_username?: string | null;
    // Setup & Status
    setup_completed?: boolean;
    is_active?: boolean;
    // Bank Information
    bank_name?: string | null;
    account_number?: string | null;
    account_name?: string | null;
    register_number?: string | null;
    merchant_type?: 'person' | 'company' | null;
    // AI Settings
    description?: string | null;
    ai_emotion?: string | null;
    ai_instructions?: string | null;
    is_ai_active?: boolean;
    auto_reply?: boolean;
    welcome_message?: string | null;
    custom_knowledge?: Record<string, unknown> | null;
    // AI Analytics
    ai_total_conversations?: number;
    ai_total_messages?: number;
    ai_conversion_rate?: number;
    ai_avg_response_time?: number;
    // Notification Settings
    notify_order?: boolean;
    notify_contact?: boolean;
    notify_support?: boolean;
    notify_cancel?: boolean;
    // Subscription
    subscription_plan?: string | null;
    subscription_status?: string | null;
    subscription_id?: string | null;
    plan_id?: string | null;
    page_access_token?: string | null;
    // Token Usage (billing)
    token_usage_total?: number;
    token_usage_reset_at?: string | null;
    // Legal consent (collected at subscription step)
    terms_accepted_at?: string | null;
    terms_version?: string | null;
    privacy_accepted_at?: string | null;
    privacy_version?: string | null;
    age_confirmed?: boolean;
    marketing_consent?: boolean;
    marketing_consent_at?: string | null;
}

// ============================================
// PRODUCTS
// ============================================
export type ProductType = 'physical' | 'service' | 'appointment';

export interface Product {
    id: string;
    shop_id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number;
    reserved_stock: number;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
    // Enhanced fields
    discount_percent: number | null;
    type: ProductType;
    colors: string[];
    sizes: string[];
    images: string[];
    has_variants?: boolean;
    variants?: ProductVariant[];
    // Appointment-specific
    duration_minutes: number | null;
    available_days: string[] | null;
    start_time: string | null;
    end_time: string | null;
    max_bookings_per_day: number | null;
}

export interface ProductVariant {
    id: string;
    product_id: string;
    sku: string | null;
    name: string;
    options: Record<string, string>;
    price: number | null;
    stock: number;
    is_active: boolean;
}

// ============================================
// CUSTOMERS
// ============================================
export interface Customer {
    id: string;
    shop_id: string;
    facebook_id: string | null;
    instagram_id?: string | null;
    platform?: 'messenger' | 'instagram';
    name: string | null;
    phone: string | null;
    email?: string | null;
    address: string | null;
    notes?: string | null;
    tags?: string[];
    total_orders: number;
    total_spent: number;
    is_vip: boolean;
    created_at: string;
    // AI interaction
    ai_paused_until?: string | null;
    message_count?: number;
    last_message_at?: string | null;
    // Memory
    customer_memory?: Record<string, string | string[] | number> | null;
}

// ============================================
// ORDERS
// ============================================
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
    id: string;
    shop_id: string;
    customer_id: string;
    status: OrderStatus;
    total_amount: number;
    notes: string | null;
    delivery_address: string | null;
    created_at: string;
    updated_at: string;
    // Joined data
    customer?: Customer;
    items?: OrderItem[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    // Joined data
    product?: Product;
}

// ============================================
// CHAT HISTORY
// ============================================
export interface ChatHistory {
    id: string;
    shop_id: string;
    customer_id: string;
    message: string;
    response: string;
    intent?: string | null;
    role?: 'user' | 'assistant';
    created_at: string;
}

// ============================================
// DASHBOARD STATS
// ============================================
export interface DashboardStats {
    todayOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    recentOrders: Order[];
}
