/**
 * Debug Auth API Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Next.js response
vi.mock('next/server', () => ({
    NextResponse: {
        json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
            body,
            status: init?.status || 200,
            headers: new Map(Object.entries(init?.headers || {})),
            async json() { return body; },
        }),
    },
}));

// Mock the auth functions
vi.mock('@/lib/auth/auth', () => ({
    getAuthUser: vi.fn(),
    getAuthUserShop: vi.fn(),
}));

import { GET } from '@/app/api/debug-auth/route';
import { getAuthUser, getAuthUserShop } from '@/lib/auth/auth';

describe('Debug Auth API', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns 404 Not available when NODE_ENV is production', async () => {
        process.env.NODE_ENV = 'production';

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data).toEqual({ error: 'Not available' });
        expect(getAuthUser).not.toHaveBeenCalled();
        expect(getAuthUserShop).not.toHaveBeenCalled();
    });

    it('returns auth and shop status when not in production (development)', async () => {
        process.env.NODE_ENV = 'development';

        const mockUserId = 'user-123';
        const mockShop = { id: 'shop-456', name: 'Test Shop' };

        vi.mocked(getAuthUser).mockResolvedValue(mockUserId);
        vi.mocked(getAuthUserShop).mockResolvedValue(mockShop);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            auth_status: {
                isAuthenticated: true,
                user_id: mockUserId,
            },
            shop_status: {
                shop_found: true,
                shop_id: mockShop.id,
                shop_name: mockShop.name,
            },
        });
        expect(getAuthUser).toHaveBeenCalledTimes(1);
        expect(getAuthUserShop).toHaveBeenCalledTimes(1);
    });

    it('returns unauthenticated status correctly', async () => {
        process.env.NODE_ENV = 'development';

        vi.mocked(getAuthUser).mockResolvedValue(null);
        vi.mocked(getAuthUserShop).mockResolvedValue(null);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            auth_status: {
                isAuthenticated: false,
                user_id: null,
            },
            shop_status: {
                shop_found: false,
                shop_id: undefined,
                shop_name: undefined,
            },
        });
    });

    it('handles auth check failures gracefully', async () => {
        process.env.NODE_ENV = 'development';

        vi.mocked(getAuthUser).mockRejectedValue(new Error('Auth failed'));

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Auth check failed' });
    });
});
