/**
 * First-login onboarding helpers.
 *
 * Ensures a `user_profiles` row exists for every authenticated user.
 *
 * The 3-day Lite trial is now opt-in via the setup wizard's plan-selection
 * step (`POST /api/subscription/start-trial`). New users land at /setup and
 * choose between starting a trial or paying for a plan. This function no
 * longer creates a subscription — it only provisions the profile row.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export interface ProvisionResult {
    /** True if a trial subscription was created in this call (vs. already existed). */
    created: boolean;
    /** Subscription row id if available. */
    subscriptionId: string | null;
    /** Plan slug the user is now on. */
    planSlug: string;
}

/**
 * Ensure the user has a `user_profiles` row.
 *
 * Idempotent: safe to call on every login. The function name is preserved
 * for call-site compatibility, but trial creation now happens explicitly via
 * the start-trial endpoint. Returns the existing subscription metadata if any.
 *
 * Never throws. Failures are logged but never block sign-in.
 */
export async function provisionNewUserTrial(userId: string, email: string | null): Promise<ProvisionResult> {
    if (!userId) {
        return { created: false, subscriptionId: null, planSlug: 'unpaid' };
    }

    const supabase = supabaseAdmin();

    try {
        // user_profiles is normally created by the on_auth_user_created
        // trigger; double-check and upsert as a safety net.
        await supabase
            .from('user_profiles')
            .upsert(
                { id: userId, email: email ?? null },
                { onConflict: 'id', ignoreDuplicates: false }
            );

        // Report whatever subscription the user already has, if any.
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

        return { created: false, subscriptionId: null, planSlug: 'unpaid' };
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
 *  - 1+ shops with `setup_completed=true` → /dashboard
 *  - Active subscription (paid OR trialing) → /dashboard (fallback for
 *    legacy users whose `setup_completed` flag wasn't backfilled when
 *    they started their trial)
 *  - Otherwise (incomplete setup) → /setup
 *
 * Service & beauty businesses can finish onboarding without connecting
 * Facebook/Instagram, so we trust `setup_completed` alone.
 */
export async function chooseLandingPath(userId: string): Promise<string> {
    if (!userId) return '/auth/login';

    try {
        const supabase = supabaseAdmin();
        const { data: shops, error } = await supabase
            .from('shops')
            .select('id, setup_completed, is_active')
            .eq('user_id', userId)
            .order('setup_completed', { ascending: false })
            .order('is_active', { ascending: false })
            .order('created_at', { ascending: true });

        if (error || !shops || shops.length === 0) {
            return '/setup';
        }

        const ready = shops.find((s) => s.setup_completed === true);
        if (ready) return '/dashboard';

        // Fallback: if the user has an active or trialing subscription, the
        // wizard's final step has effectively been completed even if the
        // flag wasn't set. Send them to /dashboard.
        const { data: openSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'past_due'])
            .limit(1)
            .maybeSingle();

        if (openSub) return '/dashboard';

        return '/setup';
    } catch (err) {
        logger.warn('chooseLandingPath: falling back to /setup', {
            userId,
            error: err instanceof Error ? err.message : String(err),
        });
        return '/setup';
    }
}
