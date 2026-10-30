/**
 * deliver() — үйлчлүүлэгч рүү АВТОМАТААР илгээх бүх мессежийн ганц гарц.
 *
 * Meta-гийн 24 цагийн мессежийн цонхыг дагаж сувгаа сонгоно:
 *   1. Үйлчлүүлэгч сүүлийн 24 цагт өөрөө бичсэн → энгийн текст (Messenger/IG).
 *   2. Цонхны гадна + Messenger + тухайн Page-д APPROVED Utility template
 *      байгаа → Utility Message.
 *   3. Бусад (Instagram, template байхгүй, илгээлт алдаа) → эзэнд push
 *      (`ownerFallback` өгсөн үед), эс бөгөөс `undelivered`.
 *
 * HUMAN_AGENT tag-ийг энд ХЭЗЭЭ Ч ашиглахгүй — энэ нь зөвхөн хүний гар
 * хариултад зориулагдсан (conversations/reply route).
 *
 * Service role-оор ажиллана; customer-ийг `shop_id`-аар шүүж дуудагч өөр
 * дэлгүүрийн үйлчлүүлэгч рүү илгээхээс сэргийлнэ.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendTextMessage, sendUtilityMessage, type IgAuthType } from '@/lib/facebook/messenger';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled, type NotificationTopic } from '@/lib/notifications-prefs';
import { UTILITY_TEMPLATES, hasAllTemplateParams, type UtilityPurpose } from './utilityTemplates';

/** Meta-гийн стандарт цонх 24 цаг; цагийн зөрүүнээс болгоомжилж 5 минут хасна. */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

export type DeliverPlatform = 'messenger' | 'instagram';

export type DeliverReason =
    | 'within_window'
    | 'utility_template'
    | 'no_recipient'
    | 'no_token'
    | 'outside_window_instagram'
    | 'outside_window_no_template'
    | 'send_failed';

export interface ChannelDecisionInput {
    platform: DeliverPlatform | null;
    lastInboundAt: Date | null;
    now: Date;
    hasToken: boolean;
    hasUtilityTemplate: boolean;
}

export type ChannelDecision =
    | { channel: 'text'; reason: 'within_window' }
    | { channel: 'utility'; reason: 'utility_template' }
    | { channel: 'skip'; reason: 'no_recipient' | 'no_token' }
    | { channel: 'owner'; reason: 'outside_window_instagram' | 'outside_window_no_template' };

/** Цэвэр шийдвэрийн функц — DB/сүлжээгүй, тестлэхэд хялбар. */
export function decideChannel(input: ChannelDecisionInput): ChannelDecision {
    if (!input.platform) return { channel: 'skip', reason: 'no_recipient' };
    if (!input.hasToken) return { channel: 'skip', reason: 'no_token' };

    const inWindow =
        input.lastInboundAt !== null &&
        input.now.getTime() - input.lastInboundAt.getTime() < MESSAGING_WINDOW_MS;
    if (inWindow) return { channel: 'text', reason: 'within_window' };

    if (input.platform === 'instagram') {
        return { channel: 'owner', reason: 'outside_window_instagram' };
    }
    if (input.hasUtilityTemplate) return { channel: 'utility', reason: 'utility_template' };
    return { channel: 'owner', reason: 'outside_window_no_template' };
}

export interface DeliverInput {
    shopId: string;
    customerId: string;
    /** 24 цагийн цонх дотор илгээх бүрэн текст. */
    text: string;
    /** Цонхны гадна Messenger-ээр илгээх Utility template ба параметрүүд. */
    utility?: { purpose: UtilityPurpose; params: Record<string, string> };
    /** Үйлчлүүлэгчид хүрээгүй үед эзэнд илгээх push. Өгөөгүй бол push явахгүй. */
    ownerFallback?: {
        topic: NotificationTopic;
        title: string;
        body: string;
        url?: string;
        tag?: string;
    };
    /** Лог болон Sentry-д харагдах үйлдлийн нэр. */
    operation: string;
}

export type DeliverResult =
    | { status: 'sent'; channel: 'text' | 'utility'; platform: DeliverPlatform }
    | { status: 'owner_notified' | 'undelivered' | 'skipped'; reason: DeliverReason };

/**
 * Үйлчлүүлэгчийн хамгийн сүүлийн inbound (DM/postback) цаг. chat_history-д
 * үйлчлүүлэгчийн мессеж `message`-д, эзний гар хариулт `message = ''`-оор,
 * comment `[FB Comment] …` угтвартай хадгалагддаг.
 */
async function loadLastInboundAt(shopId: string, customerId: string): Promise<Date | null> {
    const { data, error } = await supabaseAdmin()
        .from('chat_history')
        .select('created_at')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .not('message', 'is', null)
        .neq('message', '')
        .not('message', 'like', '[FB Comment]%')
        .not('message', 'like', '[IG Comment]%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data?.created_at) return null;
    return new Date(data.created_at);
}

async function loadApprovedTemplate(
    shopId: string,
    purpose: UtilityPurpose,
): Promise<{ template_name: string; language: string } | null> {
    // Хүснэгт байхгүй (migration хийгдээгүй) үед ч алдаа → template байхгүй гэж үзнэ.
    const { data, error } = await supabaseAdmin()
        .from('shop_message_templates')
        .select('template_name, language')
        .eq('shop_id', shopId)
        .eq('purpose', purpose)
        .eq('status', 'approved')
        .maybeSingle();

    if (error || !data) return null;
    return data;
}

/** Template-ийн body-г параметрээр бөглөнө (inbox, AI контекстэд харуулах текст). */
export function renderUtilityBody(purpose: UtilityPurpose, params: Record<string, string>): string {
    return UTILITY_TEMPLATES[purpose].body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => params[key] ?? '');
}

