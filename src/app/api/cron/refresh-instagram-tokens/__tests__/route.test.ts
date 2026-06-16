/**
 * Integration tests for /api/cron/refresh-instagram-tokens.
 *
 * IG-Login tokens are 60-day and silently die at the cliff. This cron is the
 * only thing keeping direct-IG shops connected, so the parts that matter are:
 *   - the production Bearer-secret auth gate,
 *   - refreshing a near-expiry token and persisting the new expiry,
 *   - marking a shop revoked (not retrying) when Meta rejects the refresh,
 *   - not touching shops when none are near expiry.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

const { supabaseAdminMock } = vi.hoisted(() => ({ supabaseAdminMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: supabaseAdminMock }));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

// The route captures `const CRON_SECRET = process.env.CRON_SECRET` at module
// load, so it must be set BEFORE the import — vi.stubEnv at request time is
// too late. We dynamic-import after seeding the secret. NODE_ENV is still read
// live inside GET, so the prod/dev gate is controlled per-test via stubEnv.
let GET: typeof import('@/app/api/cron/refresh-instagram-tokens/route').GET;
beforeAll(async () => {
    process.env.CRON_SECRET = 'top-secret';
    ({ GET } = await import('@/app/api/cron/refresh-instagram-tokens/route'));
});

interface ShopRow {
    id: string;
    name: string;
    instagram_username: string | null;
    instagram_access_token: string | null;
    instagram_token_expires_at: string | null;
}

/**
 * Minimal Supabase stub. The select chain resolves to the candidate shops;
 * update chains resolve ok and are recorded so we can assert what was written.
 */
function buildSupabase(opts: { shops: ShopRow[]; fetchError?: { message: string } }) {
    const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];

    function makeChain(resolveValue: unknown) {
        const chain: Record<string, unknown> = {};
        let pendingUpdate: Record<string, unknown> | null = null;
        const methods = ['select', 'eq', 'not', 'is', 'lt', 'gte', 'in'];
        for (const m of methods) {
            chain[m] = (...args: unknown[]) => {
                // record .eq('id', x) target for an update
                if (m === 'eq' && pendingUpdate && args[0] === 'id') {
                    updates.push({ id: args[1] as string, payload: pendingUpdate });
                    pendingUpdate = null;
                    return Promise.resolve({ data: null, error: null });
                }
                return chain;
            };
        }
        chain.update = (payload: Record<string, unknown>) => {
            pendingUpdate = payload;
            return chain;
        };
        chain.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolveValue).then(resolve);
        return chain;
    }

    return {
        updates,
        client: {
            from() {
                return makeChain({
                    data: opts.fetchError ? null : opts.shops,
                    error: opts.fetchError ?? null,
                });
            },
        },
    };
}

beforeEach(() => {
    supabaseAdminMock.mockReset();
    vi.stubEnv('NODE_ENV', 'test');
    global.fetch = vi.fn();
});

afterEach(() => {
    vi.unstubAllEnvs();
});

const makeReq = (headers?: Record<string, string>) =>
    new Request('http://localhost/api/cron/refresh-instagram-tokens', { headers }) as unknown as Parameters<typeof GET>[0];

describe('auth gate', () => {
    it('rejects in production without the bearer secret', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await GET(makeReq());
        expect(res.status).toBe(401);
    });

    it('accepts in production with the correct bearer secret', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        supabaseAdminMock.mockReturnValue(buildSupabase({ shops: [] }).client);
        const res = await GET(makeReq({ authorization: 'Bearer top-secret' }));
        expect(res.status).toBe(200);
    });

    it('skips the gate outside production (dev/test)', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({ shops: [] }).client);
        const res = await GET(makeReq());
        expect(res.status).toBe(200);
    });
});

describe('no candidates', () => {
    it('returns refreshed:0 when no tokens are near expiry', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({ shops: [] }).client);
        const res = await GET(makeReq());
        const body = await res.json();
        expect(body.refreshed).toBe(0);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('fetch error from Supabase', () => {
    it('returns 500 when the shop query fails', async () => {
        supabaseAdminMock.mockReturnValue(buildSupabase({ shops: [], fetchError: { message: 'db down' } }).client);
        const res = await GET(makeReq());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('db down');
    });
});

describe('refresh + revoke logic', () => {
    const shop: ShopRow = {
        id: 'shop-1',
        name: 'IG Shop',
        instagram_username: 'igshop',
        instagram_access_token: 'old-token',
        instagram_token_expires_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    };

    it('refreshes a near-expiry token and stores the new token + expiry', async () => {
        const sb = buildSupabase({ shops: [shop] });
        supabaseAdminMock.mockReturnValue(sb.client);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ access_token: 'new-token', expires_in: 5_184_000 }),
        }) as unknown as typeof fetch;

        const res = await GET(makeReq());
        const body = await res.json();

        expect(body.refreshed).toBe(1);
        expect(body.revoked).toBe(0);
        const upd = sb.updates.find((u) => u.id === 'shop-1');
        expect(upd?.payload.instagram_access_token).toBe('new-token');
        expect(upd?.payload.instagram_token_expires_at).toBeDefined();
    });

    it('marks the shop revoked when Meta rejects the refresh (no retry)', async () => {
        const sb = buildSupabase({ shops: [shop] });
        supabaseAdminMock.mockReturnValue(sb.client);
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'permission denied' } }),
        }) as unknown as typeof fetch;

        const res = await GET(makeReq());
        const body = await res.json();

        expect(body.refreshed).toBe(0);
        expect(body.revoked).toBe(1);
        const upd = sb.updates.find((u) => u.id === 'shop-1');
        expect(upd?.payload.instagram_token_revoked_at).toBeDefined();
    });

    it('swallows a per-shop fetch exception without failing the whole run', async () => {
        const sb = buildSupabase({ shops: [shop] });
        supabaseAdminMock.mockReturnValue(sb.client);
        global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

        const res = await GET(makeReq());
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.refreshed).toBe(0);
        expect(body.candidates).toBe(1);
    });
});
