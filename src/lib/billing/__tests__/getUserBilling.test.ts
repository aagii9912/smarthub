/**
 * Unit tests for getUserBilling — the single source of truth for the user's
 * plan + 30-day rolling token pool.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
const profileSelectChain = vi.fn();
const subSelectChain = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        rpc: (name: string, args: unknown) => rpcMock(name, args),
        from: (table: string) => fromMock(table),
    }),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        success: vi.fn(),
    },
}));

import { getUserBilling } from '@/lib/billing/getUserBilling';

beforeEach(() => {
    vi.clearAllMocks();

    rpcMock.mockResolvedValue({ data: 0, error: null });

    fromMock.mockImplementation((table: string) => {
        if (table === 'user_profiles') return profileSelectChain();
        if (table === 'subscriptions') return subSelectChain();
        throw new Error(`unexpected table ${table}`);
    });
});

describe('getUserBilling', () => {
    it('returns "unpaid" snapshot for blank user id', async () => {
        const snap = await getUserBilling('');
        expect(snap.plan).toBe('unpaid');
        expect(snap.tokensLimit).toBeNull();
    });

    it('reads plan from joined subscription when present', async () => {
        profileSelectChain.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'active',
                    trial_ends_at: null,
                    plan_id: 'plan-pro',
                },
            }),
        });

        const anchor = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
        subSelectChain.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    id: 'sub-1',
                    plan_id: 'plan-pro',
                    status: 'active',
                    period_anchor_at: anchor,
                    tokens_used_in_period: 12345,
                    plans: { slug: 'pro', limits: { tokens_per_month: 21_000_000 } },
                },
            }),
        });

        const snap = await getUserBilling('user-1');

        expect(snap.plan).toBe('pro');
        expect(snap.status).toBe('active');
        expect(snap.tokensUsed).toBe(12345);
        expect(snap.tokensLimit).toBe(21_000_000);
        expect(snap.daysUntilReset).toBe(25);
    });

    it('falls back to user_profiles snapshot when no live subscription exists', async () => {
        profileSelectChain.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: {
                    subscription_plan: 'starter',
                    subscription_status: 'trial',
                    trial_ends_at: '2030-01-01T00:00:00Z',
                    plan_id: null,
                },
            }),
        });

        subSelectChain.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        });

        const snap = await getUserBilling('user-2');
        expect(snap.plan).toBe('starter');
        expect(snap.status).toBe('trial');
        expect(snap.trialEndsAt).toBe('2030-01-01T00:00:00Z');
        expect(snap.tokensUsed).toBe(0);
    });
});
