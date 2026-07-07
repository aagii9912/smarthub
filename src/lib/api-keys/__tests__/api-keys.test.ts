/**
 * Unit tests for src/lib/api-keys/index.ts
 *
 * Locks down the security-critical surface:
 *   - hashApiKey is deterministic SHA-256 (64 hex chars)
 *   - generateApiKey produces sk_live_ keys whose hash/prefix match the plaintext
 *   - extractApiKey reads Bearer + x-api-key headers
 *   - resolveApiKey rejects missing / revoked / expired keys and resolves valid ones
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fromMock, loggerMock } = vi.hoisted(() => ({
    fromMock: vi.fn(),
    loggerMock: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => ({ from: fromMock })),
}));
vi.mock('@/lib/utils/logger', () => ({ logger: loggerMock }));

import {
    hashApiKey,
    generateApiKey,
    extractApiKey,
    resolveApiKey,
} from '@/lib/api-keys';

/**
 * Build a mock query builder where the SELECT chain resolves to `selectResult`
 * and the UPDATE chain (last_used_at) is a no-op thenable.
 */
function mockQuery(selectResult: { data: unknown; error: unknown }) {
    const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(selectResult),
    };
    const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (cb: (r: { error: null }) => void) => cb({ error: null }),
    };
    fromMock.mockImplementation(() => ({ ...selectChain, ...updateChain }));
}

function reqWith(headers: Record<string, string>): Request {
    return new Request('https://example.com/api/v1/chat', { method: 'POST', headers });
}

beforeEach(() => {
    fromMock.mockReset();
    loggerMock.error.mockClear();
    loggerMock.warn.mockClear();
});

describe('hashApiKey', () => {
    it('is deterministic and 64 hex chars', () => {
        const a = hashApiKey('sk_live_abc');
        const b = hashApiKey('sk_live_abc');
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('differs for different inputs', () => {
        expect(hashApiKey('sk_live_a')).not.toBe(hashApiKey('sk_live_b'));
    });
});

describe('generateApiKey', () => {
    it('produces an sk_live_ key whose hash and prefix match', () => {
        const k = generateApiKey();
        expect(k.plaintext.startsWith('sk_live_')).toBe(true);
        expect(k.hash).toBe(hashApiKey(k.plaintext));
        expect(k.plaintext.startsWith(k.prefix)).toBe(true);
    });

    it('produces unique keys', () => {
        expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
    });
});

describe('extractApiKey', () => {
    it('reads Authorization: Bearer', () => {
        expect(extractApiKey(reqWith({ authorization: 'Bearer sk_live_x' }))).toBe('sk_live_x');
    });
    it('reads x-api-key', () => {
        expect(extractApiKey(reqWith({ 'x-api-key': 'sk_live_y' }))).toBe('sk_live_y');
    });
    it('returns null when absent', () => {
        expect(extractApiKey(reqWith({}))).toBeNull();
    });
});

describe('resolveApiKey', () => {
    it('returns null when no key header present (no DB hit)', async () => {
        const result = await resolveApiKey(reqWith({}));
        expect(result).toBeNull();
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('returns null when key not found', async () => {
        mockQuery({ data: null, error: null });
        const result = await resolveApiKey(reqWith({ authorization: 'Bearer sk_live_missing' }));
        expect(result).toBeNull();
    });

    it('returns null for a revoked key', async () => {
        mockQuery({
            data: { id: 'k1', shop_id: 's1', user_id: 'u1', revoked_at: '2026-01-01T00:00:00Z', expires_at: null },
            error: null,
        });
        const result = await resolveApiKey(reqWith({ authorization: 'Bearer sk_live_revoked' }));
        expect(result).toBeNull();
    });

    it('returns null for an expired key', async () => {
        mockQuery({
            data: { id: 'k1', shop_id: 's1', user_id: 'u1', revoked_at: null, expires_at: '2000-01-01T00:00:00Z' },
            error: null,
        });
        const result = await resolveApiKey(reqWith({ authorization: 'Bearer sk_live_expired' }));
        expect(result).toBeNull();
    });

    it('resolves a valid key to shop + owner', async () => {
        mockQuery({
            data: { id: 'k1', shop_id: 's1', user_id: 'u1', revoked_at: null, expires_at: null },
            error: null,
        });
        const result = await resolveApiKey(reqWith({ authorization: 'Bearer sk_live_valid' }));
        expect(result).toEqual({ keyId: 'k1', shopId: 's1', userId: 'u1' });
    });

    it('returns null and logs on DB error', async () => {
        mockQuery({ data: null, error: { message: 'boom' } });
        const result = await resolveApiKey(reqWith({ authorization: 'Bearer sk_live_err' }));
        expect(result).toBeNull();
        expect(loggerMock.error).toHaveBeenCalled();
    });
});
