/**
 * Route handler tests for /api/dashboard/comment-automations.
 *
 * Strategy:
 *   - Mock the service module so the handlers are tested in isolation.
 *   - Mock `getAuthUser` to control auth state.
 *   - Build minimal `NextRequest`-shaped objects via `new Request()`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommentAutomation } from '@/types/database';

// ───────────── mocks ─────────────

const getAuthUserMock = vi.fn();
vi.mock('@/lib/auth/auth', () => ({
    getAuthUser: () => getAuthUserMock(),
}));

// shopId fallback path uses supabaseAdmin().from('shops').select(...).eq().eq().single()
// Wired so it returns null by default — tests that need it set
// `shopFallbackResponse` ahead of the call.
let shopFallbackResponse: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => {
        const chain: any = {
            from: () => chain,
            select: () => chain,
            eq: () => chain,
            single: () => Promise.resolve(shopFallbackResponse),
        };
        return chain;
    },
}));

const getAllAutomationsMock = vi.fn();
const createAutomationMock = vi.fn();
const updateAutomationMock = vi.fn();
const deleteAutomationMock = vi.fn();

vi.mock('@/lib/services/CommentAutomationService', () => ({
    getAllAutomations: (...a: unknown[]) => getAllAutomationsMock(...a),
    createAutomation: (...a: unknown[]) => createAutomationMock(...a),
    updateAutomation: (...a: unknown[]) => updateAutomationMock(...a),
    deleteAutomation: (...a: unknown[]) => deleteAutomationMock(...a),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// Import route AFTER mocks
import { GET, POST, PATCH, DELETE } from '../route';
import type { NextRequest } from 'next/server';

// ───────────── helpers ─────────────

function buildRequest(
    method: string,
    {
        shopHeader,
        body,
        url = 'http://localhost/api/dashboard/comment-automations',
    }: { shopHeader?: string; body?: unknown; url?: string } = {}
): NextRequest {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (shopHeader) headers.set('x-shop-id', shopHeader);

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    const req = new Request(url, init) as unknown as NextRequest;
    // Next.js exposes `nextUrl` for searchParams — back-fill it from the URL.
    Object.defineProperty(req, 'nextUrl', {
        value: new URL(url),
        writable: false,
        configurable: true,
    });
    return req;
}

function makeAutomation(overrides: Partial<CommentAutomation> = {}): CommentAutomation {
    return {
        id: 'auto-1',
        shop_id: 'shop-1',
        name: 'Sale',
        is_active: true,
        post_id: null,
        post_url: null,
        trigger_keywords: ['dm'],
        match_type: 'contains',
        action_type: 'send_dm',
        dm_message: 'hi',
        reply_message: null,
        platform: 'both',
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

beforeEach(() => {
    getAuthUserMock.mockReset();
    getAllAutomationsMock.mockReset();
    createAutomationMock.mockReset();
    updateAutomationMock.mockReset();
    deleteAutomationMock.mockReset();
    shopFallbackResponse = { data: null, error: null };
});

// ───────────── GET ─────────────

describe('GET /api/dashboard/comment-automations', () => {
    it('returns the list when authenticated and x-shop-id is set', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        getAllAutomationsMock.mockResolvedValue([makeAutomation()]);

        const res = await GET(buildRequest('GET', { shopHeader: 'shop-1' }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.automations).toHaveLength(1);
        expect(getAllAutomationsMock).toHaveBeenCalledWith('shop-1');
    });

    it('returns 401 when getAuthUser returns null', async () => {
        getAuthUserMock.mockResolvedValue(null);
        const res = await GET(buildRequest('GET', { shopHeader: 'shop-1' }));
        expect(res.status).toBe(401);
    });

    it('falls back to the user\'s active shop when x-shop-id is missing', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        shopFallbackResponse = { data: { id: 'shop-fallback' }, error: null };
        getAllAutomationsMock.mockResolvedValue([]);

        const res = await GET(buildRequest('GET'));
        expect(res.status).toBe(200);
        expect(getAllAutomationsMock).toHaveBeenCalledWith('shop-fallback');
    });
});

// ───────────── POST ─────────────

describe('POST /api/dashboard/comment-automations', () => {
    it('returns 201 and the created row on success', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        createAutomationMock.mockResolvedValue(makeAutomation({ id: 'new-1' }));

        const res = await POST(buildRequest('POST', {
            shopHeader: 'shop-1',
            body: { name: 'X', trigger_keywords: ['dm'], dm_message: 'Hi' },
        }));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.automation.id).toBe('new-1');
    });

    it('returns 400 when name is missing', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        const res = await POST(buildRequest('POST', {
            shopHeader: 'shop-1',
            body: { trigger_keywords: ['dm'], dm_message: 'Hi' },
        }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when trigger_keywords is empty', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        const res = await POST(buildRequest('POST', {
            shopHeader: 'shop-1',
            body: { name: 'X', trigger_keywords: [], dm_message: 'Hi' },
        }));
        expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
        getAuthUserMock.mockResolvedValue(null);
        const res = await POST(buildRequest('POST', {
            body: { name: 'X', trigger_keywords: ['dm'], dm_message: 'Hi' },
        }));
        expect(res.status).toBe(401);
    });

    it('returns 500 when the service fails to insert', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        createAutomationMock.mockResolvedValue(null);

        const res = await POST(buildRequest('POST', {
            shopHeader: 'shop-1',
            body: { name: 'X', trigger_keywords: ['dm'], dm_message: 'Hi' },
        }));
        expect(res.status).toBe(500);
    });
});

// ───────────── PATCH ─────────────

describe('PATCH /api/dashboard/comment-automations', () => {
    it('returns 200 on a successful update', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        updateAutomationMock.mockResolvedValue(makeAutomation({ id: 'auto-1', is_active: false }));

        const res = await PATCH(buildRequest('PATCH', {
            shopHeader: 'shop-1',
            body: { id: 'auto-1', is_active: false },
        }));

        expect(res.status).toBe(200);
        expect(updateAutomationMock).toHaveBeenCalledWith('auto-1', 'shop-1', { is_active: false });
        const json = await res.json();
        expect(json.automation.is_active).toBe(false);
    });

    it('returns 400 when id is missing', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        const res = await PATCH(buildRequest('PATCH', {
            shopHeader: 'shop-1',
            body: { name: 'noop' },
        }));
        expect(res.status).toBe(400);
    });

    it('returns 404 when the service cannot find the row', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        updateAutomationMock.mockResolvedValue(null);

        const res = await PATCH(buildRequest('PATCH', {
            shopHeader: 'shop-1',
            body: { id: 'missing', name: 'x' },
        }));
        expect(res.status).toBe(404);
    });
});

// ───────────── DELETE ─────────────

describe('DELETE /api/dashboard/comment-automations', () => {
    it('returns 200 on success', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        deleteAutomationMock.mockResolvedValue(true);

        const res = await DELETE(buildRequest('DELETE', {
            shopHeader: 'shop-1',
            url: 'http://localhost/api/dashboard/comment-automations?id=auto-1',
        }));

        expect(res.status).toBe(200);
        expect(deleteAutomationMock).toHaveBeenCalledWith('auto-1', 'shop-1');
    });

    it('returns 400 when the id query param is missing', async () => {
        getAuthUserMock.mockResolvedValue('user-1');
        const res = await DELETE(buildRequest('DELETE', { shopHeader: 'shop-1' }));
        expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
        getAuthUserMock.mockResolvedValue(null);
        const res = await DELETE(buildRequest('DELETE', {
            url: 'http://localhost/api/dashboard/comment-automations?id=auto-1',
        }));
        expect(res.status).toBe(401);
    });
});
