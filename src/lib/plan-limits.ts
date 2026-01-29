/**
 * Plan-based feature limits
 * Defines what features are available for each subscription plan
 */

export type PlanType = 'trial' | 'starter' | 'pro' | 'ultimate';

export interface PlanLimits {
    maxShops: number;
    instagram: boolean;
    maxAIMessages: number;
    aiModel: 'nano' | 'mini' | 'full';
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
    trial: {
        maxShops: 1,
        instagram: false,
        maxAIMessages: 100,
        aiModel: 'mini',
    },
    starter: {
        maxShops: 1,
        instagram: false,
        maxAIMessages: 500,
        aiModel: 'nano',
    },
    pro: {
        maxShops: 2,
        instagram: true,
        maxAIMessages: 2000,
        aiModel: 'mini',
    },
    ultimate: {
        maxShops: 5,
        instagram: true,
        maxAIMessages: 10000,
        aiModel: 'full',
    },
};

/**
 * Get plan limits for a given plan type
 */
export function getPlanLimits(plan: string | null | undefined): PlanLimits {
    const planType = (plan?.toLowerCase() || 'trial') as PlanType;
    return PLAN_LIMITS[planType] || PLAN_LIMITS.trial;
}

/**
 * Check if user can add more shops based on plan
 */
export function canAddShop(plan: string | null | undefined, currentShopCount: number): boolean {
    const limits = getPlanLimits(plan);
    return currentShopCount < limits.maxShops;
}

/**
 * Check if Instagram is available for plan
 */
export function canUseInstagram(plan: string | null | undefined): boolean {
    return getPlanLimits(plan).instagram;
}
