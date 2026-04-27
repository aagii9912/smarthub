/**
 * Admin Dashboard API
 * Returns overall statistics for admin dashboard
 */

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export async function GET() {
    try {
        const admin = await getAdminUser();

        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        const nowIso = new Date().toISOString();
        const in3DaysIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        // Get all stats in parallel
        const [
            shopsResult,
            subscriptionsResult,
            plansResult,
            invoicesResult,
            recentShopsResult,
            recentInvoicesResult,
            trialActiveResult,
            trialExpiringSoonResult,
            trialExpiredResult,
        ] = await Promise.all([
            // Total shops
            supabase.from('shops').select('id', { count: 'exact', head: true }),

            // Active subscriptions by status
            supabase.from('subscriptions').select('status'),

            // Plans count
            supabase.from('plans').select('id, name, price_monthly').eq('is_active', true),

            // Invoice stats
            supabase.from('invoices').select('status, amount'),

            // Recent shops (last 7 days)
            supabase.from('shops')
                .select('id, name, created_at')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(5),

            // Recent invoices
            supabase.from('invoices')
                .select('id, amount, status, created_at, shops(name)')
                .order('created_at', { ascending: false })
                .limit(5),

            // Trial: active (status='trial' AND trial_ends_at > now)
            supabase.from('shops')
                .select('id', { count: 'exact', head: true })
                .eq('subscription_status', 'trial')
                .gt('trial_ends_at', nowIso),

            // Trial: expiring soon (active trials, ends within 3 days)
            supabase.from('shops')
                .select('id', { count: 'exact', head: true })
                .eq('subscription_status', 'trial')
                .gt('trial_ends_at', nowIso)
                .lte('trial_ends_at', in3DaysIso),

            // Trial: expired (status='expired_trial' OR trial passed)
            supabase.from('shops')
                .select('id', { count: 'exact', head: true })
                .eq('subscription_status', 'expired_trial'),
        ]);

        // Calculate MRR (Monthly Recurring Revenue)
        const activeSubscriptions = subscriptionsResult.data?.filter(s => s.status === 'active') || [];

        // Calculate subscription stats
        const subscriptionStats = {
            active: activeSubscriptions.length,
            canceled: subscriptionsResult.data?.filter(s => s.status === 'canceled').length || 0,
            past_due: subscriptionsResult.data?.filter(s => s.status === 'past_due').length || 0,
            total: subscriptionsResult.data?.length || 0
        };

        // Calculate revenue stats
        const paidInvoices = invoicesResult.data?.filter(i => i.status === 'paid') || [];
        const pendingInvoices = invoicesResult.data?.filter(i => i.status === 'pending') || [];

        const revenueStats = {
            total_revenue: paidInvoices.reduce((sum, i) => sum + i.amount, 0),
            pending_revenue: pendingInvoices.reduce((sum, i) => sum + i.amount, 0),
            paid_count: paidInvoices.length,
            pending_count: pendingInvoices.length
        };

        const trialStats = {
            active: trialActiveResult.count || 0,
            expiring_soon: trialExpiringSoonResult.count || 0,
            expired: trialExpiredResult.count || 0,
        };

        return NextResponse.json({
            stats: {
                total_shops: shopsResult.count || 0,
                subscriptions: subscriptionStats,
                revenue: revenueStats,
                plans_count: plansResult.data?.length || 0,
                trial: trialStats,
            },
            plans: plansResult.data || [],
            recent_shops: recentShopsResult.data || [],
            recent_invoices: recentInvoicesResult.data || [],
            admin: {
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error: unknown) {
        logger.error('Admin dashboard error:', { error: error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch dashboard data' },
            { status: 500 }
        );
    }
}
