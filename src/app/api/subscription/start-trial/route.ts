/**
 * Start Trial API
 *
 * Creates an explicit 3-day Lite trial subscription for the authenticated
 * user when they pick "Try free for 3 days" in the setup wizard.
 *
 * Rules:
 *   - 409 if the user already has an open subscription (active/trialing/pending/past_due).
 *   - 403 if the user has previously used a trial (any subscription with
 *     trial_ends_at IS NOT NULL, regardless of current status). This prevents
 *     trial abuse via cancel-and-restart.
 *   - On success, mirrors plan/status onto user_profiles + the user's shops
 *     so middleware and feature gating see the trial immediately.
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';

const TRIAL_DAYS = 3;
const TRIAL_PLAN_SLUG = 'lite';

export async function POST() {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        // 1. Reject if any open subscription already exists.
        const { data: openSub } = await supabase
            .from('subscriptions')
            .select('id, status, plans(slug)')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing', 'pending', 'past_due'])
            .limit(1)
            .maybeSingle();

        if (openSub) {
            return NextResponse.json(
                {
                    error: 'Та аль хэдийн идэвхтэй планаар идэвхжсэн байна.',
                    code: 'subscription_exists',
                },
                { status: 409 }
            );
        }

        // 2. Reject if a previous trial has already been used (any state).
        const { data: prevTrial } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .not('trial_ends_at', 'is', null)
            .limit(1)
            .maybeSingle();

        if (prevTrial) {
            return NextResponse.json(
                {
                    error: 'Та өмнө нь үнэгүй туршилт ашигласан байна. Төлбөртэй план сонгоно уу.',
                    code: 'trial_already_used',
                },
                { status: 403 }
            );
        }

        // 3. Resolve the Lite plan id.
        const { data: plan, error: planErr } = await supabase
            .from('plans')
            .select('id, slug, name')
            .eq('slug', TRIAL_PLAN_SLUG)
            .eq('is_active', true)
            .maybeSingle();

        if (planErr || !plan) {
            logger.error('start-trial: lite plan not found', {
                error: planErr?.message,
                code: planErr?.code,
                details: planErr?.details,
                hint: planErr?.hint,
                userId,
            });
            return NextResponse.json(
                { error: 'Туршилтын план тохируулагдаагүй байна.', code: 'plan_missing' },
                { status: 500 }
            );
        }

        // 4. Insert the trial subscription.
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
                trial_ends_at: trialEnd.toISOString(),
                period_anchor_at: now.toISOString(),
                tokens_used_in_period: 0,
            })
            .select('id')
            .single();

        if (subErr || !sub) {
            logger.error('start-trial: subscription insert failed', {
                error: subErr?.message,
                code: subErr?.code,
                details: subErr?.details,
                hint: subErr?.hint,
                userId,
                planId: plan.id,
            });
            return NextResponse.json(
                { error: 'Туршилт эхлүүлэхэд алдаа гарлаа. Дахин оролдоно уу.', code: 'insert_failed' },
                { status: 500 }
            );
        }

        // 5. Mirror onto user_profiles snapshot (used by middleware paywall).
        await supabase
            .from('user_profiles')
            .update({
                plan_id: plan.id,
                subscription_plan: plan.slug,
                subscription_status: 'trialing',
                trial_ends_at: trialEnd.toISOString(),
            })
            .eq('id', userId);

        // 6. Mirror onto every shop the user owns so per-shop reads also see
        //    the trial. The cron in /api/cron/check-trial-expiry expects
        //    shops.subscription_status='trial' (legacy enum), while
        //    user_profiles uses 'trialing'. Keep the shop value consistent
        //    with what the cron looks for. New shops created later will
        //    inherit the snapshot via the existing shop-creation flow.
        //
        //    Also flip `setup_completed=true` here: starting a trial is the
        //    final wizard step. Without this, sign-out + sign-in routes the
        //    user back to /setup → resume modal at step 9 every time.
        await supabase
            .from('shops')
            .update({
                plan_id: plan.id,
                subscription_plan: plan.slug,
                subscription_status: 'trial',
                trial_ends_at: trialEnd.toISOString(),
                setup_completed: true,
            })
            .eq('user_id', userId);

        // Push notification: trial started (fan-out across user's shops).
        try {
            const { data: ownerShops } = await supabase
                .from('shops')
                .select('id')
                .eq('user_id', userId);
            const trialEndLocale = trialEnd.toLocaleDateString('mn-MN');
            await Promise.all(
                (ownerShops || []).map(async (s: { id: string }) => {
                    try {
                        const enabled = await isNotificationEnabled(s.id, 'subscription');
                        if (!enabled) return;
                        await sendPushNotification(s.id, {
                            title: '🆓 3 хоногийн туршилт эхэллээ',
                            body: `Lite планы 3 хоногийн үнэгүй туршилт ${trialEndLocale} хүртэл идэвхтэй.`,
                            url: '/dashboard/subscription',
                            tag: `trial-started-${userId}`,
                        });
                    } catch (innerErr) {
                        logger.warn('Trial-started push failed for shop', {
                            shop_id: s.id,
                            error: innerErr instanceof Error ? innerErr.message : String(innerErr),
                        });
                    }
                })
            );
        } catch (pushErr) {
            logger.warn('Trial-started push notification failed (non-fatal)', {
                user_id: userId,
                error: pushErr instanceof Error ? pushErr.message : String(pushErr),
            });
        }

        return NextResponse.json({
            success: true,
            subscription_id: sub.id,
            plan_slug: plan.slug,
            plan_name: plan.name,
            trial_ends_at: trialEnd.toISOString(),
        });
    } catch (err: unknown) {
        logger.error('start-trial: unexpected error', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
        return NextResponse.json(
            { error: 'Туршилт эхлүүлэхэд алдаа гарлаа.', code: 'unexpected' },
            { status: 500 }
        );
    }
}
