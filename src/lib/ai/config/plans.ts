/**
 * Syncly AI Plan Configuration - Gemini Family
 * 
 * Billing: Token-based (primary) + message count (analytics)
 * Strategy: Tiered Gemini models per plan
 * - Lite: Gemini 3.1 Flash Lite - ₮89,000/сар - 1M tokens (Chatbot only)
 * - Starter: Gemini 3.1 Flash Lite - ₮179,000/сар - 2.4M tokens
 * - Pro: Gemini 2.5 Flash (stable) - ₮379,000/сар - 12M tokens (better tool calling)
 * - Enterprise: Gemini 2.5 Pro (stable) - Тохиролцоно - 100M tokens (best reasoning)
 */

export type PlanType = 'lite' | 'starter' | 'pro' | 'enterprise';
export type AIProvider = 'gemini';
export type AIModel = 'gemini-3.1-flash-lite-preview' | 'gemini-2.5-flash' | 'gemini-2.5-pro';

// Tool names available for each plan
import type { ToolName } from '../tools/definitions';

/**
 * Plan AI Configuration
 */
export interface PlanAIConfig {
    provider: AIProvider;
    model: AIModel;
    maxTokens: number;
    messagesPerMonth: number;   // Legacy: kept for analytics
    tokensPerMonth: number;     // Primary billing metric
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
        messagesPerMonth: 1000,       // Legacy analytics
        tokensPerMonth: 1_000_000,    // ~1M tokens/month
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
        messagesPerMonth: 2000,       // Legacy analytics
        tokensPerMonth: 2_400_000,    // ~2.4M tokens/month
        maxShops: 1,
        maxProducts: 50,
        price: {
            monthly: { mnt: 179000, usd: 53 },
            yearly: { mnt: 1790000, usd: 527 },
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
        model: 'gemini-2.5-flash',
        maxTokens: 2048,
        messagesPerMonth: 10000,      // Legacy analytics
        tokensPerMonth: 12_000_000,   // ~12M tokens/month
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
        model: 'gemini-2.5-pro',
        maxTokens: 4096,
        messagesPerMonth: 100000,     // Legacy analytics
        tokensPerMonth: 100_000_000,  // ~100M tokens (effectively unlimited)
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
 * Check message limit (legacy — kept for analytics)
 */
export function checkMessageLimit(
    plan: PlanType,
    currentCount: number
): { allowed: boolean; remaining: number; limit: number } {
    const config = getPlanConfig(plan);
    const limit = config.messagesPerMonth;
    const remaining = Math.max(0, limit - currentCount);

    return {
        allowed: currentCount < limit,
        remaining,
        limit,
    };
}

/**
 * Check token limit (primary billing metric)
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
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
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
