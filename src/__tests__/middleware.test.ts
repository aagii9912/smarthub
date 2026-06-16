/**
 * Tests for src/middleware.ts — the app-wide auth + rate-limit + paywall gate.
 *
 * Blast radius here is the whole site: a bug can lock out paying users, leak
 * protected pages, or take the app down via the rate limiter. We exercise the
 * decision branches with the Supabase clients and rate limiter mocked:
 *   - fast-bypass for Messenger WebView payment routes (zero processing),
 *   - dev-only debug routes 404 in production,
 *   - rate-limit short-circuit on /api/*,
 *   - public passthrough,
 *   - unauthenticated → /auth/login redirect with redirect_url,
 *   - trial/paywall redirect for blocked subscription states,
 *   - bypass pages (subscription/settings) stay reachable while blocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getUserMock, checkRateLimitMock, maybeSingleMock } = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    maybeSingleMock: vi.fn(),
}));

vi.mock('@/lib/supabase-middleware', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NextResponse } = require('next/server');
    return {
        createSupabaseMiddlewareClient: () => ({
            supabase: { auth: { getUser: getUserMock } },
            supabaseResponse: NextResponse.next(),
        }),
    };
});

vi.mock('@/lib/utils/rate-limiter', () => ({
    checkMiddlewareRateLimit: checkRateLimitMock,
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
        }),
    }),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

import middleware from '@/middleware';

const asUser = (user: unknown) => getUserMock.mockResolvedValue({ data: { user } });
const req = (path: string, headers?: Record<string, string>) =>
    new NextRequest(`http://localhost${path}`, { headers });

beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset().mockResolvedValue({ data: null });
    checkRateLimitMock.mockReset().mockResolvedValue({ allowed: true });
    vi.stubEnv('NODE_ENV', 'test');
    // afterEach unstubs ALL envs (including those from test/setup.ts), so the
    // paywall branch's service-role guard needs these re-stubbed every test.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('fast bypass — payment/checkout WebView routes', () => {
    it.each(['/pay/123', '/checkout', '/api/pay/x', '/api/checkout/create'])(
        'passes %s through without touching auth or rate limiter',
        async (path) => {
            const res = await middleware(req(path));
            expect(res.status).toBe(200);
            expect(getUserMock).not.toHaveBeenCalled();
            expect(checkRateLimitMock).not.toHaveBeenCalled();
        },
    );
});

describe('dev-only routes', () => {
    it('404s /api/debug in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await middleware(req('/api/debug/whoami'));
        expect(res.status).toBe(404);
    });

    it('does NOT 404 /api/debug outside production', async () => {
        asUser(null);
        const res = await middleware(req('/api/debug/whoami'));
        expect(res.status).not.toBe(404);
    });
});

describe('rate limiting on /api/*', () => {
    it('short-circuits with the limiter response when blocked', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NextResponse } = require('next/server');
        checkRateLimitMock.mockResolvedValue({
            allowed: false,
            response: NextResponse.json({ error: 'Too Many Requests' }, { status: 429 }),
        });
        const res = await middleware(req('/api/dashboard/stats'));
        expect(res.status).toBe(429);
        // auth never runs once rate-limited
        expect(getUserMock).not.toHaveBeenCalled();
    });

    it('classifies /api/chat as the strict tier', async () => {
        asUser(null);
        await middleware(req('/api/chat'));
        expect(checkRateLimitMock).toHaveBeenCalledWith(expect.anything(), 'strict');
    });

    it('classifies a generic API route as the standard tier', async () => {
        asUser(null);
        await middleware(req('/api/dashboard/stats'));
        expect(checkRateLimitMock).toHaveBeenCalledWith(expect.anything(), 'standard');
    });
});

describe('public routes', () => {
    it('lets the landing page through and still refreshes the session', async () => {
        asUser(null);
        const res = await middleware(req('/'));
        expect(res.status).toBe(200);
        expect(getUserMock).toHaveBeenCalled();
    });
});

describe('protected routes', () => {
    it('redirects an unauthenticated user to /auth/login with redirect_url', async () => {
        asUser(null);
        const res = await middleware(req('/dashboard/orders'));
        expect(res.status).toBe(307);
        const location = res.headers.get('location')!;
        expect(location).toContain('/auth/login');
        expect(location).toContain('redirect_url=%2Fdashboard%2Forders');
    });

    it('lets an authenticated user reach a non-dashboard protected route (/admin)', async () => {
        asUser({ id: 'u1' });
        const res = await middleware(req('/admin'));
        expect(res.status).toBe(200);
    });
});

describe('paywall / trial guard', () => {
    it('redirects a blocked (expired) user from /dashboard to subscription', async () => {
        asUser({ id: 'u1' });
        maybeSingleMock.mockResolvedValue({ data: { subscription_status: 'expired', trial_ends_at: null } });

        const res = await middleware(req('/dashboard'));
        expect(res.status).toBe(307);
        const location = res.headers.get('location')!;
        expect(location).toContain('/dashboard/subscription');
        expect(location).toContain('expired=1');
    });

    it('redirects when a trialing user is past trial_ends_at', async () => {
        asUser({ id: 'u1' });
        maybeSingleMock.mockResolvedValue({
            data: { subscription_status: 'trialing', trial_ends_at: new Date(Date.now() - 1000).toISOString() },
        });
        const res = await middleware(req('/dashboard/products'));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/dashboard/subscription');
    });

    it('allows an active subscriber through /dashboard', async () => {
        asUser({ id: 'u1' });
        maybeSingleMock.mockResolvedValue({ data: { subscription_status: 'active', trial_ends_at: null } });
        const res = await middleware(req('/dashboard'));
        expect(res.status).toBe(200);
    });

    it('keeps the subscription page reachable even when blocked (bypass)', async () => {
        asUser({ id: 'u1' });
        maybeSingleMock.mockResolvedValue({ data: { subscription_status: 'expired', trial_ends_at: null } });
        const res = await middleware(req('/dashboard/subscription'));
        expect(res.status).toBe(200);
    });

    it('keeps settings reachable while blocked (bypass)', async () => {
        asUser({ id: 'u1' });
        maybeSingleMock.mockResolvedValue({ data: { subscription_status: 'unpaid', trial_ends_at: null } });
        const res = await middleware(req('/dashboard/settings'));
        expect(res.status).toBe(200);
    });

    it('allows the request through once when no profile row exists yet', async () => {
        asUser({ id: 'u-new' });
        maybeSingleMock.mockResolvedValue({ data: null });
        const res = await middleware(req('/dashboard'));
        expect(res.status).toBe(200);
    });
});
