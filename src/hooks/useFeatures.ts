/**
 * useFeatures Hook - Access current shop's features and limits
 */

'use client';

import useSWR from 'swr';

interface Features {
    ai_enabled: boolean;
    ai_model: 'gpt-4o-mini' | 'gpt-4o';
    sales_intelligence: boolean;
    ai_memory: boolean;
    cart_system: 'none' | 'basic' | 'full';
    payment_integration: boolean;
    crm_analytics: 'none' | 'basic' | 'advanced' | 'full';
    auto_tagging: boolean;
    appointment_booking: boolean;
    bulk_marketing: boolean;
    excel_export: boolean;
    custom_branding: boolean;
    comment_reply: boolean;
    priority_support: boolean;
}

interface Limits {
    max_messages: number;
    max_shops: number;
    max_products: number;
    max_customers: number;
}

interface Plan {
    slug: string;
    name: string;
}

interface Usage {
    messages_count: number;
    shops_count: number;
    products_count: number;
}

interface FeaturesResponse {
    features: Features;
    limits: Limits;
    usage?: Usage;
    plan: Plan;
    shopId?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useFeatures() {
    const { data, error, isLoading, mutate } = useSWR<FeaturesResponse>(
        '/api/features',
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60000, // Cache for 1 minute
        }
    );

    /**
     * Check if a feature is enabled
     */
    const hasFeature = (key: keyof Features): boolean => {
        if (!data?.features) return false;
        const value = data.features[key];

        // Handle boolean features
        if (typeof value === 'boolean') return value;

        // Handle string features (none = disabled)
        if (typeof value === 'string') return value !== 'none';

        return false;
    };

    /**
     * Get the value of a feature (for non-boolean features like cart_system)
     */
    const getFeatureValue = <K extends keyof Features>(key: K): Features[K] | undefined => {
        return data?.features?.[key];
    };

    /**
     * Get a limit value
     */
    const getLimit = (key: keyof Limits): number => {
        const value = data?.limits?.[key];
        // -1 means unlimited
        if (value === -1) return Infinity;
        return value ?? 0;
    };

    /**
     * Check if a limit has been reached
     * @param key - Limit key
     * @param currentUsage - Current usage count
     */
    const isLimitReached = (key: keyof Limits, currentUsage: number): boolean => {
        const limit = getLimit(key);
        if (limit === Infinity) return false;
        return currentUsage >= limit;
    };

    /**
     * Get current plan info
     */
    const plan = data?.plan || { slug: 'free', name: 'Free' };

    /**
     * Check if user is on a paid plan
     */
    const isPaidPlan = plan.slug !== 'free';

    /**
     * Check if user is on Pro or higher
     */
    const isProOrHigher = ['professional', 'pro', 'enterprise', 'ultimate'].includes(plan.slug);

    return {
        features: data?.features,
        limits: data?.limits,
        plan,
        shopId: data?.shopId,
        isLoading,
        error,
        hasFeature,
        getFeatureValue,
        getLimit,
        isLimitReached,
        isPaidPlan,
        isProOrHigher,
        refresh: mutate,
        usage: data?.usage
    };
}

export type { Features, Limits, Plan, FeaturesResponse, Usage };
