/**
 * Appointment Handler Tests
 * Tests: book_appointment / list_appointments timezone handling.
 *
 * Production runs on Vercel in UTC while customers mean Asia/Ulaanbaatar
 * (UTC+8) wall-clock time, so the process TZ is pinned to UTC here. Without
 * this a dev machine set to UB time would hide every bug these tests guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockContext } from './fixtures';

vi.hoisted(() => {
    process.env.TZ = 'UTC';
});

// ─── Mock Dependencies ──────────────────────────────────────────
interface QueryCall { method: string; args: unknown[] }

const db: {
    products: Record<string, unknown>[];
    upcoming: Record<string, unknown>[];
    calls: Record<string, QueryCall[]>;
    inserted: Record<string, unknown> | null;
} = { products: [], upcoming: [], calls: {}, inserted: null };

// Chainable PostgREST-like builder: every filter returns the builder, and
// awaiting it (or calling a terminal method) resolves the table's fixture.
function query(table: string) {
    const calls: QueryCall[] = (db.calls[table] ??= []);
    const result = () =>
        table === 'products'
            ? { data: db.products, error: null }
            : { data: db.upcoming, count: 0, error: null };
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'lt', 'order', 'limit']) {
        q[method] = vi.fn((...args: unknown[]) => {
            calls.push({ method, args });
            return q;
        });
    }
    q.insert = vi.fn((row: Record<string, unknown>) => {
        db.inserted = row;
        return q;
    });
    q.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    q.single = vi.fn(() =>
        Promise.resolve({ data: { id: 'appt-0001-uuid', ...db.inserted }, error: null })
    );
    q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject);
    return q;
}

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => ({ from: vi.fn((table: string) => query(table)) })),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { executeBookAppointment } from '@/lib/ai/tools/handlers/appointment/bookAppointment';
import { executeListAppointments } from '@/lib/ai/tools/handlers/appointment/listAppointments';
import { parseUbDateTime } from '@/lib/operator/time';

const HAIRCUT = {
    id: 'prod-appt-1',
    name: 'Үс засалт',
    type: 'appointment',
    duration_minutes: 45,
    available_days: ['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа'],
    start_time: '09:00',
    end_time: '18:00',
    max_bookings_per_day: 8,
};

describe('Appointment handlers — Asia/Ulaanbaatar time', () => {
    const ctx = createMockContext();

    beforeEach(() => {
        // 2026-10-11 (Sunday) 10:00 in Ulaanbaatar
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-11T02:00:00Z'));
        db.products = [HAIRCUT];
        db.upcoming = [];
        db.calls = {};
        db.inserted = null;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs with the server clock in UTC, like production', () => {
        expect(new Date().getTimezoneOffset()).toBe(0);
    });

    describe('parseUbDateTime', () => {
        const iso = (s: string) => parseUbDateTime(s).toISOString();

        it('reads offset-less input as Ulaanbaatar wall-clock time', () => {
            expect(iso('2026-10-11T15:00')).toBe('2026-10-11T07:00:00.000Z');
            expect(iso('2026-10-11 15:00:30.5')).toBe('2026-10-11T07:00:30.500Z');
            expect(iso('2026-10-12T03:00:00')).toBe('2026-10-11T19:00:00.000Z');
        });

        it('respects an explicit offset or Z', () => {
            expect(iso('2026-10-11T15:00:00+08:00')).toBe('2026-10-11T07:00:00.000Z');
            expect(iso('2026-10-11T15:00:00+08')).toBe('2026-10-11T07:00:00.000Z');
            expect(iso('2026-10-11T07:00:00Z')).toBe('2026-10-11T07:00:00.000Z');
        });

        it('rejects impossible or malformed dates', () => {
            expect(parseUbDateTime('2026-02-30T10:00').getTime()).toBeNaN();
            expect(parseUbDateTime('2026-10-11T15:75').getTime()).toBeNaN();
            expect(parseUbDateTime('маргааш 3 цагт').getTime()).toBeNaN();
        });
    });

    describe('executeBookAppointment', () => {
        it('treats an offset-less scheduled_at as Ulaanbaatar local time', async () => {
            const result = await executeBookAppointment(
                { product_name: 'Үс', scheduled_at: '2026-10-12T15:00' },
                ctx
            );

            expect(result.success).toBe(true);
            // 15:00 UB == 07:00 UTC, not 15:00 UTC (23:00 UB)
            expect(db.inserted?.scheduled_at).toBe('2026-10-12T07:00:00.000Z');
            expect(result.message).toContain('15:00');
        });

        it('keeps an explicit +08:00 offset and labels it in UB time', async () => {
            const result = await executeBookAppointment(
                { product_name: 'Үс', scheduled_at: '2026-10-12T10:00:00+08:00' },
                ctx
            );

            // 10:00 UB is inside 09:00–18:00 even though it is 02:00 UTC
            expect(result.success).toBe(true);
            expect(db.inserted?.scheduled_at).toBe('2026-10-12T02:00:00.000Z');
            expect(result.message).toContain('10:00');
            expect(result.message).not.toContain('02:00');
        });

        it('checks working hours against UB wall-clock time', async () => {
            // 20:00 UB (12:00 UTC) is after closing even though 12:00 UTC "looks" open
            const result = await executeBookAppointment(
                { product_name: 'Үс', scheduled_at: '2026-10-12T20:00:00+08:00' },
                ctx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('ажлын цагт');
            expect(db.inserted).toBeNull();
        });

        it('checks the weekday in UB, not the UTC calendar day', async () => {
            // Saturday 07:00 UB is still Friday 23:00 UTC
            db.products = [{ ...HAIRCUT, start_time: null, end_time: null }];
            const result = await executeBookAppointment(
                { product_name: 'Үс', scheduled_at: '2026-10-17T07:00:00+08:00' },
                ctx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Бям');
            expect(db.inserted).toBeNull();
        });

        it('counts per-day capacity over the UB calendar day', async () => {
            await executeBookAppointment(
                { product_name: 'Үс', scheduled_at: '2026-10-12T15:00' },
                ctx
            );

            const capacityQuery = db.calls.appointments ?? [];
            const gte = capacityQuery.find(c => c.method === 'gte');
            const lt = capacityQuery.find(c => c.method === 'lt');
            // 2026-10-12 00:00 UB → 2026-10-13 00:00 UB
            expect(gte?.args).toEqual(['scheduled_at', '2026-10-11T16:00:00.000Z']);
            expect(lt?.args).toEqual(['scheduled_at', '2026-10-12T16:00:00.000Z']);
        });
    });

    describe('executeListAppointments', () => {
        it('labels stored UTC timestamps in UB time', async () => {
            db.upcoming = [
                {
                    id: 'appt-0001-uuid',
                    scheduled_at: '2026-10-12T07:00:00+00:00',
                    duration_minutes: 45,
                    status: 'pending',
                    products: { name: 'Үс засалт' },
                },
            ];

            const result = await executeListAppointments(ctx);

            expect(result.success).toBe(true);
            expect(result.message).toContain('15:00');
            expect(result.message).not.toContain('07:00');
        });
    });
});
