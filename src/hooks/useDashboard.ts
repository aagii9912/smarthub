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
    customers: { name: string } | null;
}

interface ActiveConversation {
    customerId: string;
    customerName: string;
    messageCount: number;
    lastMessage: string;
    lastMessageAt: string;
    lastIntent: string | null;
    isAnswered: boolean;
}

interface LowStockProduct {
    id: string;
    name: string;
    stock: number;
    images: string[];
    updated_at?: string;
}

interface PrevStats {
    orders: number;
    revenue: number;
}

interface DashboardTrend {
    orders: number | null;
    revenue: number | null;
}

interface DashboardSeries {
    orders: number[];
    revenue: number[];
    buckets: string[];
}

interface DashboardData {
    stats: DashboardStats;
    prevStats?: PrevStats;
    trend?: DashboardTrend;
    series?: DashboardSeries;
    recentOrders: RecentOrder[];
    activeConversations: ActiveConversation[];
    lowStockProducts: LowStockProduct[];
    unansweredCount: number;
}

export function useDashboard(period: 'today' | 'week' | 'month' = 'today') {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    return useQuery({
        queryKey: ['dashboard', shopId, period],
        queryFn: async (): Promise<DashboardData> => {
            const res = await fetch(`/api/dashboard/stats?period=${period}`, {
                headers: {
                    'x-shop-id': shopId || ''
                }
            });
            if (!res.ok) throw new Error('Failed to fetch dashboard data');
            return res.json();
        },
        refetchInterval: 15000, // Refetch every 15 seconds
        staleTime: 10000, // Consider data stale after 10 seconds
    });
}
