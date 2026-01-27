import { useQuery } from '@tanstack/react-query';

interface DashboardStats {
    todayOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalCustomers: number;
}

interface RecentOrder {
    id: string;
    status: string;
    total_amount: number;
    created_at: string;
    customer_name: string | null;
}

interface ActiveConversation {
    id: string;
    customer_id: string;
    customer_name: string | null;
    last_message: string | null;
    updated_at: string;
    unread_count: number;
}

interface LowStockProduct {
    id: string;
    name: string;
    stock: number;
    reserved_stock: number;
}

interface DashboardData {
    stats: DashboardStats;
    recentOrders: RecentOrder[];
    activeConversations: ActiveConversation[];
    lowStockProducts: LowStockProduct[];
    unansweredCount: number;
}

export function useDashboard(period: 'today' | 'week' | 'month' = 'today') {
    return useQuery({
        queryKey: ['dashboard', period],
        queryFn: async (): Promise<DashboardData> => {
            const res = await fetch(`/api/dashboard/stats?period=${period}`, {
                headers: {
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || ''
                }
            });
            if (!res.ok) throw new Error('Failed to fetch dashboard data');
            return res.json();
        },
        refetchInterval: 15000, // Refetch every 15 seconds
        staleTime: 10000, // Consider data stale after 10 seconds
    });
}
