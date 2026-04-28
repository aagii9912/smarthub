/**
 * Integration tests for /api/cron/weekly-token-report.
 *
 * The cron is the user-facing surface for proactive token transparency —
 * if it spams shops or skips owners who should be notified, trust collapses.
 * Coverage:
 *   - Bearer auth gate in production
 *   - Auth bypass in dev / test (no CRON_SECRET set)
 *   - dry=1 returns previews and does NOT call sendTokenUsageReport
 *   - Skips when token_report_email_enabled = false (opt-out honored)
 *   - Skips when shop has no owner email
 *   - Skips when totalTokens === 0 (zero-spam guard)
 *   - Aggregates per-feature totals across multiple days
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

const { sendTokenUsageReportMock, supabaseAdminMock } = vi.hoisted(() => ({
    sendTokenUsageReportMock: vi.fn(),
    supabaseAdminMock: vi.fn(),
}));

vi.mock('@/lib/email/email', () => ({
    sendTokenUsageReport: sendTokenUsageReportMock,
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: supabaseAdminMock,
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}));

import { GET } from '@/app/api/cron/weekly-token-report/route';

// --- Helpers ---
interface BreakdownRow {
    shop_id: string;
    usage_date: string;
    feature: string;
    tokens_used: number;
    call_count: number;
    label_mn: string;
    sort_order: number;
}
interface ShopRow {
    id: string;
    name: string;
    user_id: string;
    token_report_email_enabled: boolean;
    user_profiles: { email: string | null } | null;
}

function buildSupabase(opts: { breakdown: BreakdownRow[]; shops: ShopRow[] }) {
    return {
        from(table: string) {
            const ordered = (data: unknown) => ({
                select() { return this; },
                eq() { return this; },
                gte() { return this; },
                in() { return this; },
                order() { return this; },
                limit() { return Promise.resolve({ data, error: null }); },
                single() { return Promise.resolve({ data, error: null }); },
                then(resolve: (val: { data: unknown; error: null }) => unknown) {
                    return Promise.resolve({ data, error: null }).then(resolve);
                },
            });
            if (table === 'v_shop_token_breakdown') return ordered(opts.breakdown);
            if (table === 'shops') return ordered(opts.shops);
            return ordered([]);
        },
    };
}

beforeEach(() => {
    sendTokenUsageReportMock.mockReset().mockResolvedValue(true);
    supabaseAdminMock.mockReset();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CRON_SECRET', '');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

// --- Tests ---

describe('weekly-token-report — auth gate', () => {
    it('rejects in production when bearer token is missing', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', 'top-secret');
        supabaseAdminMock.mockReturnValue(buildSupabase({ breakdown: [], shops: [] }));

        const req = new Request('http://localhost/api/cron/weekly-token-report');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        expect(res.status).toBe(401);
    });

    it('rejects in production when bearer token is wrong', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', 'top-secret');

        const req = new Request('http://localhost/api/cron/weekly-token-report', {
            headers: { authorization: 'Bearer wrong' },
        });
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        expect(res.status).toBe(401);
    });

    it('accepts in production when bearer matches CRON_SECRET', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', 'top-secret');
        supabaseAdminMock.mockReturnValue(buildSupabase({ breakdown: [], shops: [] }));

        const req = new Request('http://localhost/api/cron/weekly-token-report', {
            headers: { authorization: 'Bearer top-secret' },
        });
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        expect(res.status).toBe(200);
    });

    it('skips bearer check in dev/test (no CRON_SECRET)', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({ breakdown: [], shops: [] }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        expect(res.status).toBe(200);
    });
});

describe('weekly-token-report — empty input', () => {
    it('returns ok with sent=0 when no shops have usage in window', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({ breakdown: [], shops: [] }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.ok).toBe(true);
        expect(body.sent).toBe(0);
        expect(body.reason).toMatch(/no usage/i);
        expect(sendTokenUsageReportMock).not.toHaveBeenCalled();
    });
});

describe('weekly-token-report — opt-out and email guards', () => {
    it('skips shop where token_report_email_enabled = false (honors unsubscribe)', async () => {
        const today = new Date().toISOString().split('T')[0];
        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-A', usage_date: today, feature: 'chat_reply', tokens_used: 5000, call_count: 50, label_mn: 'Чат хариулт', sort_order: 1 },
            ],
            shops: [
                { id: 'shop-A', name: 'A Shop', user_id: 'u1', token_report_email_enabled: false, user_profiles: { email: 'owner@a.com' } },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.sent).toBe(0);
        expect(body.skipped).toBe(1);
        expect(sendTokenUsageReportMock).not.toHaveBeenCalled();
    });

    it('skips shop with no owner email (cannot deliver)', async () => {
        const today = new Date().toISOString().split('T')[0];
        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-B', usage_date: today, feature: 'chat_reply', tokens_used: 5000, call_count: 50, label_mn: 'Чат хариулт', sort_order: 1 },
            ],
            shops: [
                { id: 'shop-B', name: 'B Shop', user_id: 'u2', token_report_email_enabled: true, user_profiles: { email: null } },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.sent).toBe(0);
        expect(body.skipped).toBe(1);
        expect(sendTokenUsageReportMock).not.toHaveBeenCalled();
    });

    it('skips shop with totalTokens === 0 (zero-spam guard)', async () => {
        const today = new Date().toISOString().split('T')[0];
        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-Z', usage_date: today, feature: 'chat_reply', tokens_used: 0, call_count: 0, label_mn: 'Чат хариулт', sort_order: 1 },
            ],
            shops: [
                { id: 'shop-Z', name: 'Z Shop', user_id: 'u3', token_report_email_enabled: true, user_profiles: { email: 'owner@z.com' } },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.sent).toBe(0);
        expect(body.skipped).toBe(1);
        expect(sendTokenUsageReportMock).not.toHaveBeenCalled();
    });
});

describe('weekly-token-report — happy path send', () => {
    it('aggregates per-feature totals across multiple days and sends one email per shop', async () => {
        const day1 = '2026-04-22';
        const day2 = '2026-04-25';

        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-1', usage_date: day1, feature: 'chat_reply', tokens_used: 5000, call_count: 20, label_mn: 'Чат хариулт', sort_order: 1 },
                { shop_id: 'shop-1', usage_date: day2, feature: 'chat_reply', tokens_used: 3000, call_count: 12, label_mn: 'Чат хариулт', sort_order: 1 },
                { shop_id: 'shop-1', usage_date: day1, feature: 'vision',     tokens_used: 1500, call_count:  5, label_mn: 'Зураг шинжилгээ', sort_order: 3 },
                { shop_id: 'shop-1', usage_date: day2, feature: 'ai_memo',    tokens_used:  400, call_count:  2, label_mn: 'Хэрэглэгчийн тэмдэглэл', sort_order: 2 },
            ],
            shops: [
                { id: 'shop-1', name: 'Acme', user_id: 'u1', token_report_email_enabled: true, user_profiles: { email: 'owner@acme.mn' } },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.sent).toBe(1);
        expect(body.skipped).toBe(0);
        expect(sendTokenUsageReportMock).toHaveBeenCalledTimes(1);

        const callArg = sendTokenUsageReportMock.mock.calls[0][0];
        expect(callArg.to).toBe('owner@acme.mn');
        expect(callArg.shopName).toBe('Acme');
        // 5000 + 3000 + 1500 + 400 = 9900
        expect(callArg.totalTokens).toBe(9900);
        // 20 + 12 + 5 + 2 = 39
        expect(callArg.totalCalls).toBe(39);

        // Rows are sorted by sort_order: chat_reply(1), ai_memo(2), vision(3)
        const rows: Array<{ feature: string; tokens: number; calls: number }> = callArg.rows;
        expect(rows.map((r) => r.feature)).toEqual(['chat_reply', 'ai_memo', 'vision']);
        // Per-feature aggregates
        expect(rows.find((r) => r.feature === 'chat_reply')!.tokens).toBe(8000);
        expect(rows.find((r) => r.feature === 'chat_reply')!.calls).toBe(32);
        expect(rows.find((r) => r.feature === 'vision')!.tokens).toBe(1500);
        expect(rows.find((r) => r.feature === 'ai_memo')!.tokens).toBe(400);

        // Unsubscribe URL is provided
        expect(callArg.unsubscribeUrl).toMatch(/\/api\/email\/unsubscribe\?shop=shop-1/);
        expect(callArg.dashboardUrl).toMatch(/\/dashboard\/reports/);
    });

    it('handles user_profiles arriving as an array (Supabase 1-to-1 join shape)', async () => {
        const today = new Date().toISOString().split('T')[0];

        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-arr', usage_date: today, feature: 'chat_reply', tokens_used: 1000, call_count: 1, label_mn: 'Чат хариулт', sort_order: 1 },
            ],
            shops: [
                {
                    id: 'shop-arr', name: 'Arr Shop', user_id: 'u9',
                    token_report_email_enabled: true,
                    // Some Supabase clients return joined relations as arrays
                    user_profiles: [{ email: 'arr@shop.mn' }] as unknown as { email: string | null },
                },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.sent).toBe(1);
        expect(sendTokenUsageReportMock).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'arr@shop.mn' })
        );
    });
});

describe('weekly-token-report — dry-run', () => {
    it('?dry=1 returns previews and does not invoke sendTokenUsageReport', async () => {
        const today = new Date().toISOString().split('T')[0];

        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-1', usage_date: today, feature: 'chat_reply', tokens_used: 8000, call_count: 30, label_mn: 'Чат хариулт', sort_order: 1 },
            ],
            shops: [
                { id: 'shop-1', name: 'A', user_id: 'u1', token_report_email_enabled: true, user_profiles: { email: 'a@a.mn' } },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/cron/weekly-token-report?dry=1') as unknown as Parameters<typeof GET>[0]);
        const body = await res.json();

        expect(body.dryRun).toBe(true);
        expect(body.previews).toEqual([
            { shopId: 'shop-1', to: 'a@a.mn', totalTokens: 8000 },
        ]);
        expect(sendTokenUsageReportMock).not.toHaveBeenCalled();
    });
});

describe('weekly-token-report — unsubscribe URL signing', () => {
    it('includes HMAC sig in unsubscribe URL when CRON_SECRET is set', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', 'super-secret');
        const today = new Date().toISOString().split('T')[0];

        supabaseAdminMock.mockReturnValue(buildSupabase({
            breakdown: [
                { shop_id: 'shop-sig', usage_date: today, feature: 'chat_reply', tokens_used: 1000, call_count: 1, label_mn: 'Чат хариулт', sort_order: 1 },
            ],
            shops: [
                { id: 'shop-sig', name: 'Sig', user_id: 'u', token_report_email_enabled: true, user_profiles: { email: 's@s.mn' } },
            ],
        }));

        const req = new Request('http://localhost/api/cron/weekly-token-report', {
            headers: { authorization: 'Bearer super-secret' },
        });
        await GET(req as unknown as Parameters<typeof GET>[0]);

        const expectedSig = crypto
            .createHmac('sha256', 'super-secret')
            .update('unsubscribe:shop-sig')
            .digest('hex');

        const callArg = sendTokenUsageReportMock.mock.calls[0][0];
        expect(callArg.unsubscribeUrl).toContain(`shop=shop-sig`);
        expect(callArg.unsubscribeUrl).toContain(`sig=${expectedSig}`);
    });
});
