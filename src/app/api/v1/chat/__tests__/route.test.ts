/**
 * Billing gate for the public /api/v1/chat route: it must use the owner's
 * billing snapshot (like the webhook) instead of trusting / defaulting the
 * shop's denormalized subscription columns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserBillingSnapshot } from '@/lib/billing/getUserBilling';

const routeToAIMock = vi.fn();
const getUserBillingMock = vi.fn();
let shopRow: Record<string, unknown> = {};

vi.mock('@/lib/api-keys', () => ({
    resolveApiKey: async () => ({ keyId: 'key-1', shopId: 'shop-1', userId: 'user-1' }),
}));
vi.mock('@/lib/utils/rate-limiter', () => ({
    checkRateLimit: async () => ({ allowed: true, remaining: 9, resetAt: 0 }),
    createRateLimitResponse: vi.fn(),
    RATE_LIMIT_CONFIGS: { strict: {} },
}));
vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => {
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.single = async () => ({ data: shopRow, error: null });
        return chain;
    },
}));
vi.mock('@/lib/webhook/services/shop.service', () => ({
    getAIFeatures: async () => ({ faqs: [], quickReplies: [], slogans: [] }),
    mapShopProductsToAI: () => [],
}));
vi.mock('@/lib/billing/getUserBilling', () => ({
    getUserBilling: (...a: unknown[]) => getUserBillingMock(...a),
}));
vi.mock('@/lib/ai/AIRouter', () => ({
    routeToAI: (...a: unknown[]) => routeToAIMock(...a),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { POST } from '../route';
import type { NextRequest } from 'next/server';

const billing = (over: Partial<UserBillingSnapshot>): UserBillingSnapshot => ({
    userId: 'owner-1', plan: 'unpaid', status: 'unpaid', trialEndsAt: null,
    tokensUsed: 0, tokensLimit: null, periodAnchorAt: null, daysUntilReset: null, ...over,
});

const call = () => POST(new Request('https://example.com/api/v1/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Сайн байна уу' }),
}) as unknown as NextRequest);

beforeEach(() => {
    vi.clearAllMocks();
    shopRow = { id: 'shop-1', name: 'Shop', user_id: 'owner-1', products: [],
        subscription_plan: null, subscription_status: null, token_usage_total: 0 };
    routeToAIMock.mockResolvedValue({ text: 'ok' });
});

describe('POST /api/v1/chat billing gate', () => {
    it('rejects an unpaid owner instead of defaulting to active/starter', async () => {
        getUserBillingMock.mockResolvedValue(billing({}));
        const res = await call();
        expect(res.status).toBe(402);
        expect(routeToAIMock).not.toHaveBeenCalled();
    });

    it('rejects an expired trial', async () => {
        getUserBillingMock.mockResolvedValue(billing({ plan: 'starter', status: 'trial',
            trialEndsAt: new Date(Date.now() - 60_000).toISOString() }));
        expect((await call()).status).toBe(402);
        expect(routeToAIMock).not.toHaveBeenCalled();
    });

    it('meters a paid owner against the pooled billing snapshot', async () => {
        getUserBillingMock.mockResolvedValue(billing({ plan: 'pro', status: 'active',
            tokensUsed: 1234, tokensLimit: 21_000_000 }));
        const res = await call();
        expect(res.status).toBe(200);
        expect(getUserBillingMock).toHaveBeenCalledWith('owner-1');
        const ctx = routeToAIMock.mock.calls[0][1];
        expect(ctx.userId).toBe('owner-1');
        expect(ctx.subscription).toMatchObject({ plan: 'pro', status: 'active', tokensLimit: 21_000_000 });
        expect(ctx.tokenUsageTotal).toBe(1234);
    });
});
