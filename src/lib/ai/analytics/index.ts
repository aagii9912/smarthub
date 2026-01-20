/**
 * AI Analytics - Conversion Tracking & Tool Usage Analytics
 * Tracks AI tool calls, conversions, and performance metrics
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * Analytics event types
 */
export type AIEventType =
    | 'tool_call'
    | 'tool_success'
    | 'tool_failure'
    | 'cart_add'
    | 'cart_checkout'
    | 'order_created'
    | 'order_cancelled'
    | 'human_support_requested'
    | 'preference_saved'
    | 'product_image_shown'
    | 'hesitation_detected'
    | 'upsell_offered'
    | 'discount_applied';

/**
 * Analytics event data
 */
export interface AIAnalyticsEvent {
    event_type: AIEventType;
    shop_id: string;
    customer_id?: string;
    tool_name?: string;
    product_id?: string;
    product_name?: string;
    amount?: number;
    success: boolean;
    error_message?: string;
    metadata?: Record<string, unknown>;
    response_time_ms?: number;
}

/**
 * Conversion funnel stages
 */
export type FunnelStage =
    | 'browse'           // Viewed products
    | 'interest'         // Asked about specific product
    | 'cart_add'         // Added to cart
    | 'checkout_start'   // Started checkout
    | 'checkout_complete'// Completed checkout
    | 'payment_pending'  // Waiting for payment
    | 'payment_complete';// Payment received

/**
 * Track AI analytics event
 */
export async function trackAIEvent(event: AIAnalyticsEvent): Promise<void> {
    try {
        const supabase = supabaseAdmin();

        await supabase.from('ai_analytics').insert({
            event_type: event.event_type,
            shop_id: event.shop_id,
            customer_id: event.customer_id || null,
            tool_name: event.tool_name || null,
            product_id: event.product_id || null,
            product_name: event.product_name || null,
            amount: event.amount || null,
            success: event.success,
            error_message: event.error_message || null,
            metadata: event.metadata || {},
            response_time_ms: event.response_time_ms || null,
            created_at: new Date().toISOString()
        });

        logger.debug('AI Analytics event tracked:', {
            type: event.event_type,
            success: event.success
        });
    } catch (error) {
        // Don't fail the main operation for analytics
        logger.warn('Failed to track AI analytics:', { error: String(error) });
    }
}

/**
 * Track tool execution with timing
 */
export async function trackToolExecution<T>(
    toolName: string,
    shopId: string,
    customerId: string | undefined,
    executor: () => Promise<T>
): Promise<T> {
    const startTime = Date.now();

    try {
        const result = await executor();
        const responseTime = Date.now() - startTime;

        await trackAIEvent({
            event_type: 'tool_success',
            shop_id: shopId,
            customer_id: customerId,
            tool_name: toolName,
            success: true,
            response_time_ms: responseTime
        });

        return result;
    } catch (error) {
        const responseTime = Date.now() - startTime;

        await trackAIEvent({
            event_type: 'tool_failure',
            shop_id: shopId,
            customer_id: customerId,
            tool_name: toolName,
            success: false,
            error_message: error instanceof Error ? error.message : String(error),
            response_time_ms: responseTime
        });

        throw error;
    }
}

/**
 * Track conversion funnel progression
 */
export async function trackFunnelStage(
    shopId: string,
    customerId: string,
    stage: FunnelStage,
    metadata?: Record<string, unknown>
): Promise<void> {
    const supabase = supabaseAdmin();

    try {
        await supabase.from('conversion_funnel').insert({
            shop_id: shopId,
            customer_id: customerId,
            stage,
            metadata: metadata || {},
            created_at: new Date().toISOString()
        });

        logger.debug('Funnel stage tracked:', { stage, customerId });
    } catch (error) {
        logger.warn('Failed to track funnel stage:', { error: String(error) });
    }
}

/**
 * Get AI performance metrics for a shop
 */
export async function getAIMetrics(shopId: string, days: number = 30): Promise<{
    total_tool_calls: number;
    success_rate: number;
    avg_response_time_ms: number;
    conversion_rate: number;
    top_tools: Array<{ tool: string; count: number }>;
    daily_usage: Array<{ date: string; count: number }>;
}> {
    const supabase = supabaseAdmin();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all analytics for the period
    const { data: analytics, error } = await supabase
        .from('ai_analytics')
        .select('*')
        .eq('shop_id', shopId)
        .gte('created_at', startDate.toISOString());

    if (error || !analytics) {
        logger.error('Failed to fetch AI metrics:', { error });
        return {
            total_tool_calls: 0,
            success_rate: 0,
            avg_response_time_ms: 0,
            conversion_rate: 0,
            top_tools: [],
            daily_usage: []
        };
    }

    // Calculate metrics
    const totalCalls = analytics.filter(a =>
        a.event_type === 'tool_success' || a.event_type === 'tool_failure'
    ).length;

    const successfulCalls = analytics.filter(a =>
        a.event_type === 'tool_success'
    ).length;

    const responseTimes = analytics
        .filter(a => a.response_time_ms)
        .map(a => a.response_time_ms as number);

    const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    // Calculate conversion rate (cart_add to checkout_complete)
    const cartAdds = analytics.filter(a => a.event_type === 'cart_add').length;
    const checkouts = analytics.filter(a => a.event_type === 'cart_checkout').length;
    const conversionRate = cartAdds > 0 ? (checkouts / cartAdds) * 100 : 0;

    // Top tools
    const toolCounts: Record<string, number> = {};
    analytics.forEach(a => {
        if (a.tool_name) {
            toolCounts[a.tool_name] = (toolCounts[a.tool_name] || 0) + 1;
        }
    });

    const topTools = Object.entries(toolCounts)
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Daily usage
    const dailyMap: Record<string, number> = {};
    analytics.forEach(a => {
        const date = new Date(a.created_at).toISOString().split('T')[0];
        dailyMap[date] = (dailyMap[date] || 0) + 1;
    });

    const dailyUsage = Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        total_tool_calls: totalCalls,
        success_rate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
        avg_response_time_ms: Math.round(avgResponseTime),
        conversion_rate: Math.round(conversionRate * 100) / 100,
        top_tools: topTools,
        daily_usage: dailyUsage
    };
}
