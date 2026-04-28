import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// Lazy VAPID initialization flag
let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
    if (vapidConfigured) return true;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@smarthub.mn';

    if (vapidPublicKey && vapidPrivateKey) {
        try {
            // Sanitize keys: remove whitespace and base64 padding (=)
            const cleanPublicKey = vapidPublicKey.trim().replace(/=/g, '');
            const cleanPrivateKey = vapidPrivateKey.trim().replace(/=/g, '');
            const cleanEmail = vapidEmail.trim();

            webpush.setVapidDetails(cleanEmail, cleanPublicKey, cleanPrivateKey);
            vapidConfigured = true;
            return true;
        } catch (error: unknown) {
            logger.error('Failed to configure VAPID', { error });
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

/**
 * Send push notification to all subscriptions for a shop
 */
export async function sendPushNotification(
    shopId: string,
    payload: NotificationPayload
): Promise<{ success: number; failed: number }> {
    // Ensure VAPID is configured before sending
    if (!ensureVapidConfigured()) {
        logger.warn('Push notification skipped: VAPID not configured');
        return { success: 0, failed: 0 };
    }

    const supabase = supabaseAdmin();

    logger.debug('sendPushNotification called', { shopId, payload });

    // Get all subscriptions for this shop
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('id, shop_id, endpoint, p256dh, auth, created_at')
        .eq('shop_id', shopId);

    logger.debug('Push subscriptions query result', { count: subscriptions?.length || 0, error: error?.message });

    if (error) {
        logger.error('Push notification database error', { error });
        return { success: 0, failed: 0 };
    }

    if (!subscriptions || subscriptions.length === 0) {
        logger.debug('No push subscriptions found', { shopId });
        // Debug: check sample subscriptions
        const { data: allSubs } = await supabase.from('push_subscriptions').select('shop_id').limit(5);
        logger.debug('Sample subscriptions in DB', { samples: allSubs });
        return { success: 0, failed: 0 };
    }

    logger.debug('Found subscriptions', { count: subscriptions.length });

    let success = 0;
    let failed = 0;
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

            await webpush.sendNotification(
                pushSubscription,
                JSON.stringify(payload)
            );
            success++;
            // Refresh health on success.
            await supabase
                .from('push_subscriptions')
                .update({ last_used_at: nowIso, failure_count: 0 })
                .eq('id', sub.id);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logger.error('Push notification failed', { error: errorMessage });
            failed++;

            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
                // Permanently invalid — gone from the browser.
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('id', sub.id);
            } else {
                // Transient or unknown — bump failure_count so the cleanup
                // cron can prune chronically-failing rows.
                const { error: rpcErr } = await supabase.rpc(
                    'increment_push_failure_count',
                    { p_subscription_id: sub.id }
                );
                if (rpcErr) {
                    // Fall back to a manual update if the RPC isn't deployed yet.
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

    if (success === 0 && subscriptions.length > 0) {
        logger.warn('All push subscriptions for shop failed', { shopId, total: subscriptions.length });
    }

    return { success, failed };
}

/**
 * Quick check: does this shop have any active push subscription right now?
 * Used by the dashboard to surface a "you have no notifications enabled" banner
 * (issue #4 — owner missed customer-support pings because no SW was installed).
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
