/**
 * Эзэнд push-ээр тайлан/анхааруулга илгээх дундын туслах (owner_report).
 * Deterministic — AI нэгж зарцуулахгүй.
 */

import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';
import { ubDateKey } from '../time';
import type { AutomationContext, RunResult } from '../types';

export async function pushOwnerReport(
    ctx: AutomationContext,
    message: { title: string; body: string } | null,
    opts: { url: string; tag: string; stats: object },
): Promise<RunResult> {
    const stats = { ...opts.stats } as Record<string, unknown>;
    if (!message) return { status: 'skipped', result: { reason: 'nothing_to_report', ...stats } };

    if (!(await isNotificationEnabled(ctx.shopId, 'automation'))) {
        return { status: 'skipped', result: { reason: 'push_disabled', ...stats } };
    }
    await sendPushNotification(ctx.shopId, {
        ...message,
        url: opts.url,
        tag: `${opts.tag}-${ubDateKey(ctx.now)}`,
    });
    return { status: 'sent', result: { ...stats, title: message.title, body: message.body } };
}
