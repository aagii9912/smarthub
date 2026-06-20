import { useQuery } from '@tanstack/react-query';
import type { DashboardArchetype } from '@/lib/dashboard/archetypes';

type Period = 'today' | 'week' | 'month' | 'year';

export interface ReportDailyPoint {
    date: string;
    count: number;
    label: string;
}

export interface AppointmentsReport {
    total: number;
    completed: number;
    noShow: number;
    cancelled: number;
    upcoming: number;
    noShowRate: number;
    completionRate: number;
    daily: ReportDailyPoint[];
    byStatus: { pending: number; confirmed: number; completed: number; cancelled: number; no_show: number };
}

export interface LeadsReport {
    newLeads: number;
    qualified: number;
    converted: number;
    conversionRate: number;
    bySource: { messenger: number; instagram: number; other: number };
    daily: ReportDailyPoint[];
}

interface ReportsData {
    archetype?: DashboardArchetype;
    appointments?: AppointmentsReport;
    leads?: LeadsReport;
    revenue: {
        total: number;
        orderCount: number;
        avgOrderValue: number;
        growth: number;
        prevPeriodTotal: number;
        grossTotal: number;
        unpaidTotal: number;
        totalOrderCount: number;
        paymentBreakdown: { paid: number; pending: number; failed: number; refunded: number };
        paymentCounts: { paid: number; pending: number; failed: number; refunded: number };
        codTotal: number;
        prepaidTotal: number;
    };
    bestSellers: Array<{
        id: string;
        name: string;
        image: string | null;
        quantity: number;
        revenue: number;
        rank: number;
        percent: number;
    }>;
    chartData: Array<{
        date: string;
        revenue: number;
        label: string;
    }>;
    customers: {
        total: number;
        new: number;
        vip: number;
    };
    orderStatus: {
        pending: number;
        confirmed: number;
        processing: number;
        shipped: number;
        delivered: number;
        cancelled: number;
    };
}

export function useReports(period: Period = 'month') {
    return useQuery({
        queryKey: ['reports', period],
        queryFn: async (): Promise<ReportsData> => {
            const res = await fetch(`/api/dashboard/reports?period=${period}`);
            if (!res.ok) throw new Error('Failed to fetch reports');
            return res.json();
        },
    });
}
