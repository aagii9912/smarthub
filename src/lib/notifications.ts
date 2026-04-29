import webpush from 'web-push';
import * as Sentry from '@sentry/nextjs';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

let vapidConfigured = false;
let vapidWarningSent = false;

function ensureVapidConfigured(): boolean {
    if (vapidConfigured) return true;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@smarthub.mn';

    if (vapidPublicKey && vapidPrivateKey) {
        try {
            // web-push tolerates URL-safe base64 with or without padding —
            // don't strip `=` here, that historically corrupted standard-base64 keys.
            const cleanPublicKey = vapidPublicKey.trim();
            const cleanPrivateKey = vapidPrivateKey.trim();
            const cleanEmail = vapidEmail.trim();

            webpush.setVapidDetails(cleanEmail, cleanPublicKey, cleanPrivateKey);
            vapidConfigured = true;
            return true;
        } catch (error: unknown) {
            logger.error('Failed to configure VAPID', { error });
            Sentry.captureException(error, { tags: { area: 'push.vapid' } });
            return false;
        }
    }
    return false;
}

export interface NotificationPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    actions?: Array<{ action: string; title: string }>;
}

export interface PushError {
    endpoint: string;
    statusCode?: number;
    message: string;
}

export type SendResult =
    | { ok: true; succeeded: number; failed: number; errors: PushError[] }
    | {
          ok: false;
          reason: 'vapid_not_configured' | 'db_error' | 'no_subscriptions';
          succeeded: 0;
          failed: 0;
          errors: [];
      };

/**
 * Verbose variant of sendPushNotification that returns a discriminated result.
 * Diagnostic endpoints and admin tooling should use this instead of the
 * back-compat `sendPushNotification` wrapper, so they can tell apart
 * "no VAPID config" from "no subscriptions" from "all sends failed".
 */
export async function sendPushNotificationVerbose(
    shopId: string,
    payload: NotificationPayload
): Promise<SendResult> {
    if (!ensureVapidConfigured()) {
        logger.warn('Push notification skipped: VAPID not configured');
        if (!vapidWarningSent) {
            vapidWarningSent = true;
            Sentry.captureMessage('VAPID not configured at send time', 'error');
        }
        return { ok: false, reason: 'vapid_not_configured', succeeded: 0, failed: 0, errors: [] };
    }

    const supabase = supabaseAdmin();

    logger.debug('sendPushNotification called', { shopId, payload });

    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('id, shop_id, endpoint, p256dh, auth, created_at')
        .eq('shop_id', shopId);

    if (error) {
        logger.error('Push notification database error', { error });
        Sentry.captureException(error, { tags: { area: 'push.db' }, extra: { shopId } });
        return { ok: false, reason: 'db_error', succeeded: 0, failed: 0, errors: [] };
    }

    if (!subscriptions || subscriptions.length === 0) {
        logger.debug('No push subscriptions found', { shopId });
        return { ok: false, reason: 'no_subscriptions', succeeded: 0, failed: 0, errors: [] };
    }

    let succeeded = 0;
    let failed = 0;
    const errors: PushError[] = [];
    const nowIso = new Date().toISOString();

    for (const sub of subscriptions) {
        try {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            succeeded++;
            await supabase
                .from('push_subscriptions')
                .update({ last_used_at: nowIso, failure_count: 0 })
                .eq('id', sub.id);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            const statusCode = (err as { statusCode?: number })?.statusCode;
            logger.error('Push notification failed', { error: errorMessage, statusCode });
            failed++;
            errors.push({ endpoint: sub.endpoint, statusCode, message: errorMessage });

            if (statusCode === 404 || statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            } else {
                const { error: rpcErr } = await supabase.rpc('increment_push_failure_count', {
                    p_subscription_id: sub.id,
                });
                if (rpcErr) {
                    const subTyped = sub as unknown as { failure_count?: number };
                    const next = (subTyped.failure_count ?? 0) + 1;
                    await supabase
                        .from('push_subscriptions')
                        .update({ failure_count: next })
                        .eq('id', sub.id);
                }
            }
        }
    }

    if (succeeded === 0 && subscriptions.length > 0) {
        Sentry.captureMessage('All push subscriptions for shop failed', {
            level: 'warning',
            extra: { shopId, total: subscriptions.length, errors },
        });
    }

    return { ok: true, succeeded, failed, errors };
}

/**
 * Backwards-compatible wrapper that returns the legacy {success, failed} shape.
 * Existing call sites stay untouched; new code should prefer the verbose variant.
 */
export async function sendPushNotification(
    shopId: string,
    payload: NotificationPayload
): Promise<{ success: number; failed: number }> {
    const result = await sendPushNotificationVerbose(shopId, payload);
    if (result.ok) {
        return { success: result.succeeded, failed: result.failed };
    }
    return { success: 0, failed: 0 };
}

/**
 * Quick check: does this shop have any active push subscription right now?
 * Used by the dashboard to surface a "you have no notifications enabled" banner.
 */
export async function hasActivePushSubscription(shopId: string): Promise<boolean> {
    const supabase = supabaseAdmin();
    const { count } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId);
    return (count ?? 0) > 0;
}

/**
 * Send order notification to shop owner
 */
export async function sendOrderNotification(
    shopId: string,
    orderType: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled',
    orderDetails: {
        orderId: string;
        customerName?: string;
        totalAmount?: number;
    }
): Promise<void> {
    const messages: Record<string, { title: string; body: string }> = {
        new: {
            title: '🆕 Шинэ захиалга!',
            body: `${orderDetails.customerName || 'Хэрэглэгч'} захиалга өглөө. ${orderDetails.totalAmount?.toLocaleString() || ''}₮`,
        },
        confirmed: {
            title: '✅ Захиалга баталгаажлаа',
            body: `Захиалга #${orderDetails.orderId.slice(-6)} баталгаажлаа`,
        },
        shipped: {
            title: '🚚 Хүргэлтэнд гарлаа',
            body: `Захиалга #${orderDetails.orderId.slice(-6)} хүргэлтэнд гарлаа`,
        },
        delivered: {
            title: '📦 Хүргэгдлээ!',
            body: `Захиалга #${orderDetails.orderId.slice(-6)} амжилттай хүргэгдлээ`,
        },
        cancelled: {
            title: '❌ Захиалга цуцлагдлаа',
            body: `Захиалга #${orderDetails.orderId.slice(-6)} цуцлагдлаа`,
        },
    };

    const message = messages[orderType];

    await sendPushNotification(shopId, {
        ...message,
        url: `/dashboard/orders`,
        tag: `order-${orderDetails.orderId}`,
    });
}

/**
 * Get VAPID public key for client
 */
export function getVapidPublicKey(): string {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
}
