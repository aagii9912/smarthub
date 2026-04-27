/**
 * Syncly AI Plan Configuration - Gemini Family
 *
 * Billing: Credit-based (user-facing) / Token-based (backend accounting)
 *   1 credit = 1000 tokens (see TOKENS_PER_CREDIT)
 *
 * Strategy: Tiered Gemini models per plan
 * - Lite: Gemini 3.1 Flash Lite - ₮89,000/сар - 5,000 credits (Chatbot only)
 * - Starter: Gemini 3.1 Flash Lite - ₮149,000/сар - 8,500 credits
 * - Pro: Gemini 3.1 Flash Lite - ₮379,000/сар - 21,000 credits (better tool calling)
 * - Enterprise: Gemini 3.1 Flash Lite - Тохиролцоно - 100,000 credits
 *
 * Per-customer `customers.message_count` is analytics-only and NOT part of billing.
 */

/**
 * Conversion rate between user-facing credits and backend tokens.
 * Change with care — existing plan sizing assumes 1000.
 */
export const TOKENS_PER_CREDIT = 1000;

export function tokensToCredits(tokens: number): number {
    return Math.ceil(tokens / TOKENS_PER_CREDIT);
}

export function creditsToTokens(credits: number): number {
    return credits * TOKENS_PER_CREDIT;
}

export type PlanType = 'lite' | 'starter' | 'pro' | 'enterprise';
export type AIProvider = 'gemini';
export type AIModel = 'gemini-3.1-flash-lite-preview';

// Tool names available for each plan
import type { ToolName } from '../tools/definitions';

/**
 * Plan AI Configuration
 */
export interface PlanAIConfig {
    provider: AIProvider;
    model: AIModel;
    maxTokens: number;
    tokensPerMonth: number;     // Backend accounting — user-facing value is credits (tokensPerMonth / TOKENS_PER_CREDIT)
    maxShops: number;
    maxProducts: number;
    price: {
        monthly: { mnt: number; usd: number };
        yearly: { mnt: number; usd: number };
    };
    features: {
        // AI Core
        toolCalling: boolean;
        vision: boolean;
        memory: boolean;
        salesIntelligence: boolean;

        // Modules
        cartSystem: 'none' | 'basic' | 'full';
        paymentIntegration: boolean;
        crmAnalytics: 'none' | 'basic' | 'advanced' | 'full';

        // Tools
        autoTagging: boolean;
        appointmentBooking: boolean;
        bulkMarketing: boolean;
        excelExport: boolean;
        customBranding: boolean;
        commentReply: boolean;
        prioritySupport: boolean;
        personalManager: boolean;
    };
    enabledTools: ToolName[];
}

/**
 * Plan configurations (matching landing page exactly)
 */
export const PLAN_CONFIGS: Record<PlanType, PlanAIConfig> = {
    lite: {
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite-preview',
        maxTokens: 300,
        tokensPerMonth: 5_000_000,    // ~5M tokens/month ≈ 5,000 credits
        maxShops: 1,
        maxProducts: 20,
        price: {
            monthly: { mnt: 89000, usd: 26 },
            yearly: { mnt: 890000, usd: 262 },
        },
        features: {
            // AI Core
            toolCalling: true,
            vision: false,
            memory: false,
            salesIntelligence: false,

            // Modules
            cartSystem: 'none',
            paymentIntegration: false,
            crmAnalytics: 'none',

            // Tools
            autoTagging: false,
            appointmentBooking: false,
            bulkMarketing: false,
            excelExport: false,
            customBranding: false,
            commentReply: false,
            prioritySupport: false,
            personalManager: false,
        },
        enabledTools: [
            'show_product_image',
            'collect_contact_info',
        ],
    },

    starter: {
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite-preview',
        maxTokens: 500,
        tokensPerMonth: 8_500_000,    // ~8.5M tokens/month ≈ 8,500 credits
        maxShops: 1,
        maxProducts: 50,
        price: {
            monthly: { mnt: 149000, usd: 44 },
            yearly: { mnt: 1788000, usd: 526 },
        },
        features: {
            // AI Core
            toolCalling: true,
            vision: true,
            memory: false,
            salesIntelligence: false,

            // Modules
            cartSystem: 'basic',
            paymentIntegration: true,
            crmAnalytics: 'none',

            // Tools
            autoTagging: false,
            appointmentBooking: false,
            bulkMarketing: false,
            excelExport: false,
            customBranding: false,
            commentReply: false,
            prioritySupport: false,
            personalManager: false,
        },
        enabledTools: [
            'add_to_cart',
            'view_cart',
            'remove_from_cart',
            'checkout',
            'create_order',
            'show_product_image',
            'collect_contact_info',
            'check_order_status',
        ],
    },

    pro: {
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite-preview',
        maxTokens: 800,
        tokensPerMonth: 21_000_000,   // ~21M tokens/month ≈ 21,000 credits
        maxShops: 3,
        maxProducts: 300,
        price: {
            monthly: { mnt: 379000, usd: 112 },
            yearly: { mnt: 3379000, usd: 995 },
        },
        features: {
            // AI Core
            toolCalling: true,
            vision: true,
            memory: true,
            salesIntelligence: true,

            // Modules
            cartSystem: 'full',
            paymentIntegration: true,
            crmAnalytics: 'advanced',

            // Tools
            autoTagging: true,
            appointmentBooking: false,
            bulkMarketing: false,
            excelExport: true,
            customBranding: false,
            commentReply: true,
            prioritySupport: false,
            personalManager: false,
        },
        enabledTools: [
            'add_to_cart',
            'view_cart',
            'remove_from_cart',
            'checkout',
            'create_order',
            'cancel_order',
            'show_product_image',
            'collect_contact_info',
            'request_human_support',
            'remember_preference',
            'check_order_status',
            'log_complaint',
            'suggest_related_products',
        ],
    },

    enterprise: {
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite-preview',
        maxTokens: 1500,
        tokensPerMonth: 100_000_000,  // ~100M tokens (effectively unlimited) ≈ 100,000 credits
        maxShops: 1000,           // Effectively unlimited
        maxProducts: 100000,      // Effectively unlimited
        price: {
            monthly: { mnt: 0, usd: 0 }, // Custom pricing
            yearly: { mnt: 0, usd: 0 },
        },
        features: {
            // AI Core
            toolCalling: true,
            vision: true,
            memory: true,
            salesIntelligence: true,

            // Modules
            cartSystem: 'full',
            paymentIntegration: true,
            crmAnalytics: 'full',

            // Tools
            autoTagging: true,
            appointmentBooking: true,
            bulkMarketing: true,
            excelExport: true,
            customBranding: true,
            commentReply: true,
            prioritySupport: true,
            personalManager: true,
        },
        enabledTools: [
            'add_to_cart',
            'view_cart',
            'remove_from_cart',
            'checkout',
            'create_order',
            'cancel_order',
            'show_product_image',
            'collect_contact_info',
            'request_human_support',
            'remember_preference',
            'check_payment_status',
            'check_order_status',
            'check_delivery_status',
            'log_complaint',
            'suggest_related_products',
            'update_order',
        ],
    },
};

