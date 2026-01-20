export interface Shop {
    id: string;
    name: string;
    facebook_page_id: string | null;
    facebook_page_name?: string | null;
    owner_name: string | null;
    phone: string | null;
    created_at: string;
    setup_completed?: boolean;
    is_active?: boolean;
    // Bank information
    bank_name?: string | null;
    account_number?: string | null;
    account_name?: string | null;
}

export interface Product {
    id: string;
    shop_id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Customer {
    id: string;
    shop_id: string;
    facebook_id: string | null;
    name: string | null;
    phone: string | null;
    address: string | null;
    total_orders: number;
    total_spent: number;
    is_vip: boolean;
    created_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
    id: string;
    shop_id: string;
    customer_id: string;
    status: OrderStatus;
    total_amount: number;
    notes: string | null;
    created_at: string;
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

export interface ChatHistory {
    id: string;
    shop_id: string;
    customer_id: string;
    message: string;
    response: string;
    created_at: string;
}

// Dashboard Stats
export interface DashboardStats {
    todayOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    recentOrders: Order[];
}
