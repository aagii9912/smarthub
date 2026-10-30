/**
 * Automation-уудын дундын туслахууд (booking, commerce, lead pack-ууд).
 */

import { z } from 'zod';
import type { DeliverResult } from '../deliver';
import { ubDateKey, ubHour } from '../time';
import type { AutomationConfigField, AutomationContext, AutomationSubject, RunResult } from '../types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** PostgREST relation нь объект эсвэл массив байж болно. */
export function one<T>(value: T | T[] | null | undefined): T | null {
    return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** Эзний тохиргоо эсвэл default утга (буруу утга → default). */
export function configNumber(config: Record<string, unknown>, field: AutomationConfigField): number {
    const v = Number(config[field.key]);
    return Number.isFinite(v) && v >= field.min && v <= field.max ? v : field.default;
}

/** configFields-ээс `shop_agents.config`-ийн Zod schema үүсгэнэ. */
export function configSchemaFor(fields: AutomationConfigField[]) {
    return z
        .object(Object.fromEntries(fields.map((f) => [f.key, z.number().int().min(f.min).max(f.max).optional()])))
        .strict();
}

export const summaryHourField: AutomationConfigField = {
    key: 'hour',
    label: 'Илгээх цаг',
    type: 'hour',
    min: 5,
    max: 12,
    default: 8,
};

/**
 * Өдөрт нэг удаа, UB-ийн тохируулсан цагаас хойш 3 цагийн дотор (орой
 * хоцорч илгээхгүй) дэлгүүрийн нэг subject буцаана.
 */
export function dailyShopSubject(ctx: AutomationContext, hourField = summaryHourField): AutomationSubject[] {
    const hour = configNumber(ctx.config, hourField);
    const nowHour = ubHour(ctx.now);
    if (nowHour < hour || nowHour >= hour + 3) return [];
    return [{ subjectType: 'shop', subjectId: ctx.shopId, windowKey: ubDateKey(ctx.now) }];
}

export interface CustomerTask {
    customerName: string | null;
    phone: string | null;
    note: string;
}

export function callCustomerTask(task: CustomerTask, extra: Record<string, unknown> = {}): RunResult {
    return {
        status: 'awaiting_approval',
        result: {
            ...extra,
            task: { type: 'call_customer', customer_name: task.customerName, phone: task.phone, note: task.note },
        },
    };
}

/**
 * deliver()-ийн үр дүнг run-ий төлөв болгоно. Хүрээгүй үед `task` өгсөн бол
 * эзэнд "залгах" даалгавар, өгөөгүй бол алгасна (богино хугацааны мессеж).
 */
export function outcomeFromDelivery(delivery: DeliverResult, task?: CustomerTask): RunResult {
    if (delivery.status === 'sent') {
        return { status: 'sent', result: { channel: delivery.channel, platform: delivery.platform } };
    }
    if (delivery.status === 'skipped' || !task) {
        return { status: 'skipped', result: { delivery: delivery.status, reason: delivery.reason } };
    }
    return callCustomerTask(task, { delivery: delivery.status, reason: delivery.reason });
}
