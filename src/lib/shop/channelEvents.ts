/**
 * Дэлгүүрийн Facebook page / Instagram холболтын өөрчлөлтийн бүртгэл ба анхааруулга.
 *
 * Бүртгэлийг DB trigger (`log_shop_channel_change`, migration
 * 20261111120000_shop_channel_events) бичдэг — аль ч замаар өөрчлөгдсөн
 * алгасахгүй. Апп зөвхөн `withChannelContext()`-оор "хэн, яагаад"-ыг
 * UPDATE-тэй хамт дамжуулна.
 *
 * Анхааруулга хоёр тохиолдолд явна (эзэмшигчид push + и-мэйл, admin-д и-мэйл):
 *   1. Өөр хэрэглэгчийн дэлгүүр page/IG-г холбоод хуучин дэлгүүрээс нь
 *      салгасан үед — шууд.
 *   2. Салгагдсан page-ээс webhook ирсээр байгаа ч ямар ч дэлгүүрт
 *      холбогдоогүй үед — 24 цагт нэг удаа, нэг салгалтад нийт 3 хүртэл.
 *      (2026-10: ИТО Монголиа page-ээ алдаад 33 хоног хариугүй байсан.)
 */

import * as Sentry from '@sentry/nextjs';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { sendChannelAlertEmail } from '@/lib/email/templates';

export type ChannelPlatform = 'facebook' | 'instagram';

/** NULL source нь "тодорхойгүй зам" (SQL editor, context дамжуулаагүй код). */
export type ChannelChangeSource = 'owner_disconnect' | 'claimed_by_other_shop' | 'settings_update';

export interface ChannelChangeContext {
    source: ChannelChangeSource;
    actor_user_id?: string | null;
    related_shop_id?: string | null;
}

interface PostgrestLikeError {
    code?: string;
    message?: string;
}

const PLATFORM_LABEL: Record<ChannelPlatform, string> = {
    facebook: 'Facebook page',
    instagram: 'Instagram',
};

export const ORPHAN_ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const ORPHAN_ALERT_MAX = 3;
/** Нэг instance дотор ижил account-ыг DB-ээс дахин шалгахаас өмнөх хугацаа. */
const ORPHAN_LOCAL_RECHECK_MS = 10 * 60 * 1000;

export function isMissingChannelContextColumn(error: PostgrestLikeError | null | undefined): boolean {
    if (!error) return false;
    if (error.code !== 'PGRST204' && error.code !== '42703') return false;
    return (error.message ?? '').includes('channel_change_context');
}

/**
 * shops UPDATE-д context дамжуулна. Migration хараахан apply хийгдээгүй бол
 * column байхгүй алдаа гарна — тэр үед context-гүйгээр дахин оролдоно,
 * ингэснээр connect/disconnect хэзээ ч эвдрэхгүй.
 */
export async function withChannelContext<R extends { error: PostgrestLikeError | null }>(
    ctx: ChannelChangeContext | null,
    run: (extra: Record<string, unknown>) => PromiseLike<R>
): Promise<R> {
    if (!ctx) return run({});
    const first = await run({ channel_change_context: ctx });
    if (!isMissingChannelContextColumn(first.error)) return first;
    logger.warn('shops.channel_change_context missing — apply migration 20261111120000_shop_channel_events', {
        source: ctx.source,
    });
    return run({});
}

function appUrl(path: string): string {
    const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn').replace(/\/$/, '');
    return `${base}${path}`;
}

async function getOwnerEmail(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    try {
        const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
        return data?.user?.email ?? null;
    } catch (error: unknown) {
        logger.warn('channelEvents: owner email lookup failed', { error });
        return null;
    }
}

async function getAdminEmails(): Promise<string[]> {
    const { data, error } = await supabaseAdmin()
        .from('admins')
        .select('email')
        .eq('is_active', true)
        .in('role', ['super_admin', 'admin']);
    if (error) {
        logger.warn('channelEvents: admin email lookup failed', { error: error.message });
        return [];
    }
    const emails = (data ?? [])
        .map((row) => (row as { email?: string | null }).email)
        .filter((email): email is string => Boolean(email));
    return [...new Set(emails)];
}

interface AlertShop {
    id: string;
    name: string | null;
    user_id: string | null;
}

