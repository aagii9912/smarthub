import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase } from './supabaseMock';

const supabaseAdmin = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => supabaseAdmin() }));
vi.mock('@/lib/notifications', () => ({ sendPushNotification: vi.fn() }));
vi.mock('@/lib/notifications-prefs', () => ({ isNotificationEnabled: vi.fn() }));

import {
    abandonedCart,
    buildCartNudgeText,
    buildPaymentReminderText,
    formatSalesSummary,
    paymentReminder,
    summarizeSales,
    type DayOrder,
} from '../automations/commerce';
import { currentStage, followUpNote, formatPipelineSummary, leadFollowup } from '../automations/lead';
import { PACK_AUTOMATIONS, automationSlug } from '../automations';
import { configNumber, configSchemaFor, summaryHourField } from '../automations/shared';
import { isDueForSelect } from '../dispatcher';
import { PACK_IDS } from '@/lib/industry-packs/registry';

// 2026-10-10 08:30 Ulaanbaatar
const NOW = new Date('2026-10-10T00:30:00Z');
const ctx = (config: Record<string, unknown> = {}) => ({ shopId: 'shop-1', config, mode: 'auto' as const, now: NOW });

beforeEach(() => supabaseAdmin.mockReset());

describe('commerce: payment reminder', () => {
    it('includes the amount and the pay link', () => {
        const text = buildPaymentReminderText({ orderRef: 'ab12cd34', amount: 125000, payUrl: 'https://www.syncly.mn/pay/p1' });
        expect(text).toContain('#ab12cd34');
        expect(text).toContain('125,000₮');
        expect(text).toContain('https://www.syncly.mn/pay/p1');
    });

    it('selects pending QPay payments 8–14 minutes old, one run per payment', async () => {
        const { client, calls } = mockSupabase({ payments: { data: [{ id: 'pay-1', order_id: 'ord-1' }], error: null } });
        supabaseAdmin.mockReturnValue(client);

        expect(await paymentReminder.select(ctx())).toEqual([
            { subjectType: 'order', subjectId: 'ord-1', windowKey: 'pay-1', payload: { payment_id: 'pay-1' } },
        ]);
        const range = calls.filter((c) => c.method === 'gte' || c.method === 'lte').map((c) => c.args[1]);
        expect(range).toEqual([
            new Date(NOW.getTime() - 14 * 60_000).toISOString(),
            new Date(NOW.getTime() - 8 * 60_000).toISOString(),
        ]);
    });

    it('skips orders that were paid or cancelled in the meantime', async () => {
        const { client } = mockSupabase({
            orders: { data: { id: 'ord-1', status: 'pending', customer_id: 'c1' }, error: null },
            payments: { data: { id: 'pay-1', status: 'paid', amount: 1000 }, error: null },
        });
        supabaseAdmin.mockReturnValue(client);
        const run = { subject_id: 'ord-1', payload: { payment_id: 'pay-1' }, agent_slug: 'retail.payment_reminder' };
        expect(await paymentReminder.execute(ctx(), run as never)).toEqual({ status: 'skipped', result: { reason: 'already_paid' } });
    });
});

describe('commerce: abandoned cart', () => {
    it('names up to three items', () => {
        expect(buildCartNudgeText(['Цамц', 'Гутал'])).toContain('Цамц, Гутал үлдсэн');
        expect(buildCartNudgeText(['A', 'B', 'C', 'D', 'E'])).toContain('A, B, C болон өөр 2');
    });

    it('ignores empty carts and keys on the cart version', async () => {
        const { client } = mockSupabase({
            carts: {
                data: [
                    { id: 'cart-1', updated_at: '2026-10-09T21:00:00Z', customer_id: 'c1', cart_items: [{ id: 'i1' }] },
                    { id: 'cart-2', updated_at: '2026-10-09T21:00:00Z', customer_id: 'c2', cart_items: [] },
                ],
                error: null,
            },
        });
        supabaseAdmin.mockReturnValue(client);
        expect(await abandonedCart.select(ctx())).toEqual([
            { subjectType: 'cart', subjectId: 'cart-1', windowKey: '2026-10-09T21:00:00.000Z' },
        ]);
    });
});

describe('commerce: daily sales summary', () => {
    const order = (created_at: string, status: string, payment_status = 'pending', total_amount = 0): DayOrder => ({
        created_at,
        status,
        payment_status,
        total_amount,
    });

    it('counts yesterday in UB days and open fulfilment', () => {
        const s = summarizeSales(
            [
                order('2026-10-09T02:00:00Z', 'delivered', 'paid', 50000), // yesterday 10:00 UB
                order('2026-10-09T10:00:00Z', 'confirmed', 'pending', 30000), // yesterday, to fulfil, unpaid
                order('2026-10-09T05:00:00Z', 'cancelled'),
                order('2026-10-07T05:00:00Z', 'processing'), // older, still to fulfil
                order('2026-10-08T15:00:00Z', 'delivered', 'paid', 99999), // 23:00 UB day before → not yesterday
            ],
            NOW,
        );
        expect(s).toEqual({ yesterdayOrders: 2, yesterdayRevenue: 50000, yesterdayCancelled: 1, toFulfil: 2 });
        expect(formatSalesSummary(s)?.body).toBe('Өчигдөр 2 захиалга (50,000₮ орлого) · 2 захиалга бэлдэж/хүргэх · 1 цуцлагдсан');
        expect(formatSalesSummary({ yesterdayOrders: 0, yesterdayRevenue: 0, yesterdayCancelled: 0, toFulfil: 0 })).toBeNull();
    });
});

