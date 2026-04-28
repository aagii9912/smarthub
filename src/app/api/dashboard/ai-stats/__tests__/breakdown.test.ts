/**
 * Integration test for /api/dashboard/ai-stats — focuses on the new
 * `breakdown` payload (Phase 4 of the per-feature token-usage rollout).
 *
 * The route mixes 5 parallel Supabase queries; we mock them to return
 * deterministic fixtures and assert the response shape. Critical
 * properties tested:
 *   - Returns 401 on auth failure
 *   - `breakdown.current_period` is sorted by sort_order and aggregates
 *     tokens + calls per feature
 *   - `breakdown.last_30_days` is sorted by date ascending
 *   - Backwards-compat: existing top-level fields still present
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAuthUserShopMock, supabaseAdminMock } = vi.hoisted(() => ({
    getAuthUserShopMock: vi.fn(),
    supabaseAdminMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({
    getAuthUserShop: getAuthUserShopMock,
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: supabaseAdminMock,
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { GET } from '@/app/api/dashboard/ai-stats/route';

// --- Helpers ---
function buildSupabase(opts: {
    shopFull: Record<string, unknown> | null;
    chatHistory: Array<{ id: string; intent: string | null; created_at: string }>;
    customers: Array<{ id: string; phone: string | null; email: string | null; message_count: number; created_at: string }>;
    dailyMessages: Array<{ created_at: string }>;
    topCustomers: Array<{ id: string; name: string | null; phone: string | null; message_count: number; created_at: string }>;
    breakdown: Array<{
        usage_date: string;
        feature: string;
        tokens_used: number;
        call_count: number;
        label_mn: string;
        label_en: string;
        sort_order: number;
    }>;
}) {
    return {
        from(table: string) {
            // Each query is one chain; we return shape based on table name
            const ordered = (data: unknown) => ({
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

            const builder = {
                select() {
                    if (table === 'shops') return ordered(opts.shopFull);
                    if (table === 'chat_history') return ordered(opts.chatHistory.length ? opts.chatHistory : opts.dailyMessages);
                    if (table === 'customers') return ordered(opts.customers);
                    if (table === 'v_shop_token_breakdown') return ordered(opts.breakdown);
                    return ordered([]);
                },
            };

            // The chat_history table is queried twice (full + dailyMessages).
            // Stateful select() to alternate.
            let chatQueryIndex = 0;
            if (table === 'chat_history') {
                builder.select = () => {
                    const data = chatQueryIndex === 0 ? opts.chatHistory : opts.dailyMessages;
                    chatQueryIndex++;
                    return ordered(data);
                };
            }
            if (table === 'customers') {
                let customerIndex = 0;
                builder.select = () => {
                    const data = customerIndex === 0 ? opts.customers : opts.topCustomers;
                    customerIndex++;
                    return ordered(data);
                };
            }
            return builder;
        },
    };
}

beforeEach(() => {
    getAuthUserShopMock.mockReset();
    supabaseAdminMock.mockReset();
});

describe('/api/dashboard/ai-stats — auth gate', () => {
    it('returns 401 when no authenticated shop', async () => {
        getAuthUserShopMock.mockResolvedValue(null);

        const res = await GET(new Request('http://localhost/api/dashboard/ai-stats'));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Unauthorized');
    });
});

describe('/api/dashboard/ai-stats — breakdown payload', () => {
    const today = new Date().toISOString().split('T')[0];

    beforeEach(() => {
        getAuthUserShopMock.mockResolvedValue({ id: 'shop-1', name: 'Test Shop' });
    });

    it('aggregates tokens per feature for the current period', async () => {
        // Period defaults to "month" — startDate is 1st of current month.
        // We use today's date so the rows fall inside the current period.
        supabaseAdminMock.mockReturnValue(buildSupabase({
            shopFull: {
                subscription_plan: 'pro',
                subscription_status: 'active',
                token_usage_total: 30000,
                token_usage_reset_at: null,
            },
            chatHistory: [],
            customers: [],
            dailyMessages: [],
            topCustomers: [],
            breakdown: [
                { usage_date: today, feature: 'chat_reply', tokens_used: 12000, call_count: 50, label_mn: 'Чат хариулт', label_en: 'Chat reply', sort_order: 1 },
                { usage_date: today, feature: 'chat_reply', tokens_used: 3000, call_count: 10, label_mn: 'Чат хариулт', label_en: 'Chat reply', sort_order: 1 },
                { usage_date: today, feature: 'ai_memo', tokens_used: 800, call_count: 4, label_mn: 'Хэрэглэгчийн тэмдэглэл', label_en: 'Customer memo', sort_order: 2 },
                { usage_date: today, feature: 'vision', tokens_used: 2200, call_count: 7, label_mn: 'Зураг шинжилгээ', label_en: 'Image vision', sort_order: 3 },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/dashboard/ai-stats?period=month'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.breakdown).toBeDefined();
        expect(body.breakdown.current_period).toBeInstanceOf(Array);

        const cp: Array<{ feature: string; tokens: number; calls: number; label_mn: string; label_en: string }> =
            body.breakdown.current_period;

        // Sorted by sort_order: chat_reply(1), ai_memo(2), vision(3)
        expect(cp.map((r) => r.feature)).toEqual(['chat_reply', 'ai_memo', 'vision']);

        // chat_reply rows aggregate: 12000 + 3000 = 15000 tokens, 60 calls
        const chat = cp.find((r) => r.feature === 'chat_reply')!;
        expect(chat.tokens).toBe(15000);
        expect(chat.calls).toBe(60);

        const memo = cp.find((r) => r.feature === 'ai_memo')!;
        expect(memo.tokens).toBe(800);
        expect(memo.label_mn).toBe('Хэрэглэгчийн тэмдэглэл');
    });

    it('returns last_30_days as date-sorted entries with by_feature totals', async () => {
        const yesterday = new Date(Date.now() - 86400_000).toISOString().split('T')[0];

        supabaseAdminMock.mockReturnValue(buildSupabase({
            shopFull: { subscription_plan: 'lite', subscription_status: 'active', token_usage_total: 0 },
            chatHistory: [],
            customers: [],
            dailyMessages: [],
            topCustomers: [],
            breakdown: [
                { usage_date: today,    feature: 'chat_reply', tokens_used: 100, call_count: 1, label_mn: 'Чат хариулт', label_en: 'Chat reply', sort_order: 1 },
                { usage_date: yesterday, feature: 'chat_reply', tokens_used: 50,  call_count: 1, label_mn: 'Чат хариулт', label_en: 'Chat reply', sort_order: 1 },
                { usage_date: yesterday, feature: 'vision',     tokens_used: 70,  call_count: 1, label_mn: 'Зураг шинжилгээ', label_en: 'Image vision', sort_order: 3 },
            ],
        }));

        const res = await GET(new Request('http://localhost/api/dashboard/ai-stats'));
        const body = await res.json();

        const days: Array<{ date: string; by_feature: Record<string, number> }> = body.breakdown.last_30_days;
        // Sorted ascending by date
        expect(days[0].date).toBe(yesterday);
        expect(days[1].date).toBe(today);

        // Same-feature same-day rows are summed
        expect(days[0].by_feature.chat_reply).toBe(50);
        expect(days[0].by_feature.vision).toBe(70);
        expect(days[1].by_feature.chat_reply).toBe(100);
    });

    it('returns empty arrays when shop has no breakdown rows yet (new shop)', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({
            shopFull: { subscription_plan: 'lite', subscription_status: 'active', token_usage_total: 0 },
            chatHistory: [],
            customers: [],
            dailyMessages: [],
            topCustomers: [],
            breakdown: [],
        }));

        const res = await GET(new Request('http://localhost/api/dashboard/ai-stats'));
        const body = await res.json();

        expect(body.breakdown.current_period).toEqual([]);
        expect(body.breakdown.last_30_days).toEqual([]);
    });

    it('preserves backward-compatible top-level fields (intentBreakdown, dailyMessages, plan, etc.)', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({
            shopFull: { subscription_plan: 'pro', subscription_status: 'active', token_usage_total: 5000 },
            chatHistory: [],
            customers: [],
            dailyMessages: [],
            topCustomers: [],
            breakdown: [],
        }));

        const res = await GET(new Request('http://localhost/api/dashboard/ai-stats'));
        const body = await res.json();

        // These fields predate the breakdown work and must remain
        expect(body).toHaveProperty('totalConversations');
        expect(body).toHaveProperty('totalMessages');
        expect(body).toHaveProperty('creditUsage');
        expect(body).toHaveProperty('tokenUsage');
        expect(body).toHaveProperty('plan');
        expect(body).toHaveProperty('intentBreakdown');
        expect(body).toHaveProperty('dailyMessages');
        expect(body).toHaveProperty('topCustomers');
        expect(body).toHaveProperty('contactsCollected');
        expect(body).toHaveProperty('emailsCollected');
        expect(body).toHaveProperty('conversionRate');
        expect(body).toHaveProperty('period');
    });
});
