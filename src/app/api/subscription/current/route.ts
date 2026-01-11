/**
 * Current Subscription API
 * Get current user's subscription status
 */

import { NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const shop = await getUserShop();

        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        // Get subscription with plan details
        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select(`
                *,
                plans (
                    id,
                    name,
                    slug,
                    description,
                    price_monthly,
                    price_yearly,
                    features,
                    limits
                )
            `)
            .eq('shop_id', shop.id)
            .single();

        // Get usage for current period
        const periodStart = new Date();
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);

        const { data: usage } = await supabase
            .from('usage_logs')
            .select('metric_type, count')
            .eq('shop_id', shop.id)
            .gte('created_at', periodStart.toISOString());

        // Aggregate usage
        const usageSummary: Record<string, number> = {};
        if (usage) {
            usage.forEach(u => {
                usageSummary[u.metric_type] = (usageSummary[u.metric_type] || 0) + u.count;
            });
        }

        // Get recent invoices
        const { data: invoices } = await supabase
            .from('invoices')
            .select('id, invoice_number, amount, status, created_at, paid_at')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false })
            .limit(5);

        return NextResponse.json({
            subscription: subscription || null,
            plan: subscription?.plans || null,
            usage: usageSummary,
            invoices: invoices || [],
            has_subscription: !!subscription
        });
    } catch (error: any) {
        console.error('Get subscription error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch subscription' },
            { status: 500 }
        );
    }
}