/**
 * Get plan config by plan type
 */
export function getPlanConfig(plan: PlanType): PlanAIConfig {
    return PLAN_CONFIGS[plan] || PLAN_CONFIGS.starter;
}

/**
 * Get plan type from subscription status
 */
export function getPlanTypeFromSubscription(subscription?: {
    plan?: string;
    status?: string;
}): PlanType {
    if (!subscription || subscription.status !== 'active') {
        return 'lite'; // Default to lite (cheapest plan)
    }

    const planName = subscription.plan?.toLowerCase();

    if (planName === 'enterprise') {
        return 'enterprise';
    }
    if (planName === 'pro' || planName === 'professional') {
        return 'pro';
    }
    if (planName === 'starter') {
        return 'starter';
    }
    if (planName === 'lite' || planName === 'basic' || planName === 'chatbot') {
        return 'lite';
    }

    return 'lite'; // Default to lite
}

/**
 * Check if a tool is enabled for a plan
 */
export function isToolEnabledForPlan(toolName: ToolName, plan: PlanType): boolean {
    const config = getPlanConfig(plan);
    return config.enabledTools.includes(toolName);
}

/**
 * Get enabled tools for a plan
 */
export function getEnabledToolsForPlan(plan: PlanType): ToolName[] {
    return getPlanConfig(plan).enabledTools;
}

/**
 * Credits available per month for a plan (user-facing billing unit).
 */
export function getCreditsPerMonth(plan: PlanType): number {
    return Math.floor(getPlanConfig(plan).tokensPerMonth / TOKENS_PER_CREDIT);
}

/**
 * Check token limit (backend accounting — exact cost).
 */
export function checkTokenLimit(
    plan: PlanType,
    currentTokens: number
): { allowed: boolean; remaining: number; limit: number; usagePercent: number } {
    const config = getPlanConfig(plan);
    const limit = config.tokensPerMonth;
    const remaining = Math.max(0, limit - currentTokens);
    const usagePercent = limit > 0 ? Math.min(100, Math.round((currentTokens / limit) * 100)) : 0;

    return {
        allowed: currentTokens < limit,
        remaining,
        limit,
        usagePercent,
    };
}

/**
 * Check credit limit (user-facing billing unit).
 * Wraps checkTokenLimit — tokens are the authoritative backend value.
 */
export function checkCreditLimit(
    plan: PlanType,
    currentTokens: number
): { allowed: boolean; remaining: number; limit: number; used: number; usagePercent: number } {
    const tokenCheck = checkTokenLimit(plan, currentTokens);
    return {
        allowed: tokenCheck.allowed,
        used: tokensToCredits(currentTokens),
        remaining: Math.floor(tokenCheck.remaining / TOKENS_PER_CREDIT),
        limit: getCreditsPerMonth(plan),
        usagePercent: tokenCheck.usagePercent,
    };
}

/**
 * Check shop limit
 */
export function checkShopLimit(
    plan: PlanType,
    currentCount: number
): { allowed: boolean; remaining: number; limit: number } {
    const config = getPlanConfig(plan);
    const limit = config.maxShops;
    const remaining = Math.max(0, limit - currentCount);

    return {
        allowed: currentCount < limit,
        remaining,
        limit,
    };
}

/**
 * Model display names for UI
 */
export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
    'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite',
};

/**
 * Plan display names for UI
 */
export const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
    lite: 'Lite',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
};
