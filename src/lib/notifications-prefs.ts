import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

const COLUMN_MAP = {
    order: 'notify_on_order',
    contact: 'notify_on_contact',
    support: 'notify_on_support',
    cancel: 'notify_on_cancel',
    complaints: 'notify_on_complaints',
    payment_received: 'notify_on_payment_received',
    payment_failed: 'notify_on_payment_failed',
    refund: 'notify_on_refund',
    new_customer: 'notify_on_new_customer',
    subscription: 'notify_on_subscription',
    automation: 'notify_on_automation',
    plan_limit: 'notify_on_plan_limit',
    low_stock: 'notify_on_low_stock',
    import: 'notify_on_import',
} as const;

export type NotificationTopic = keyof typeof COLUMN_MAP;

const TTL_MS = 60_000;
type CacheEntry = { value: boolean; expires: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(shopId: string, topic: NotificationTopic) {
    return `${shopId}:${topic}`;
}

/**
 * Returns whether the shop owner has opted to receive notifications for this
 * topic. Defaults to TRUE for legacy rows where the column is null.
 *
 * Cached in-process for 60 seconds to keep payment/webhook hot paths cheap.
 */
export async function isNotificationEnabled(
    shopId: string,
    topic: NotificationTopic
): Promise<boolean> {
    const key = cacheKey(shopId, topic);
    const cached = cache.get(key);
    const now = Date.now();
    if (cached && cached.expires > now) {
        return cached.value;
    }

    const column = COLUMN_MAP[topic];
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
        .from('shops')
        .select(column)
        .eq('id', shopId)
        .single();

    if (error) {
        logger.warn('isNotificationEnabled: failed to read pref, defaulting to true', {
            shopId,
            topic,
            error: error.message,
        });
        return true;
    }

    const raw = (data as Record<string, unknown> | null)?.[column];
    const value = raw === null || raw === undefined ? true : Boolean(raw);

    cache.set(key, { value, expires: now + TTL_MS });
    return value;
}

/**
 * Test helper. Clears the in-process cache so a freshly-saved preference
 * takes effect immediately in the same process.
 */
export function clearNotificationPrefsCache(): void {
    cache.clear();
}
