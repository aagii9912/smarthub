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

        // Parallel queries
        const [
            chatHistoryRes,
            customerStatsRes,
            dailyMessagesRes,
            topCustomersRes,
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
        });

    } catch (error) {
        logger.error('AI Stats API error:', { error });
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
