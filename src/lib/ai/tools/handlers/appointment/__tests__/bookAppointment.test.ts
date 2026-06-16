/**
 * Tests for the book_appointment AI tool handler.
 *
 * Appointment booking is a whole AI feature with zero coverage while its
 * sibling order/cart/product handlers are tested. The booking guards are the
 * risky part — they're the difference between a valid reservation and a
 * double-booked / past-dated / out-of-hours slot the shop has to clean up:
 *   - missing shop/customer context,
 *   - fuzzy product resolution + "not found",
 *   - past / malformed timestamps,
 *   - day-of-week + working-hours windows,
 *   - per-day capacity cap,
 *   - idempotency (same customer + product + slot),
 *   - successful insert payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseAdminMock } = vi.hoisted(() => ({ supabaseAdminMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: supabaseAdminMock }));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

import { executeBookAppointment } from '@/lib/ai/tools/handlers/appointment/bookAppointment';
import type { ToolExecutionContext } from '@/lib/ai/services/ToolExecutor';

// Must mirror the handler's WEEKDAYS_MN (Sunday-indexed) so day-of-week
// assertions stay deterministic regardless of which day the test runs.
const WEEKDAYS_MN = ['Ням', 'Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям'];

interface AppointmentProduct {
    id: string;
    name: string;
    type: string;
    duration_minutes: number | null;
    available_days: string[] | null;
    start_time: string | null;
    end_time: string | null;
    max_bookings_per_day: number | null;
}

interface SupabaseConfig {
    products?: AppointmentProduct[];
    count?: number;
    existing?: { id: string } | null;
    appointment?: Record<string, unknown> | null;
    insertError?: { message: string } | null;
}

function makeSupabase(cfg: SupabaseConfig) {
    const inserts: Record<string, unknown>[] = [];

    return {
        inserts,
        client: {
            from(table: string) {
                if (table === 'products') {
                    const b: Record<string, unknown> = {};
                    b.select = () => b;
                    b.eq = () => b;
                    b.then = (resolve: (v: unknown) => unknown) =>
                        Promise.resolve({ data: cfg.products ?? [], error: null }).then(resolve);
                    return b;
                }
                // appointments table — select can be a count(head) query, an
                // idempotency maybeSingle, or an insert.
                let isCount = false;
                const b: Record<string, unknown> = {};
                b.select = (_col?: unknown, opts?: { count?: string }) => {
                    if (opts?.count) isCount = true;
                    return b;
                };
                for (const m of ['eq', 'in', 'gte', 'lt'] as const) b[m] = () => b;
                b.maybeSingle = () => Promise.resolve({ data: cfg.existing ?? null, error: null });
                b.insert = (payload: Record<string, unknown>) => {
                    inserts.push(payload);
                    return {
                        select: () => ({
                            single: () =>
                                Promise.resolve({
                                    data: cfg.insertError
                                        ? null
                                        : cfg.appointment ?? {
                                              id: 'appt-12345678',
                                              scheduled_at: payload.scheduled_at,
                                              duration_minutes: payload.duration_minutes,
                                          },
                                    error: cfg.insertError ?? null,
                                }),
                        }),
                    };
                };
                b.then = (resolve: (v: unknown) => unknown) =>
                    Promise.resolve(isCount ? { count: cfg.count ?? 0, error: null } : { data: [], error: null }).then(resolve);
                return b;
            },
        },
    };
}

const ctx = (overrides?: Partial<ToolExecutionContext>): ToolExecutionContext =>
    ({ shopId: 'shop-1', customerId: 'cust-1', customerName: 'Болд', products: [] as never, ...overrides } as ToolExecutionContext);

const futureISO = (daysAhead = 7, hour = 12) => {
    const d = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d;
};

const baseProduct: AppointmentProduct = {
    id: 'svc-1',
    name: 'Үс засалт',
    type: 'appointment',
    duration_minutes: 30,
    available_days: null,
    start_time: null,
    end_time: null,
    max_bookings_per_day: null,
};

beforeEach(() => {
    supabaseAdminMock.mockReset();
});

describe('executeBookAppointment — guards', () => {
    it('fails when shop/customer context is missing', async () => {
        supabaseAdminMock.mockReturnValue(makeSupabase({}).client);
        const res = await executeBookAppointment(
            { product_name: 'Үс засалт', scheduled_at: futureISO().toISOString() },
            ctx({ shopId: undefined as never }),
        );
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Missing shop or customer/);
    });

    it('fails when no matching appointment product is found', async () => {
        supabaseAdminMock.mockReturnValue(makeSupabase({ products: [] }).client);
        const res = await executeBookAppointment(
            { product_name: 'Массаж', scheduled_at: futureISO().toISOString() },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toContain('олдсонгүй');
    });

    it('rejects a malformed (non-ISO) timestamp', async () => {
        supabaseAdminMock.mockReturnValue(makeSupabase({ products: [baseProduct] }).client);
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: 'not-a-date' },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/буруу формат/);
    });

    it('rejects a past timestamp', async () => {
        supabaseAdminMock.mockReturnValue(makeSupabase({ products: [baseProduct] }).client);
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: new Date(Date.now() - 3600_000).toISOString() },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Өнгөрсөн цагт/);
    });

    it('rejects a day the service does not operate', async () => {
        const slot = futureISO();
        const dayName = WEEKDAYS_MN[slot.getDay()];
        const otherDays = WEEKDAYS_MN.filter((d) => d !== dayName);
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ products: [{ ...baseProduct, available_days: otherDays }] }).client,
        );
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: slot.toISOString() },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toContain('ажилладаггүй');
    });

    it('rejects a slot outside working hours', async () => {
        const slot = futureISO(7, 22); // 22:00 local
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ products: [{ ...baseProduct, start_time: '09:00', end_time: '18:00' }] }).client,
        );
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: slot.toISOString() },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/ажлын цагт/);
    });

    it('rejects when the day is already at capacity', async () => {
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ products: [{ ...baseProduct, max_bookings_per_day: 2 }], count: 2 }).client,
        );
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: futureISO().toISOString() },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toContain('дүүрсэн');
    });
});

describe('executeBookAppointment — idempotency + success', () => {
    it('returns the existing booking instead of creating a duplicate', async () => {
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ products: [baseProduct], existing: { id: 'appt-existing-1' } }).client,
        );
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: futureISO().toISOString() },
            ctx(),
        );
        expect(res.success).toBe(true);
        expect(res.data?.duplicate).toBe(true);
        expect(res.data?.appointmentId).toBe('appt-existing-1');
    });

    it('creates a new appointment with the resolved product + slot', async () => {
        const slot = futureISO();
        const sb = makeSupabase({ products: [baseProduct] });
        supabaseAdminMock.mockReturnValue(sb.client);

        const res = await executeBookAppointment(
            { product_name: 'үс', scheduled_at: slot.toISOString(), notes: 'богино' },
            ctx(),
        );

        expect(res.success).toBe(true);
        expect(res.data?.appointmentId).toBe('appt-12345678');
        expect(res.data?.productName).toBe('Үс засалт');

        // The insert payload pins the FK + slot the AI resolved.
        expect(sb.inserts).toHaveLength(1);
        const payload = sb.inserts[0];
        expect(payload.shop_id).toBe('shop-1');
        expect(payload.customer_id).toBe('cust-1');
        expect(payload.product_id).toBe('svc-1');
        expect(payload.status).toBe('pending');
        expect(payload.notes).toBe('богино');
        expect(payload.scheduled_at).toBe(slot.toISOString());
    });

    it('surfaces an error when the insert fails', async () => {
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ products: [baseProduct], insertError: { message: 'insert failed' } }).client,
        );
        const res = await executeBookAppointment(
            { product_name: 'Үс', scheduled_at: futureISO().toISOString() },
            ctx(),
        );
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/алдаа гарлаа/);
    });
});
