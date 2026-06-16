/**
 * Tests for the rate limiter (in-memory fallback path).
 *
 * In the test env no Upstash creds are set, so getRedisClient() returns the
 * in-memory backend (isRedis=false) and checkRateLimit uses the Map path.
 * This is the same fallback that runs in dev and whenever Redis is down, so
 * it is worth pinning: the window counting, the 429 boundary, and the
 * client-IP extraction used to key every limit.
 */
import { describe, it, expect } from 'vitest';
import {
    checkRateLimit,
    getClientIdentifier,
    getRateLimitHeaders,
    createRateLimitResponse,
    checkMiddlewareRateLimit,
    RATE_LIMIT_CONFIGS,
} from '@/lib/utils/rate-limiter';

const cfg = { windowMs: 60_000, maxRequests: 3 };
let seq = 0;
const uniqueKey = () => `test-key-${Date.now()}-${seq++}`;

describe('checkRateLimit (memory fallback)', () => {
    it('allows requests up to the limit then blocks', async () => {
        const key = uniqueKey();
        const r1 = await checkRateLimit(key, cfg);
        const r2 = await checkRateLimit(key, cfg);
        const r3 = await checkRateLimit(key, cfg);
        const r4 = await checkRateLimit(key, cfg);

        expect(r1.allowed).toBe(true);
        expect(r1.remaining).toBe(2);
        expect(r2.remaining).toBe(1);
        expect(r3.remaining).toBe(0);
        expect(r3.allowed).toBe(true);
        // 4th request exceeds maxRequests=3
        expect(r4.allowed).toBe(false);
        expect(r4.remaining).toBe(0);
    });

    it('keeps separate counters per key', async () => {
        const a = uniqueKey();
        const b = uniqueKey();
        await checkRateLimit(a, cfg);
        await checkRateLimit(a, cfg);
        const bResult = await checkRateLimit(b, cfg);
        // b is independent — still near-full allowance
        expect(bResult.remaining).toBe(2);
    });

    it('returns a future resetAt timestamp', async () => {
        const before = Date.now();
        const r = await checkRateLimit(uniqueKey(), cfg);
        expect(r.resetAt).toBeGreaterThan(before);
    });
});

describe('getClientIdentifier', () => {
    it('prefers the first IP in x-forwarded-for', () => {
        const req = new Request('http://x', {
            headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' },
        });
        expect(getClientIdentifier(req)).toBe('1.1.1.1');
    });

    it('falls back to x-real-ip', () => {
        const req = new Request('http://x', { headers: { 'x-real-ip': '3.3.3.3' } });
        expect(getClientIdentifier(req)).toBe('3.3.3.3');
    });

    it('falls back to cf-connecting-ip (Cloudflare)', () => {
        const req = new Request('http://x', { headers: { 'cf-connecting-ip': '4.4.4.4' } });
        expect(getClientIdentifier(req)).toBe('4.4.4.4');
    });

    it('returns "unknown" when no IP headers are present', () => {
        expect(getClientIdentifier(new Request('http://x'))).toBe('unknown');
    });
});

describe('getRateLimitHeaders', () => {
    it('emits the standard X-RateLimit-* triplet', () => {
        const headers = getRateLimitHeaders({ remaining: 5, resetAt: 60_000 }, 100);
        expect(headers['X-RateLimit-Limit']).toBe('100');
        expect(headers['X-RateLimit-Remaining']).toBe('5');
        expect(headers['X-RateLimit-Reset']).toBe('60'); // ceil(60000/1000)
    });
});

describe('createRateLimitResponse', () => {
    it('returns a 429 with Retry-After', async () => {
        const res = createRateLimitResponse(Date.now() + 30_000);
        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBeTruthy();
        const body = await res.json();
        expect(body.error).toBe('Too Many Requests');
    });
});

describe('checkMiddlewareRateLimit', () => {
    it('allows the first request for a fresh client', async () => {
        const req = new Request('http://x/api/dashboard/stats', {
            headers: { 'x-forwarded-for': `9.9.${seq++}.9` },
        });
        const result = await checkMiddlewareRateLimit(req, 'standard');
        expect(result.allowed).toBe(true);
        expect(result.response).toBeUndefined();
    });

    it('blocks with a 429 response once the strict limit is exceeded', async () => {
        const ip = `8.8.${seq++}.8`;
        const max = RATE_LIMIT_CONFIGS.strict.maxRequests;
        let last: Awaited<ReturnType<typeof checkMiddlewareRateLimit>> | undefined;
        // strict allows maxRequests; the next one is blocked
        for (let i = 0; i <= max; i++) {
            const req = new Request('http://x/api/chat', { headers: { 'x-forwarded-for': ip } });
            last = await checkMiddlewareRateLimit(req, 'strict');
        }
        expect(last!.allowed).toBe(false);
        expect(last!.response?.status).toBe(429);
    });
});
