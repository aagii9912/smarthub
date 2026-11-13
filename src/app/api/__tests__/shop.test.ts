/**
 * Shop API Route Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth module
const mockGetClerkUser = vi.fn();
const mockSupabaseAdmin = vi.fn();

vi.mock('@/lib/auth/auth', () => ({
    getAuthUser: () => mockGetClerkUser(),
    supabaseAdmin: () => mockSupabaseAdmin(),
}));

// RBAC: PATCH одоо requirePermission('settings:write')-ийг ашигладаг.
const mockRequirePermission = vi.fn();
vi.mock('@/lib/auth/membership', () => ({
    requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
    ForbiddenError: class ForbiddenError extends Error {
        status = 403;
        constructor(message: string) {
            super(message);
            this.name = 'ForbiddenError';
        }
    },
}));

vi.mock('@/lib/ai/AIRouter', () => ({
    getPlanTypeFromSubscription: ({ plan }: { plan: string }) => {
        if (plan === 'enterprise') return 'enterprise';
        if (plan === 'pro') return 'pro';
        return 'starter';
    },
}));

vi.mock('@/lib/ai/config/plans', () => ({
    checkShopLimit: (plan: string, count: number) => {
        const limits: Record<string, number> = { starter: 1, pro: 3, enterprise: 10 };
        const limit = limits[plan] || 1;
        return { allowed: count < limit, limit };
    },
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Page/IG token-ийн Graph шалгалт — fetch биш helper-ийг mock хийнэ.
const mockVerifyFacebookPageToken = vi.fn();
const mockVerifyInstagramAccountToken = vi.fn();
vi.mock('@/lib/facebook/verifyChannelToken', () => ({
    verifyFacebookPageToken: (...args: unknown[]) => mockVerifyFacebookPageToken(...args),
    verifyInstagramAccountToken: (...args: unknown[]) => mockVerifyInstagramAccountToken(...args),
}));

// Release-ийн дараах push/и-мэйл анхааруулгыг илгээхгүй; withChannelContext жинхэнэ хэвээр.
const mockNotifyChannelClaimed = vi.fn();
vi.mock('@/lib/shop/channelEvents', async () => {
    const actual = await vi.importActual<typeof import('@/lib/shop/channelEvents')>('@/lib/shop/channelEvents');
    return {
        ...actual,
        notifyChannelClaimed: (...args: unknown[]) => mockNotifyChannelClaimed(...args),
    };
});

// Mock NextResponse
vi.mock('next/server', async () => {
    const actual = await vi.importActual('next/server');
    return {
        ...actual,
        NextResponse: {
            json: (body: unknown, init?: { status?: number }) => ({
                body,
                status: init?.status || 200,
                async json() { return body; },
            }),
        },
    };
});

import { GET, POST, PATCH } from '@/app/api/shop/route';
import { ForbiddenError } from '@/lib/auth/membership';

const ownerAccess = { shop: { id: 'shop-1', user_id: 'user-123' }, role: 'owner' as const, userId: 'user-123' };

// Helper to create NextRequest
function createRequest(method: string, body?: unknown, headers?: Record<string, string>) {
    const url = 'http://localhost:3000/api/shop';
    const init: any = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) {
        init.body = JSON.stringify(body);
    }
    return new NextRequest(url, init);
}

// Mock Supabase chain builder
function createMockChain(data: unknown = null, error: unknown = null) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data, error });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
    return chain;
}

// `select().eq().neq()` — page/IG-г эзэмшиж буй бусад дэлгүүрийг хайх query.
function createHoldersChain(holders: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockResolvedValue({ data: holders, error: null });
    return chain;
}

// `update().in()` — бусад дэлгүүрээс page/IG-г салгах (release).
function createReleaseChain() {
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockResolvedValue({ error: null });
    return chain;
}

// supabase.from()-г дарааллаар нь хариулна; илүү дуудалт гарвал тест унана.
function mockDbSequence(chains: Record<string, unknown>[]) {
    const queue = [...chains];
    const from = vi.fn((table: string) => {
        const next = queue.shift();
        if (!next) throw new Error(`unexpected supabase.from('${table}')`);
        return next;
    });
    mockSupabaseAdmin.mockReturnValue({ from });
    return from;
}

describe('Shop API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/shop', () => {
        it('returns 401 when not authenticated', async () => {
            mockGetClerkUser.mockResolvedValue(null);

            const request = createRequest('GET');
            const response = await GET(request);

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body.error).toBe('Unauthorized');
        });

        it('returns shop data when authenticated', async () => {
            mockGetClerkUser.mockResolvedValue('user-123');
            const mockShop = { id: 'shop-1', name: 'My Shop', is_active: true };
            const chain = createMockChain(mockShop);
            mockSupabaseAdmin.mockReturnValue({ from: () => chain });

            const request = createRequest('GET');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.shop).toEqual(mockShop);
        });

        it('returns null shop when no shop exists', async () => {
            mockGetClerkUser.mockResolvedValue('user-123');
            const chain = createMockChain(null);
            mockSupabaseAdmin.mockReturnValue({ from: () => chain });

            const request = createRequest('GET');
            const response = await GET(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.shop).toBeNull();
        });

        it('filters by x-shop-id header when provided', async () => {
            mockGetClerkUser.mockResolvedValue('user-123');
            const chain = createMockChain({ id: 'shop-specific', name: 'Specific Shop' });
            mockSupabaseAdmin.mockReturnValue({ from: () => chain });

            const request = createRequest('GET', undefined, { 'x-shop-id': 'shop-specific' });
            const response = await GET(request);

            expect(response.status).toBe(200);
            expect(chain.eq).toHaveBeenCalledWith('id', 'shop-specific');
        });
    });

    describe('POST /api/shop', () => {
        it('returns 401 when not authenticated', async () => {
            mockGetClerkUser.mockResolvedValue(null);

            const request = createRequest('POST', { name: 'Shop' });
            const response = await POST(request);

            expect(response.status).toBe(401);
        });

        it('returns 400 when name is missing', async () => {
            mockGetClerkUser.mockResolvedValue('user-123');

            const request = createRequest('POST', {});
            const response = await POST(request);

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('Shop name required');
        });

        it('updates existing shop when found (not forceCreate)', async () => {
            mockGetClerkUser.mockResolvedValue('user-123');
            const existingShop = { id: 'shop-1', name: 'Old Name', owner_name: 'Old Owner' };
            const updatedShop = { id: 'shop-1', name: 'New Name', owner_name: 'New Owner' };

            // First call: check existing → returns shop
            // Second call: update → returns updated shop
            const selectChain = createMockChain(existingShop);
            const updateChain = createMockChain(updatedShop);

            let callCount = 0;
            mockSupabaseAdmin.mockReturnValue({
                from: () => {
                    callCount++;
                    return callCount === 1 ? selectChain : updateChain;
                },
            });

            const request = createRequest('POST', { name: 'New Name', owner_name: 'New Owner' });
            const response = await POST(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.shop).toEqual(updatedShop);
        });
    });

    describe('PATCH /api/shop', () => {
        it('returns 403 when caller lacks settings:write permission', async () => {
            mockRequirePermission.mockRejectedValue(new ForbiddenError('Эрх хүрэлцэхгүй'));

            const request = createRequest('PATCH', { name: 'Updated' });
            const response = await PATCH(request);

            expect(response.status).toBe(403);
        });

        it('returns 404 when shop not found', async () => {
            mockRequirePermission.mockResolvedValue(ownerAccess);
            const chain = createMockChain(null);
            mockSupabaseAdmin.mockReturnValue({ from: () => chain });

            const request = createRequest('PATCH', { name: 'Updated' });
            const response = await PATCH(request);

            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe('Shop not found');
        });

        it('returns 400 when no valid fields provided', async () => {
            mockRequirePermission.mockResolvedValue(ownerAccess);
            const shop = { id: 'shop-1', user_id: 'user-123' };
            const chain = createMockChain(shop);
            mockSupabaseAdmin.mockReturnValue({ from: () => chain });

            const request = createRequest('PATCH', { invalid_field: 'value' });
            const response = await PATCH(request);

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('No valid fields to update');
        });

        it('sanitizes input fields (SEC-5)', async () => {
            mockRequirePermission.mockResolvedValue(ownerAccess);
            const shop = { id: 'shop-1', user_id: 'user-123' };
            const updatedShop = { id: 'shop-1', name: 'Updated' };

            const selectChain = createMockChain(shop);
            const updateChain = createMockChain(updatedShop);

            let callCount = 0;
            mockSupabaseAdmin.mockReturnValue({
                from: () => {
                    callCount++;
                    return callCount === 1 ? selectChain : updateChain;
                },
            });

            // Try to inject disallowed fields
            const request = createRequest('PATCH', {
                name: 'Updated',
                user_id: 'hacked-user', // should be filtered out
                subscription_plan: 'enterprise', // should be filtered out
            });
            const response = await PATCH(request);

            expect(response.status).toBe(200);
            // The update chain should only include "name", not user_id or subscription_plan
            expect(updateChain.update).toHaveBeenCalledWith({ name: 'Updated' });
        });

        describe('Facebook page / Instagram claim verification', () => {
            const shop = { id: 'shop-1', user_id: 'user-123', name: 'My Shop' };
            const victim = { id: 'shop-victim', name: 'Victim Shop', user_id: 'user-victim', facebook_page_name: 'Victim Page', instagram_username: 'victim_ig' };

            beforeEach(() => {
                mockRequirePermission.mockResolvedValue(ownerAccess);
            });

            it('rejects a page ID whose token belongs to another page — 400, nothing released or saved', async () => {
                mockVerifyFacebookPageToken.mockResolvedValue({ ok: false, reason: 'id_mismatch', detail: 'token belongs to attacker-page' });
                const from = mockDbSequence([createMockChain(shop), createHoldersChain([victim]), createReleaseChain(), createMockChain(shop)]);

                const response = await PATCH(createRequest('PATCH', {
                    facebook_page_id: 'victim-page',
                    facebook_page_name: 'Victim Page',
                    facebook_page_access_token: 'junk-token',
                }));

                expect(response.status).toBe(400);
                expect((await response.json()).error).toBe('Token нь сонгосон Facebook page-д хамаарахгүй байна.');
                expect(mockVerifyFacebookPageToken).toHaveBeenCalledWith('victim-page', 'junk-token');
                // Зөвхөн өөрийн дэлгүүрийг уншсан — holders query, release, update хийгдээгүй.
                expect(from).toHaveBeenCalledTimes(1);
                expect(mockNotifyChannelClaimed).not.toHaveBeenCalled();
            });

            it('rejects a page ID when Graph rejects the token — 400', async () => {
                mockVerifyFacebookPageToken.mockResolvedValue({ ok: false, reason: 'graph_error', detail: '190 Invalid OAuth access token' });
                const from = mockDbSequence([createMockChain(shop)]);

                const response = await PATCH(createRequest('PATCH', {
                    facebook_page_id: 'victim-page',
                    facebook_page_access_token: 'expired-token',
                }));

                expect(response.status).toBe(400);
                expect((await response.json()).error).toBe('Facebook page-ийн token хүчингүй байна. Page-ээ дахин холбоно уу.');
                expect(from).toHaveBeenCalledTimes(1);
            });

            it('rejects a page ID sent without a token — 400, Graph not called', async () => {
                const from = mockDbSequence([createMockChain(shop)]);

                const response = await PATCH(createRequest('PATCH', { facebook_page_id: 'victim-page', facebook_page_name: 'Victim Page' }));

                expect(response.status).toBe(400);
                expect((await response.json()).error).toBe('Facebook page холбохын тулд page access token шаардлагатай.');
                expect(mockVerifyFacebookPageToken).not.toHaveBeenCalled();
                expect(from).toHaveBeenCalledTimes(1);
            });

            it('saves the page when the token matches and releases other holders', async () => {
                mockVerifyFacebookPageToken.mockResolvedValue({ ok: true, id: 'page-1' });
                const holdersChain = createHoldersChain([victim]);
                const releaseChain = createReleaseChain();
                const updateChain = createMockChain({ ...shop, facebook_page_id: 'page-1' });
                mockDbSequence([createMockChain(shop), holdersChain, releaseChain, updateChain]);

                const response = await PATCH(createRequest('PATCH', {
                    facebook_page_id: 'page-1',
                    facebook_page_name: 'Client Supplied Name',
                    facebook_page_access_token: 'good-token',
                }));

                expect(response.status).toBe(200);
                expect(holdersChain.eq).toHaveBeenCalledWith('facebook_page_id', 'page-1');
                expect(releaseChain.in).toHaveBeenCalledWith('id', ['shop-victim']);
                expect(mockNotifyChannelClaimed).toHaveBeenCalledWith(expect.objectContaining({ platform: 'facebook', accountId: 'page-1' }));
                expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({
                    facebook_page_id: 'page-1',
                    facebook_page_name: 'Client Supplied Name',
                    facebook_page_access_token: 'good-token',
                }));
            });

            it('allows clearing the page with null and no token', async () => {
                const updateChain = createMockChain({ ...shop, facebook_page_id: null });
                const from = mockDbSequence([createMockChain(shop), updateChain]);

                const response = await PATCH(createRequest('PATCH', { facebook_page_id: null }));

                expect(response.status).toBe(200);
                expect(mockVerifyFacebookPageToken).not.toHaveBeenCalled();
                expect(from).toHaveBeenCalledTimes(2); // release алгассан
                expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ facebook_page_id: null }));
            });

            it("treats an empty-string page ID as clearing (stored as null, not '')", async () => {
                const updateChain = createMockChain({ ...shop, facebook_page_id: null });
                mockDbSequence([createMockChain(shop), updateChain]);

                const response = await PATCH(createRequest('PATCH', { facebook_page_id: '' }));

                expect(response.status).toBe(200);
                expect(mockVerifyFacebookPageToken).not.toHaveBeenCalled();
                expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ facebook_page_id: null }));
            });

            it("rejects an Instagram account the token's page isn't linked to — 400, nothing released or saved", async () => {
                mockVerifyInstagramAccountToken.mockResolvedValue({ ok: false, reason: 'id_mismatch', detail: "page's IG account is none" });
                const from = mockDbSequence([createMockChain(shop), createHoldersChain([victim]), createReleaseChain(), createMockChain(shop)]);

                const response = await PATCH(createRequest('PATCH', {
                    instagram_business_account_id: 'victim-ig',
                    instagram_username: 'victim_ig',
                    instagram_access_token: 'junk-token',
                }));

                expect(response.status).toBe(400);
                expect((await response.json()).error).toBe('Token нь сонгосон Instagram бүртгэлд хамаарахгүй байна.');
                expect(mockVerifyInstagramAccountToken).toHaveBeenCalledWith('victim-ig', 'junk-token');
                expect(from).toHaveBeenCalledTimes(1);
                expect(mockNotifyChannelClaimed).not.toHaveBeenCalled();
            });

            it('saves the Instagram account when the token matches, using the Graph username', async () => {
                mockVerifyInstagramAccountToken.mockResolvedValue({ ok: true, id: 'ig-1', username: 'real_ig', pageId: 'page-1' });
                const updateChain = createMockChain({ ...shop, instagram_business_account_id: 'ig-1' });
                mockDbSequence([createMockChain(shop), createHoldersChain([]), updateChain]);

                const response = await PATCH(createRequest('PATCH', {
                    instagram_business_account_id: 'ig-1',
                    instagram_username: 'client_supplied',
                    instagram_access_token: 'good-token',
                }));

                expect(response.status).toBe(200);
                expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({
                    instagram_business_account_id: 'ig-1',
                    instagram_username: 'real_ig',
                    instagram_access_token: 'good-token',
                }));
            });
        });
    });
});
