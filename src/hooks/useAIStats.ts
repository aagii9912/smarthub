'use client';

import useSWR from 'swr';

interface AIStats {
    totalConversations: number;
    totalMessages: number;
    tokenUsage: {
        total: number;
        limit: number;
        percent: number;
        remaining: number;
        resetAt: string | null;
    };
    plan: {
        type: string;
        name: string;
        tokensPerMonth: number;
    };
    intentBreakdown: Record<string, number>;
    dailyMessages: Array<{ date: string; count: number }>;
    topCustomers: Array<{
        id: string;
        name: string;
        phone: string | null;
        messageCount: number;
        lastActive: string;
    }>;
    contactsCollected: number;
    emailsCollected: number;
    conversionRate: number;
    period: string;
}

const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch AI stats');
    return res.json();
});

export function useAIStats(period: string = 'month') {
    const { data, error, isLoading, mutate } = useSWR<AIStats>(
        `/api/dashboard/ai-stats?period=${period}`,
        fetcher,
        {
            revalidateOnFocus: false,
            refreshInterval: 60000, // Refresh every minute
        }
    );

    return {
        data,
        error,
        isLoading,
        refetch: mutate,
    };
}
