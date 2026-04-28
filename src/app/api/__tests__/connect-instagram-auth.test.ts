/**
 * Regression: /api/dashboard/connect-instagram must not act on a shop the
 * authenticated user does not own (bug B6). The endpoint uses supabaseAdmin
 * (service-role) and therefore bypasses RLS — explicit user_id matching is
 * required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAuthUser = vi.fn();
const mockShopChain = vi.fn();
const mockUpdateChain = vi.fn();

vi.mock('@/lib/auth/auth', () => ({
    getAuthUser: () => mockGetAuthUser(),
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        from: (table: string) => {
            if (table !== 'shops') throw new Error(`unexpected table ${table}`);
            return mockShopChain();
        },
    }),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('next/server', async () => {
    const actual = await vi.importActual('next/server');
    return {
        ...actual,
        NextResponse: {
            json: (body: unknown, init?: { status?: number }) => ({
                body,
                status: init?.status || 200,
                async json() {
                    return body;
                },
            }),
        },
    };
});

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/dashboard/connect-instagram/route';

function buildRequest(headers: Record<string, string> = {}, body?: unknown) {
    const init: Record<string, unknown> = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) init.body = JSON.stringify(body);
    return new NextRequest('http://localhost:4001/api/dashboard/connect-instagram', init);
}

describe('connect-instagram auth & ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when the request is unauthenticated', async () => {
        mockGetAuthUser.mockResolvedValue(null);

        const res = await POST(buildRequest({ 'x-shop-id': 'shop-1' }));
        expect(res.status).toBe(401);
    });

    it('returns 400 when x-shop-id header is missing', async () => {
        mockGetAuthUser.mockResolvedValue('user-1');

        const res = await POST(buildRequest());
        expect(res.status).toBe(400);
    });

    it('returns 404 when the shop is not owned by the authenticated user', async () => {
        mockGetAuthUser.mockResolvedValue('user-attacker');

        // Simulate Supabase returning no row when the user_id filter fails.
        const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        mockShopChain.mockReturnValue(chain);

        const res = await POST(buildRequest({ 'x-shop-id': 'shop-of-someone-else' }));
        expect(res.status).toBe(404);

        // Critical guard: the SELECT must include .eq('user_id', authUserId).
        const userIdCalls = chain.eq.mock.calls.filter((c) => c[0] === 'user_id');
        expect(userIdCalls.length).toBeGreaterThan(0);
        expect(userIdCalls[0][1]).toBe('user-attacker');
    });
});