async function dispatchChannelAlert(alert: {
    shop: AlertShop;
    pushTitle: string;
    pushBody: string;
    subject: string;
    heading: string;
    ownerLines: string[];
    adminLines: string[];
    sentryMessage: string;
    sentryExtra: Record<string, unknown>;
}): Promise<void> {
    const shopName = alert.shop.name || 'Дэлгүүр';

    Sentry.captureMessage(alert.sentryMessage, { level: 'warning', extra: alert.sentryExtra });

    const tasks: Array<Promise<unknown>> = [
        sendPushNotification(alert.shop.id, {
            title: alert.pushTitle,
            body: alert.pushBody,
            url: '/dashboard/settings',
            tag: `channel-${alert.shop.id}`,
        }),
    ];

    const ownerEmail = await getOwnerEmail(alert.shop.user_id);
    if (ownerEmail) {
        tasks.push(
            sendChannelAlertEmail({
                to: ownerEmail,
                subject: alert.subject,
                heading: alert.heading,
                shopName,
                lines: alert.ownerLines,
                actionUrl: appUrl('/dashboard/settings'),
                actionLabel: 'Тохиргоо руу орох',
            })
        );
    }

    for (const adminEmail of await getAdminEmails()) {
        if (adminEmail === ownerEmail) continue;
        tasks.push(
            sendChannelAlertEmail({
                to: adminEmail,
                subject: `[Admin] ${alert.subject}`,
                heading: alert.heading,
                shopName,
                lines: alert.adminLines,
                actionUrl: appUrl('/admin/shops'),
                actionLabel: 'Admin самбар',
            })
        );
    }

    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === 'rejected').length;
    logger.info('Channel alert dispatched', {
        shopId: alert.shop.id,
        channels: results.length,
        failed,
        ownerEmail: Boolean(ownerEmail),
    });
}

/**
 * Өөр хэрэглэгчийн дэлгүүр page/IG-г холбосны улмаас `victim` дэлгүүрээс
 * салгагдсан. Ижил эзэмшигчийн дэлгүүрүүдийн хооронд шилжүүлсэн бол
 * (санаатай үйлдэл) мэдэгдэхгүй — trigger бүртгэлийг аль хэдийн бичсэн.
 * Хэзээ ч throw хийхгүй.
 */
export async function notifyChannelClaimed(params: {
    victim: AlertShop & { accountName: string | null };
    claimingShop: { id: string; user_id: string | null };
    platform: ChannelPlatform;
    accountId: string;
}): Promise<void> {
    const { victim, claimingShop, platform, accountId } = params;
    try {
        if (victim.user_id && victim.user_id === claimingShop.user_id) return;

        const label = PLATFORM_LABEL[platform];
        const accountLabel = victim.accountName || accountId;
        const shopName = victim.name || 'Дэлгүүр';

        await dispatchChannelAlert({
            shop: victim,
            pushTitle: `⚠️ ${label} салгагдлаа`,
            pushBody: `"${accountLabel}" өөр Syncly дэлгүүрт холбогдсон тул таны AI энэ ${label}-ийн мессежид хариулахгүй.`,
            subject: `⚠️ ${label} салгагдлаа — ${shopName}`,
            heading: `⚠️ ${label} өөр дэлгүүрт шилжлээ`,
            ownerLines: [
                `"${accountLabel}" ${label} өөр Syncly дэлгүүрт холбогдсон тул таны "${shopName}" дэлгүүрээс салгагдлаа.`,
                `Одоогоор энэ ${label}-ийн мессежид таны AI хариулахгүй байна.`,
                `Хэрэв та үүнийг зөвшөөрөөгүй бол Тохиргоо хэсгээс дахин холбоод, ${label}-ийн admin эрхтэй хүмүүсээ шалгана уу.`,
            ],
            adminLines: [
                `"${shopName}" (${victim.id}) дэлгүүрийн ${label} ${accountId} ("${accountLabel}") нь ${claimingShop.id} дэлгүүрт шилжлээ.`,
                'Хоёр өөр хэрэглэгч тул санаатай шилжүүлэг эсвэл булаалт эсэхийг шалгана уу. Эзэмшигчид мэдэгдэл явсан.',
            ],
            sentryMessage: 'Shop channel claimed by another user',
            sentryExtra: { victimShopId: victim.id, claimingShopId: claimingShop.id, platform, accountId },
        });
    } catch (error: unknown) {
        logger.error('notifyChannelClaimed failed', { error, victimShopId: victim.id, platform });
    }
}

const orphanCheckedAt = new Map<string, number>();

/** Test helper. */
export function resetOrphanAlertCache(): void {
    orphanCheckedAt.clear();
}

interface ChannelEventRow {
    id: string;
    shop_id: string;
    platform: ChannelPlatform;
    old_account_name: string | null;
    source: string | null;
    orphan_alerted_at: string | null;
    orphan_alert_count: number | null;
    created_at: string;
}

/**
 * Webhook ирсэн боловч `accountId` (page / IG ID) ямар ч идэвхтэй дэлгүүрт
 * холбогдоогүй үед дуудна. Энэ account-ыг хамгийн сүүлд эзэмшиж байсан
 * дэлгүүр одоо тухайн платформд юу ч холбоогүй бол эзэмшигч + admin-д
 * мэдэгдэнэ. Throttle нь DB дээр (олон instance-д нэг удаа). Хэзээ ч throw
 * хийхгүй — webhook-ийн hot path.
 */
