/**
 * User-scoped billing snapshot.
 *
 * One plan per user, one rolling 30-day token pool shared across all of the
 * user's shops. Reads from `subscriptions` (authoritative) and falls back to
 * the denormalized snapshot on `user_profiles` when no live subscription exists.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export interface UserBillingSnapshot {
    userId: string;
    plan: string;          // slug: 'lite' | 'starter' | 'pro' | 'enterprise' | 'unpaid' …
    status: string;        // 'active' | 'trial' | 'trialing' | 'expired_trial' | 'past_due' | 'unpaid'
    trialEndsAt: string | null;
    tokensUsed: number;
    tokensLimit: number | null;     // null = unknown (no plan match)
    periodAnchorAt: string | null;
    daysUntilReset: number | null;  // null when there's no anchor
}

/**
 * Reads the active subscription + plan limits for a user. Triggers the lazy
 * 30-day reset RPC so callers always observe a fresh window.
 *
 * Never throws — billing reads must not break the AI hot path. Returns an
 * "unpaid" snapshot on error.
 */
export async function getUserBilling(userId: string): Promise<UserBillingSnapshot> {
    const fallback: UserBillingSnapshot = {
        userId,
        plan: 'unpaid',
        status: 'unpaid',
        trialEndsAt: null,
        tokensUsed: 0,
        tokensLimit: null,
        periodAnchorAt: null,
        daysUntilReset: null,
    };

    if (!userId) return fallback;

    try {
        const supabase = supabaseAdmin();

        // Lazy reset; ignore errors so legacy envs still serve reads.
        await supabase.rpc('reset_user_token_pool_if_due', { p_user_id: userId }).then(({ error }) => {
            if (error) logger.debug('reset_user_token_pool_if_due unavailable', { msg: error.message });
        });

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('subscription_plan, subscription_status, trial_ends_at, plan_id')
            .eq('id', userId)
            .maybeSingle();

        const { data: sub } = await supabase
            .from('subscriptions')
            .select('id, plan_id, status, period_anchor_at, tokens_used_in_period, plans(slug, limits)')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'pending', 'past_due'])
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const plansJoin = sub?.plans as { slug?: string; limits?: Record<string, unknown> } | { slug?: string; limits?: Record<string, unknown> }[] | null | undefined;
        const planRow = Array.isArray(plansJoin) ? plansJoin[0] : plansJoin;

        const planSlug =
            planRow?.slug ||
            profile?.subscription_plan ||
            'unpaid';

        const status =
            sub?.status ||
            profile?.subscription_status ||
            'unpaid';

        const limits = (planRow?.limits || {}) as Record<string, unknown>;
        const tokensLimitRaw = limits['tokens_per_month'];
        const tokensLimit =
            typeof tokensLimitRaw === 'number'
                ? tokensLimitRaw
                : typeof tokensLimitRaw === 'string'
                    ? Number(tokensLimitRaw)
                    : null;

        const periodAnchorAt = sub?.period_anchor_at || null;
        let daysUntilReset: number | null = null;
        if (periodAnchorAt) {
            const anchor = new Date(periodAnchorAt).getTime();
            const elapsedDays = (Date.now() - anchor) / (1000 * 60 * 60 * 24);
            daysUntilReset = Math.max(0, Math.ceil(30 - elapsedDays));
        }

        return {
            userId,
            plan: planSlug,
            status,
            trialEndsAt: profile?.trial_ends_at || null,
            tokensUsed: Number(sub?.tokens_used_in_period || 0),
            tokensLimit: Number.isFinite(tokensLimit) ? (tokensLimit as number) : null,
            periodAnchorAt,
            daysUntilReset,
        };
    } catch (err) {
        logger.error('getUserBilling failed', { userId, err: err instanceof Error ? err.message : String(err) });
        return fallback;
    }
}