/**
 * Илгээсэн мессежийг chat_history-д эзний гар хариултын хэлбэрээр
 * (message = '') хадгална: inbox-д харагдана, үйлчлүүлэгч хариу бичихэд
 * чатын AI юуны тухай ярьж байгааг мэднэ. last_inbound_at-д нөлөөлөхгүй.
 */
async function recordOutbound(shopId: string, customerId: string, text: string): Promise<void> {
    try {
        const { error } = await supabaseAdmin().from('chat_history').insert({
            shop_id: shopId,
            customer_id: customerId,
            message: '',
            response: text,
            intent: 'AUTOMATION',
        });
        if (error) logger.warn('deliver: chat_history insert failed (non-blocking)', { shopId, error: error.message });
    } catch (err) {
        logger.warn('deliver: chat_history insert threw (non-blocking)', {
            shopId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

async function notifyOwner(
    shopId: string,
    fallback: NonNullable<DeliverInput['ownerFallback']>,
): Promise<boolean> {
    try {
        if (!(await isNotificationEnabled(shopId, fallback.topic))) return false;
        await sendPushNotification(shopId, {
            title: fallback.title,
            body: fallback.body,
            url: fallback.url,
            tag: fallback.tag,
        });
        return true;
    } catch (err) {
        logger.warn('deliver: owner fallback push failed', {
            shopId,
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}

export async function deliver(input: DeliverInput): Promise<DeliverResult> {
    const { shopId, customerId, operation } = input;
    const supabase = supabaseAdmin();

    const [{ data: customer }, { data: shop }] = await Promise.all([
        supabase
            .from('customers')
            .select('facebook_id, instagram_id')
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .maybeSingle(),
        supabase
            .from('shops')
            .select('facebook_page_access_token, instagram_access_token, instagram_auth_type')
            .eq('id', shopId)
            .maybeSingle(),
    ]);

    const platform: DeliverPlatform | null = customer?.facebook_id
        ? 'messenger'
        : customer?.instagram_id
          ? 'instagram'
          : null;
    const recipientId = customer?.facebook_id || customer?.instagram_id || '';

    const igAuthType: IgAuthType =
        shop?.instagram_auth_type === 'instagram_login' ? 'instagram_login' : 'facebook_login';
    const accessToken =
        (platform === 'instagram'
            ? igAuthType === 'instagram_login'
                ? shop?.instagram_access_token
                : shop?.facebook_page_access_token || shop?.instagram_access_token
            : shop?.facebook_page_access_token) || '';

    const utility = input.utility && hasAllTemplateParams(input.utility.purpose, input.utility.params)
        ? input.utility
        : undefined;

    const [lastInboundAt, template] = platform
        ? await Promise.all([
              loadLastInboundAt(shopId, customerId),
              platform === 'messenger' && utility ? loadApprovedTemplate(shopId, utility.purpose) : null,
          ])
        : [null, null];

    const utilitySend = template && utility
        ? {
              templateName: template.template_name,
              language: template.language,
              params: Object.fromEntries(
                  UTILITY_TEMPLATES[utility.purpose].params.map((p) => [p, utility.params[p]]),
              ),
          }
        : null;

    const decision = decideChannel({
        platform,
        lastInboundAt,
        now: new Date(),
        hasToken: Boolean(accessToken),
        hasUtilityTemplate: Boolean(utilitySend),
    });

    let failReason: DeliverReason = decision.reason;

    if (decision.channel === 'skip') {
        logger.info(`deliver(${operation}): skipped`, { shopId, customerId, reason: decision.reason });
        return { status: 'skipped', reason: decision.reason };
    }

    if (platform && (decision.channel === 'text' || (decision.channel === 'utility' && utilitySend))) {
        try {
            if (decision.channel === 'text') {
                await sendTextMessage({
                    recipientId,
                    message: input.text,
                    pageAccessToken: accessToken,
                    authType: platform === 'instagram' ? igAuthType : undefined,
                });
            } else if (utilitySend && utility) {
                await sendUtilityMessage({ recipientId, pageAccessToken: accessToken, ...utilitySend });
            }
            logger.info(`deliver(${operation}): sent`, { shopId, customerId, channel: decision.channel });
            await recordOutbound(
                shopId,
                customerId,
                decision.channel === 'utility' && utility ? renderUtilityBody(utility.purpose, utility.params) : input.text,
            );
            return { status: 'sent', channel: decision.channel, platform };
        } catch (err) {
            failReason = 'send_failed';
            logger.warn(`deliver(${operation}): send failed`, {
                shopId,
                customerId,
                channel: decision.channel,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    if (input.ownerFallback && (await notifyOwner(shopId, input.ownerFallback))) {
        return { status: 'owner_notified', reason: failReason };
    }
    return { status: 'undelivered', reason: failReason };
}
