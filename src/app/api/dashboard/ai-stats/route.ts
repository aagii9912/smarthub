/**
 * AI Stats Dashboard API
 * 
 * Returns AI analytics for a shop including:
 * - Conversation & message counts
 * - Token usage with plan limits
 * - Intent breakdown from chat history
 * - Daily message/token trends
 * - Top active customers
 * - Contact collection metrics
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUserShop } from '@/lib/auth/auth';
import {
    getPlanTypeFromSubscription,
    checkTokenLimit,
    checkCreditLimit,
    getPlanConfig,
    getCreditsPerMonth,
} from '@/lib/ai/config/plans';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'month';

        // Auth check using standard helper
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        // Get subscription info
        const { data: shopFull } = await supabase
            .from('shops')
            .select('subscription_plan, subscription_status, token_usage_total, token_usage_reset_at')
            .eq('id', shop.id)
            .single();

        // Calculate date range
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

        const startISO = startDate.toISOString();

        // 30-day window for the per-feature trend chart (independent of `period`)
        const breakdownStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const breakdownStartDate = breakdownStart.toISOString().split('T')[0];
        const periodStartDate = startDate.toISOString().split('T')[0];

        // Parallel queries
        const [
            chatHistoryRes,
            customerStatsRes,
            dailyMessagesRes,
            topCustomersRes,
            breakdownRes,
        ] = await Promise.all([
            // Total conversations & intent breakdown
            supabase
                .from('chat_history')
                .select('id, intent, created_at')
                .eq('shop_id', shop.id)
                .gte('created_at', startISO),

            // Customer stats: phone collected, total customers
            supabase
                .from('customers')
                .select('id, phone, email, message_count, created_at')
                .eq('shop_id', shop.id),

            // Daily message counts (group by date)
            supabase
                .from('chat_history')
                .select('created_at')
                .eq('shop_id', shop.id)
                .gte('created_at', startISO)
                .order('created_at', { ascending: true }),

            // Top customers by message count
            supabase
                .from('customers')
                .select('id, name, phone, message_count, created_at')
                .eq('shop_id', shop.id)
                .order('message_count', { ascending: false })
                .limit(10),

            // Per-feature daily breakdown (last 30 days)
            supabase
                .from('v_shop_token_breakdown')
                .select('usage_date, feature, tokens_used, call_count, label_mn, label_en, sort_order')
                .eq('shop_id', shop.id)
                .gte('usage_date', breakdownStartDate)
                .order('usage_date', { ascending: true }),
        ]);

        // Process chat history for intent breakdown
        const chatHistory = chatHistoryRes.data || [];
        const intentBreakdown: Record<string, number> = {};
        for (const chat of chatHistory) {
            const intent = chat.intent || 'UNKNOWN';
            intentBreakdown[intent] = (intentBreakdown[intent] || 0) + 1;
        }

        // Process daily messages
        const dailyMessages: Array<{ date: string; count: number }> = [];
        const dailyMap = new Map<string, number>();
        for (const msg of dailyMessagesRes.data || []) {
            const date = new Date(msg.created_at).toISOString().split('T')[0];
            dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        }
        for (const [date, count] of dailyMap) {
            dailyMessages.push({ date, count });
        }

        // Customer stats
        const allCustomers = customerStatsRes.data || [];
        const contactsCollected = allCustomers.filter(c => c.phone).length;
        const emailsCollected = allCustomers.filter(c => c.email).length;
        const totalCustomersWithMessages = allCustomers.filter(c => (c.message_count || 0) > 0).length;

        // Token usage
        const planType = getPlanTypeFromSubscription({
            plan: shopFull?.subscription_plan || 'lite',
            status: shopFull?.subscription_status || 'active',
        });
        const planConfig = getPlanConfig(planType);
        const tokensTotal = shopFull?.token_usage_total || 0;
        const tokenCheck = checkTokenLimit(planType, tokensTotal);
        const creditCheck = checkCreditLimit(planType, tokensTotal);

        // Top customers
        const topCustomers = (topCustomersRes.data || []).map(c => ({
            id: c.id,
            name: c.name || 'Нэргүй',
            phone: c.phone,
            messageCount: c.message_count || 0,
            lastActive: c.created_at,
        }));

        // Conversation rate (customers with phone / total chatted customers)
        const conversionRate = totalCustomersWithMessages > 0
            ? Math.round((contactsCollected / totalCustomersWithMessages) * 100)
            : 0;

        // Per-feature breakdown
        interface BreakdownRow {
            usage_date: string;
            feature: string;
            tokens_used: number;
            call_count: number;
            label_mn: string;
            label_en: string;
            sort_order: number;
        }
        const breakdownRows = (breakdownRes.data || []) as BreakdownRow[];

        const currentPeriodMap = new Map<string, BreakdownRow>();
        for (const row of breakdownRows) {
            if (row.usage_date < periodStartDate) continue;
            const existing = currentPeriodMap.get(row.feature);
            if (existing) {
                existing.tokens_used += row.tokens_used;
                existing.call_count += row.call_count;
            } else {
                currentPeriodMap.set(row.feature, { ...row });
            }
        }
        const currentPeriodBreakdown = Array.from(currentPeriodMap.values())
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(row => ({
                feature: row.feature,
                tokens: row.tokens_used,
                calls: row.call_count,
                label_mn: row.label_mn,
                label_en: row.label_en,
            }));

        const dailyMap30 = new Map<string, Record<string, number>>();
        for (const row of breakdownRows) {
            const day = dailyMap30.get(row.usage_date) ?? {};
            day[row.feature] = (day[row.feature] ?? 0) + row.tokens_used;
            dailyMap30.set(row.usage_date, day);
        }
        const last30Days = Array.from(dailyMap30.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, byFeature]) => ({ date, by_feature: byFeature }));

        return NextResponse.json({
            totalConversations: totalCustomersWithMessages,
            totalMessages: chatHistory.length,
            creditUsage: {
                used: creditCheck.used,
                limit: creditCheck.limit,
                percent: creditCheck.usagePercent,
                remaining: creditCheck.remaining,
                resetAt: shopFull?.token_usage_reset_at,
            },
            tokenUsage: {
                total: tokensTotal,
                limit: tokenCheck.limit,
                percent: tokenCheck.usagePercent,
                remaining: tokenCheck.remaining,
                resetAt: shopFull?.token_usage_reset_at,
            },
            plan: {
                type: planType,
                name: planConfig.model,
                tokensPerMonth: planConfig.tokensPerMonth,
                creditsPerMonth: getCreditsPerMonth(planType),
            },
            intentBreakdown,
            dailyMessages,
            topCustomers,
            contactsCollected,
            emailsCollected,
            conversionRate,
            period,
            breakdown: {
                current_period: currentPeriodBreakdown,
                last_30_days: last30Days,
            },
        });

    } catch (error) {
        logger.error('AI Stats API error:', { error });
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
