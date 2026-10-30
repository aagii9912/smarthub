import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ sendPushNotification: vi.fn() }));
vi.mock('@/lib/notifications-prefs', () => ({ isNotificationEnabled: vi.fn() }));

import {
    buildReminderText,
    dailyOwnerSummary,
    formatSummary,
    summarizeDay,
    type DayAppointment,
} from '../automations/booking';
import { outcomeFromDelivery } from '../automations/shared';
import { formatUbDateTime, ubDateKey, ubDayStart, ubHour } from '../time';
import { PACK_AUTOMATIONS, findAutomation } from '../automations';

// 2026-10-10 08:30 in Ulaanbaatar (UTC+8)
const NOW = new Date('2026-10-10T00:30:00Z');

describe('Ulaanbaatar time helpers', () => {
    it('uses UB calendar day and hour, not server UTC', () => {
        expect(ubHour(NOW)).toBe(8);
        expect(ubDateKey(new Date('2026-10-09T17:00:00Z'))).toBe('2026-10-10'); // 01:00 UB
        expect(ubDayStart(NOW).toISOString()).toBe('2026-10-09T16:00:00.000Z');
        expect(formatUbDateTime(new Date('2026-10-11T07:00:00Z'))).toBe('10-р сарын 11, 15:00');
    });
});

describe('summarizeDay', () => {
    const at = (iso: string, status: string, payment: string | null = 'unpaid', price: number | null = null): DayAppointment => ({
        scheduled_at: iso,
        status,
        payment_status: payment,
        price,
    });

    it('counts today, yesterday and unpaid in UB days', () => {
        const s = summarizeDay(
            [
                at('2026-10-10T02:00:00Z', 'confirmed'), // today 10:00 UB
                at('2026-10-10T15:30:00Z', 'pending'), // today 23:30 UB
                at('2026-10-10T16:30:00Z', 'pending'), // tomorrow 00:30 UB → excluded
                at('2026-10-10T03:00:00Z', 'cancelled'), // today but cancelled → excluded
                at('2026-10-09T03:00:00Z', 'completed', 'paid', 25000), // yesterday
                at('2026-10-09T05:00:00Z', 'no_show'),
                at('2026-10-06T05:00:00Z', 'completed', 'unpaid'), // 4 days ago, unpaid
            ],
            NOW,
        );
        expect(s).toEqual({
            today: 2,
            yesterdayCompleted: 1,
            yesterdayNoShow: 1,
            yesterdayRevenue: 25000,
            unpaidCompleted7d: 1,
        });
    });

    it('formats a short push body and stays silent when there is nothing to say', () => {
        expect(formatSummary({ today: 3, yesterdayCompleted: 2, yesterdayNoShow: 1, yesterdayRevenue: 50000, unpaidCompleted7d: 0 }))
            .toEqual({ title: '☀️ Өнөөдрийн тойм', body: 'Өнөөдөр 3 цаг захиалга · өчигдөр 2 үйлчилгээ (50,000₮) · 1 хүн ирээгүй' });
        expect(formatSummary({ today: 0, yesterdayCompleted: 0, yesterdayNoShow: 0, yesterdayRevenue: 0, unpaidCompleted7d: 0 })).toBeNull();
    });
});

describe('dailyOwnerSummary.select', () => {
    const ctx = (now: Date, config: Record<string, unknown> = {}) => ({ shopId: 'shop-1', config, mode: 'auto' as const, now });

    it('fires once per UB day after the configured hour', async () => {
        expect(await dailyOwnerSummary.select(ctx(NOW))).toEqual([
            { subjectType: 'shop', subjectId: 'shop-1', windowKey: '2026-10-10' },
        ]);
    });

    it('does not fire before the hour or too late in the day', async () => {
        expect(await dailyOwnerSummary.select(ctx(new Date('2026-10-09T23:00:00Z')))).toEqual([]); // 07:00 UB
        expect(await dailyOwnerSummary.select(ctx(new Date('2026-10-10T04:00:00Z')))).toEqual([]); // 12:00 UB
        expect(await dailyOwnerSummary.select(ctx(new Date('2026-10-10T01:00:00Z'), { hour: 10 }))).toEqual([]); // 09:00 < 10
    });
});

describe('outcomeFromDelivery', () => {
    const task = { customerName: 'Сараа', phone: '99112233', note: 'Үс засах — 15:00' };

    it('maps sent / skipped / undelivered', () => {
        expect(outcomeFromDelivery({ status: 'sent', channel: 'text', platform: 'messenger' }, task).status).toBe('sent');
        expect(outcomeFromDelivery({ status: 'skipped', reason: 'no_recipient' }, task).status).toBe('skipped');

        const owner = outcomeFromDelivery({ status: 'owner_notified', reason: 'outside_window_no_template' }, task);
        expect(owner.status).toBe('awaiting_approval');
        expect(owner.result?.task).toEqual({ type: 'call_customer', customer_name: 'Сараа', phone: '99112233', note: task.note });
    });
});

describe('beauty pack automations', () => {
    it('registers reminders and the morning summary under beauty.*', () => {
        expect(PACK_AUTOMATIONS.beauty?.map((a) => a.key)).toEqual(['reminder_24h', 'reminder_2h', 'daily_owner_summary']);
        expect(findAutomation(PACK_AUTOMATIONS, 'beauty.reminder_2h')?.def.kind).toBe('customer_message');
        expect(findAutomation(PACK_AUTOMATIONS, 'retail.reminder_2h')).toBeNull();
        expect(findAutomation(PACK_AUTOMATIONS, 'nodot')).toBeNull();
    });

    it('reminder text names the shop, service and UB time', () => {
        expect(buildReminderText({ shopName: 'Гоо салон', service: 'Үс засах', when: '10-р сарын 11, 15:00' }))
            .toContain('Гоо салон-д 10-р сарын 11, 15:00-д "Үс засах"');
    });
});
