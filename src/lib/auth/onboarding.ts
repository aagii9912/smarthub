/**
 * First-login onboarding helpers.
 *
 * Idempotently provisions a user_profiles row + a 3-day Lite trial
 * subscription on first OAuth/email sign-in, so the flow described in the
 * fix for bug #6 (Google sign-in landing on /dashboard with no plan) cannot
 * happen — the auth callback always lands new users on a tier with a
 * known trial end.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

const TRIAL_DAYS = 3;
const DEFAULT_TRIAL_PLAN_SLUG = 'lite';

export interface ProvisionResult {
    /** True if a trial subscription was created in this call (vs. already existed). */
    created: boolean;
    /** Subscription row id if available. */
    subscriptionId: string | null;
    /** Plan slug the user is now on. */
    planSlug: string;
}

/**
 * Ensure the user has a `user_profiles` row and an active trial/subscription.
 *
 * Idempotent: safe to call on every login. Returns immediately if the user
 * already has any non-terminal subscription (active/trialing/past_due/pending).
 *
 * Never throws. Billing must not block sign-in — failures are logged.
 */
export async function provisionNewUserTrial(userId: string, email: string | null): Promise<ProvisionResult> {
    if (!userId) {
        return { created: false, subscriptionId: null, planSlug: 'unpaid' };
    }

    const supabase = supabaseAdmin();

    try {
        // 1. user_profiles is normally created by the on_auth_user_created
        //    trigger; double-check and upsert as a safety net.
        await supabase
            .from('user_profiles')
            .upsert(
                { id: userId, email: email ?? null },
                { onConflict: 'id', ignoreDuplicates: false }
            );

        // 2. Bail if any open subscription already exists for this user.
        const { data: existing } = await supabase
            .from('subscriptions')
            .select('id, status, plans(slug)')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'pending', 'past_due'])
            .limit(1)
            .maybeSingle();

        if (existing) {
            const planJoin = existing.plans as { slug?: string } | { slug?: string }[] | null | undefined;
            const planRow = Array.isArray(planJoin) ? planJoin[0] : planJoin;
            return {
                created: false,
                subscriptionId: existing.id,
                planSlug: planRow?.slug ?? 'unpaid',
            };
        }

        // 3. Resolve the Lite plan id.
        const { data: plan, error: planErr } = await supabase
            .from('plans')
            .select('id, slug')
            .eq('slug', DEFAULT_TRIAL_PLAN_SLUG)
            .eq('is_active', true)
            .maybeSingle();

        if (planErr || !plan) {
            logger.warn('provisionNewUserTrial: lite plan not found, skipping trial', {
                userId,
                error: planErr?.message,
            });
            return { created: false, subscriptionId: null, planSlug: 'unpaid' };
        }

        // 4. Insert the trial subscription. The partial unique index on
        //    user_id (where status IN active/trialing/pending/past_due) means
        //    a concurrent insert would conflict — race is OK because we
        //    already returned early for any open subscription.
        const now = new Date();
        const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

        const { data: sub, error: subErr } = await supabase
            .from('subscriptions')
            .insert({
                user_id: userId,
                plan_id: plan.id,
                status: 'trialing',
                billing_cycle: 'monthly',
                current_period_start: now.toISOString(),
                current_period_end: trialEnd.toISOString(),
                period_anchor_at: now.toISOString(),
                tokens_used_in_period: 0,
            })
            .select('id')
            .single();

        if (subErr) {
            // Most likely cause: a concurrent insert won the partial unique.
            // Re-read once before declaring failure.
            const { data: race } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', userId)
                .in('status', ['active', 'trialing', 'pending', 'past_due'])
                .limit(1)
                .maybeSingle();
            if (race) {
                return { created: false, subscriptionId: race.id, planSlug: plan.slug };
            }
            logger.warn('provisionNewUserTrial: failed to create trial subscription', {
                userId,
                error: subErr.message,
            });
            return { created: false, subscriptionId: null, planSlug: 'unpaid' };
        }

        // 5. Mirror onto the user_profiles snapshot so feature reads are O(1).
        await supabase
            .from('user_profiles')
            .update({
                plan_id: plan.id,
                subscription_plan: plan.slug,
                subscription_status: 'trialing',
                trial_ends_at: trialEnd.toISOString(),
            })
            .eq('id', userId);

        logger.info('provisionNewUserTrial: created lite trial', {
            userId,
            subscriptionId: sub.id,
            trialEnd: trialEnd.toISOString(),
        });

        return { created: true, subscriptionId: sub.id, planSlug: plan.slug };
    } catch (err) {
        logger.error('provisionNewUserTrial: unexpected error', {
            userId,
            error: err instanceof Error ? err.message : String(err),
        });
        return { created: false, subscriptionId: null, planSlug: 'unpaid' };
    }
}

/**
 * Decide where to land an authenticated user after the OAuth callback.
 *
 *  - 0 shops → /setup (kick off onboarding)
 *  - 1+ shops with `setup_completed=true` and a Facebook page connected → /dashboard
 *  - Otherwise (incomplete setup) → /setup
 */
export async function chooseLandingPath(userId: string): Promise<string> {
    if (!userId) return '/auth/login';

    try {
        const supabase = supabaseAdmin();
        const { data: shops, error } = await supabase
            .from('shops')
            .select('id, setup_completed, facebook_page_id, instagram_business_account_id, is_active')
            .eq('user_id', userId)
            .order('setup_completed', { ascending: false })
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: true });

        if (error || !shops || shops.length === 0) {
            return '/setup';
        }

        const ready = shops.find(
            (s) =>
                s.setup_completed === true &&
                (s.facebook_page_id || s.instagram_business_account_id)
        );

        return ready ? '/dashboard' : '/setup';
    } catch (err) {
        logger.warn('chooseLandingPath: falling back to /setup', {
            userId,
            error: err instanceof Error ? err.message : String(err),
        });
        return '/setup';
    }
}
