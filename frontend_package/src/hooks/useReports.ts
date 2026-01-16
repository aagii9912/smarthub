import { useQuery } from '@tanstack/react-query';

type Period = 'today' | 'week' | 'month' | 'year';

interface ReportsData {
    revenue: {
        total: number;
        orderCount: number;
        avgOrderValue: number;
        growth: number;
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