describe('lead: follow-up', () => {
    it('reads the most advanced stage tag', () => {
        expect(currentStage(['VIP', 'Холбогдсон', 'Үзлэг'])).toBe('Үзлэг');
        expect(currentStage(null)).toBeNull();
        expect(followUpNote(3, ['Хэлэлцээр'])).toBe('3+ хоног холбогдоогүй лийд (Хэлэлцээр) — дахин холбогдоорой');
    });

    it('drops closed leads, caps the batch and keys on last contact', async () => {
        const open = Array.from({ length: 25 }, (_, i) => ({ id: `l${i}`, last_contact_at: null, tags: ['Холбогдсон'] }));
        const { client } = mockSupabase({
            customers: {
                data: [{ id: 'won', last_contact_at: '2026-10-07T00:00:00Z', tags: ['Хөрвүүлсэн'] }, ...open],
                error: null,
            },
        });
        supabaseAdmin.mockReturnValue(client);
        const subjects = await leadFollowup.select(ctx());
        expect(subjects).toHaveLength(20);
        expect(subjects.some((s) => s.subjectId === 'won')).toBe(false);
        expect(subjects[0]).toMatchObject({ subjectType: 'customer', windowKey: 'never' });
    });

    it('turns a still-stale lead into a call task, skips one contacted since', async () => {
        const lead = { id: 'l1', name: 'Бат', phone: '99001122', tags: ['Үзлэг'], last_contact_at: '2026-10-07T00:00:00Z' };
        supabaseAdmin.mockReturnValue(mockSupabase({ customers: { data: lead, error: null } }).client);

        const task = await leadFollowup.execute(ctx({ days: 3 }), {
            subject_id: 'l1',
            payload: { last_contact_at: '2026-10-07T00:00:00Z' },
        } as never);
        expect(task.status).toBe('awaiting_approval');
        expect(task.result?.task).toEqual({
            type: 'call_customer',
            customer_name: 'Бат',
            phone: '99001122',
            note: '3+ хоног холбогдоогүй лийд (Үзлэг) — дахин холбогдоорой',
        });

        const skipped = await leadFollowup.execute(ctx(), { subject_id: 'l1', payload: { last_contact_at: null } } as never);
        expect(skipped).toEqual({ status: 'skipped', result: { reason: 'contacted_since' } });
    });

    it('formats the pipeline push', () => {
        expect(formatPipelineSummary({ newLeads: 4, newWithPhone: 3, waitingFollowUp: 12 })?.body).toBe(
            'Өчигдөр 4 шинэ лийд (3 утастай) · 12 лийд дагалт хүлээж байна',
        );
        expect(formatPipelineSummary({ newLeads: 0, newWithPhone: 0, waitingFollowUp: 0 })).toBeNull();
    });
});

describe('automation registry', () => {
    it('every industry pack has automations with valid, unique slugs', () => {
        for (const packId of PACK_IDS) {
            const defs = PACK_AUTOMATIONS[packId];
            expect(defs.length).toBeGreaterThan(0);
            const keys = defs.map((d) => d.key);
            expect(new Set(keys).size).toBe(keys.length);
            for (const d of defs) {
                // must satisfy the shop_agents.agent_slug CHECK
                expect(automationSlug(packId, d.key)).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
                for (const f of d.configFields ?? []) {
                    expect(f.default).toBeGreaterThanOrEqual(f.min);
                    expect(f.default).toBeLessThanOrEqual(f.max);
                }
            }
        }
    });

    it('follows the founder default: payment/booking reminders auto, sales follow-up approve', () => {
        const all = PACK_IDS.flatMap((id) => PACK_AUTOMATIONS[id]);
        for (const d of all.filter((x) => x.kind === 'customer_message')) {
            const expected = d.key === 'abandoned_cart' ? 'approve' : 'auto';
            expect(d.defaultMode).toBe(expected);
        }
    });
});

describe('config + scheduling helpers', () => {
    it('validates owner config against the declared fields', () => {
        const schema = configSchemaFor([summaryHourField]);
        expect(schema.safeParse({ hour: 9 }).success).toBe(true);
        expect(schema.safeParse({ hour: 23 }).success).toBe(false);
        expect(schema.safeParse({ other: 1 }).success).toBe(false);
        expect(configNumber({ hour: 99 }, summaryHourField)).toBe(8);
        expect(configNumber({ hour: 10 }, summaryHourField)).toBe(10);
    });

    it('throttles select() by intervalMinutes', () => {
        const hourly = { ...leadFollowup };
        expect(isDueForSelect(hourly, null, NOW)).toBe(true);
        expect(isDueForSelect(hourly, new Date(NOW.getTime() - 30 * 60_000).toISOString(), NOW)).toBe(false);
        expect(isDueForSelect(hourly, new Date(NOW.getTime() - 61 * 60_000).toISOString(), NOW)).toBe(true);
        expect(isDueForSelect(paymentReminder, new Date(NOW.getTime() - 60_000).toISOString(), NOW)).toBe(true);
    });
});