export async function alertIfOrphanedChannel(accountId: string): Promise<void> {
    if (!accountId) return;
    try {
        const now = Date.now();
        const lastCheck = orphanCheckedAt.get(accountId);
        if (lastCheck !== undefined && now - lastCheck < ORPHAN_LOCAL_RECHECK_MS) return;
        if (orphanCheckedAt.size > 1000) orphanCheckedAt.clear();
        orphanCheckedAt.set(accountId, now);

        const supabase = supabaseAdmin();
        const { data: event, error } = await supabase
            .from('shop_channel_events')
            .select('id, shop_id, platform, old_account_name, source, orphan_alerted_at, orphan_alert_count, created_at')
            .eq('old_account_id', accountId)
            .in('action', ['disconnected', 'changed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            // Migration apply хийгдээгүй үед хүснэгт байхгүй — чимээгүй алгасна.
            logger.debug('alertIfOrphanedChannel: event lookup failed', { error: error.message });
            return;
        }
        if (!event) return;

        const row = event as ChannelEventRow;
        const sentCount = row.orphan_alert_count ?? 0;
        if (sentCount >= ORPHAN_ALERT_MAX) return;
        if (row.orphan_alerted_at && now - new Date(row.orphan_alerted_at).getTime() < ORPHAN_ALERT_INTERVAL_MS) return;

        const { data: shop } = await supabase
            .from('shops')
            .select('id, name, user_id, is_active, facebook_page_id, instagram_business_account_id')
            .eq('id', row.shop_id)
            .maybeSingle();

        if (!shop || !shop.is_active) return;
        // Тухайн платформд өөр account холбосон бол санаатай сольсон гэж үзнэ.
        const currentAccount = row.platform === 'facebook' ? shop.facebook_page_id : shop.instagram_business_account_id;
        if (currentAccount) return;

        // Олон instance зэрэг ирвэл зөвхөн нэг нь мэдэгдэнэ (optimistic claim).
        const cutoff = new Date(now - ORPHAN_ALERT_INTERVAL_MS).toISOString();
        const { data: claimed, error: claimError } = await supabase
            .from('shop_channel_events')
            .update({ orphan_alerted_at: new Date(now).toISOString(), orphan_alert_count: sentCount + 1 })
            .eq('id', row.id)
            .eq('orphan_alert_count', sentCount)
            .or(`orphan_alerted_at.is.null,orphan_alerted_at.lt.${cutoff}`)
            .select('id');

        if (claimError || !claimed || claimed.length === 0) return;

        const label = PLATFORM_LABEL[row.platform];
        const accountLabel = row.old_account_name || accountId;
        const shopName = shop.name || 'Дэлгүүр';
        const since = row.created_at.slice(0, 10);

        await dispatchChannelAlert({
            shop: { id: shop.id, name: shop.name, user_id: shop.user_id },
            pushTitle: `⚠️ ${label} холбогдоогүй байна`,
            pushBody: `"${accountLabel}"-д харилцагчид бичсээр байгаа ч AI хариулахгүй байна. Тохиргооноос дахин холбоно уу.`,
            subject: `⚠️ ${label}-ийн мессежүүд хариугүй байна — ${shopName}`,
            heading: `⚠️ ${label} Syncly-д холбогдоогүй байна`,
            ownerLines: [
                `Таны "${accountLabel}" ${label}-д харилцагчид мессеж бичсээр байгаа ч энэ ${label} ${since}-нээс хойш Syncly-аас салгагдсан байна.`,
                'Иймээс AI эдгээр мессежид хариулахгүй байна.',
                `Тохиргоо хэсгээс ${label}-ээ дахин холбоно уу. Санаатайгаар салгасан бол энэ мэдэгдлийг үл тоомсорлож болно.`,
            ],
            adminLines: [
                `"${shopName}" (${shop.id}) дэлгүүрийн ${label} ${accountId} ("${accountLabel}") ${since}-нд салгагдсан (зам: ${row.source ?? 'тодорхойгүй'}), гэвч webhook ирсээр байна.`,
                `Мэдэгдэл ${sentCount + 1}/${ORPHAN_ALERT_MAX}.`,
            ],
            sentryMessage: 'Webhook traffic for a disconnected shop channel',
            sentryExtra: { shopId: shop.id, platform: row.platform, accountId, disconnectedAt: row.created_at },
        });
    } catch (error: unknown) {
        logger.error('alertIfOrphanedChannel failed', { error, accountId });
    }
}
