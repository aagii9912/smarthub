import { useQuery } from '@tanstack/react-query';
import type { DashboardArchetype } from '@/lib/dashboard/archetypes';

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

interface RelatedName {
    name: string | null;
    phone?: string | null;
}

export interface UpcomingAppointment {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    customers: RelatedName | RelatedName[] | null;
    products: RelatedName | RelatedName[] | null;
}

export interface AppointmentsBlock {
    stats: { periodCount: number; upcomingCount: number; completedCount: number; noShowRate: number; peakHour: number | null };
    series: number[];
    byHour: number[];
    byWeekday: number[];
    statusBreakdown: { pending: number; confirmed: number; completed: number; cancelled: number; no_show: number };
    upcoming: UpcomingAppointment[];
}

export interface RecentLead {
    id: string;
    name: string | null;
    phone: string | null;
    created_at: string;
    total_orders: number | null;
    is_vip: boolean | null;
}

export interface FollowUpLead {
    id: string;
    name: string | null;
    phone: string | null;
    last_contact_at: string | null;
}

export interface LeadsBlock {
    stats: { newLeads: number; qualified: number; converted: number; conversionRate: number };
    bySource: { messenger: number; instagram: number; other: number };
    recent: RecentLead[];
    followUp: { count: number; items: FollowUpLead[] };
}

export interface CartFunnelBlock {
    active: number;
    converted: number;
    abandoned: number;
    conversionRate: number;
}

interface DashboardData {
    stats: DashboardStats;
    archetype?: DashboardArchetype;
    appointments?: AppointmentsBlock;
    leads?: LeadsBlock;
    cartFunnel?: CartFunnelBlock;
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
