/**
 * Trial Expiry Cron
 *
 * Runs daily. Finds shops where:
 *   - subscription_status = 'trial'
 *   - trial_ends_at < NOW()
 *
 * Flips them to:
 *   - subscription_status = 'expired_trial'
 *   - trial_expired_at = NOW()
 *   - is_ai_active = false  (belt-and-suspenders: stops AI immediately)
 *
 * The runtime trial gate in AIRouter.routeToAI also blocks expired trials
 * within the gap between actual expiry and this cron firing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    try {
        if (process.env.NODE_ENV === 'production' && CRON_SECRET) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${CRON_SECRET}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabase = supabaseAdmin();
        const now = new Date();
        const nowIso = now.toISOString();
        const threeDaysFromNowIso = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const oneDayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // ── Trial ending in ≤3 days — remind once per 24h via trial_ending_notified_at ──
        let endingNotified = 0;
        try {
            const { data: endingShops, error: endingErr } = await supabase
                .from('shops')
                .select('id, trial_ends_at, trial_ending_notified_at')
                .eq('subscription_status', 'trial')
                .gt('trial_ends_at', nowIso)
                .lte('trial_ends_at', threeDaysFromNowIso)
                .or(`trial_ending_notified_at.is.null,trial_ending_notified_at.lt.${oneDayAgoIso}`);
            if (endingErr) {
                logger.warn('check-trial-expiry: failed to query ending-soon trials', {
                    error: endingErr.message,
                });
            } else if (endingShops && endingShops.length > 0) {
                for (const shop of endingShops as Array<{
                    id: string;
                    trial_ends_at: string | null;
                }>) {
                    try {
                        const enabled = await isNotificationEnabled(shop.id, 'subscription');
                        if (!enabled) continue;
                        const endsAt = shop.trial_ends_at ? new Date(shop.trial_ends_at) : null;
                        const daysLeft = endsAt
                            ? Math.max(
                                  1,
                                  Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                              )
                            : 3;
                        await sendPushNotification(shop.id, {
                            title: '⏰ Туршилт удахгүй дуусна',
                            body: `${daysLeft} хоногийн дотор туршилт дуусна. План сонгож үргэлжлүүлнэ үү.`,
                            url: '/dashboard/subscription',
                            tag: `trial-ending-${shop.id}`,
                        });
                        await supabase
                            .from('shops')
                            .update({ trial_ending_notified_at: nowIso })
                            .eq('id', shop.id);
                        endingNotified++;
                    } catch (innerErr) {
                        logger.warn('Trial-ending push failed for shop', {
                            shop_id: shop.id,
                            error: innerErr instanceof Error ? innerErr.message : String(innerErr),
                        });
                    }
                }
            }
        } catch (endingPushErr) {
            logger.warn('Trial-ending notification block failed (non-fatal)', {
                error: endingPushErr instanceof Error ? endingPushErr.message : String(endingPushErr),
            });
        }

        const { data: expired, error } = await supabase
            .from('shops')
            .update({
                subscription_status: 'expired_trial',
                trial_expired_at: nowIso,
                is_ai_active: false,
            })
            .eq('subscription_status', 'trial')
            .lt('trial_ends_at', nowIso)
            .select('id, name, user_id, trial_ends_at');

        if (error) {
            logger.error('Failed to expire trials', { error: error.message });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const count = expired?.length || 0;

        if (count > 0) {
            logger.success(`Expired ${count} trial shop(s)`, {
                shopIds: expired?.map(s => s.id),
            });

            // ── Push: trial expired ──
            for (const shop of expired || []) {
                try {
                    const enabled = await isNotificationEnabled(shop.id, 'subscription');
                    if (!enabled) continue;
                    await sendPushNotification(shop.id, {
                        title: '⌛ Туршилт дууслаа',
                        body: 'Үнэгүй туршилтын хугацаа дууслаа. Үргэлжлүүлэхийн тулд төлбөртэй планыг сонгоно уу.',
                        url: '/dashboard/subscription',
                        tag: `trial-expired-${shop.id}`,
                    });
                } catch (innerErr) {
                    logger.warn('Trial-expired push failed for shop', {
                        shop_id: shop.id,
                        error: innerErr instanceof Error ? innerErr.message : String(innerErr),
                    });
                }
            }
        }

        // Roll the per-user token pool over for any user whose 30-day window
        // has elapsed. The RPC is idempotent: it only acts on rows where
        // period_anchor_at is NULL or > 30 days old.
        const { data: dueSubs, error: dueErr } = await supabase
            .from('subscriptions')
            .select('user_id')
            .in('status', ['active', 'trialing', 'pending', 'past_due'])
            .or(`period_anchor_at.is.null,period_anchor_at.lt.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`);

        let resetCount = 0;
        if (dueErr) {
            logger.warn('check-trial-expiry: failed to enumerate subs for token reset', { error: dueErr.message });
        } else if (dueSubs && dueSubs.length > 0) {
            const uniqueUserIds = Array.from(new Set(dueSubs.map(s => s.user_id).filter(Boolean) as string[]));
            for (const uid of uniqueUserIds) {
                const { error: rpcErr } = await supabase.rpc('reset_user_token_pool_if_due', { p_user_id: uid });
                if (!rpcErr) resetCount++;
            }
            if (resetCount > 0) {
                logger.success(`Reset token pool for ${resetCount} user(s)`);
            }
        }

        return NextResponse.json({
            success: true,
            expired_count: count,
            ending_notified_count: endingNotified,
            expired_shops: expired?.map(s => ({ id: s.id, name: s.name })) ?? [],
            token_pool_resets: resetCount,
            checked_at: nowIso,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('check-trial-expiry crashed', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
