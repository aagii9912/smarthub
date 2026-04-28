/**
 * Integration tests for /api/email/unsubscribe.
 *
 * Critical surface: the entire reason we add per-feature email digests is
 * to give shop owners a one-click escape hatch. The HMAC must reject
 * tampered requests, and a valid sig must flip the DB flag.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

const { updateMock, eqMock, fromMock } = vi.hoisted(() => ({
    updateMock: vi.fn(),
    eqMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        from: fromMock,
    }),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { GET } from '@/app/api/email/unsubscribe/route';

beforeEach(() => {
    updateMock.mockReset();
    eqMock.mockReset();
    fromMock.mockReset();

    eqMock.mockResolvedValue({ data: null, error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });

    vi.stubEnv('CRON_SECRET', '');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

function sign(secret: string, shopId: string): string {
    return crypto.createHmac('sha256', secret).update(`unsubscribe:${shopId}`).digest('hex');
}

describe('GET /api/email/unsubscribe — input validation', () => {
    it('returns an error page (200 HTML) when shop param is missing', async () => {
        const req = new Request('http://localhost/api/email/unsubscribe');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
        expect(html).toMatch(/Алдаа/);
        expect(html).toMatch(/Shop ID/i);
        expect(updateMock).not.toHaveBeenCalled();
    });
});

describe('GET /api/email/unsubscribe — HMAC verification (production)', () => {
    beforeEach(() => {
        vi.stubEnv('CRON_SECRET', 'unsubscribe-secret');
    });

    it('rejects when sig is missing', async () => {
        const req = new Request('http://localhost/api/email/unsubscribe?shop=shop-1');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(html).toMatch(/баталгаажуулалт/);
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects when sig is wrong', async () => {
        const req = new Request('http://localhost/api/email/unsubscribe?shop=shop-1&sig=deadbeef');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(html).toMatch(/баталгаажуулалт/);
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects when shopId is swapped (sig is for a different shop)', async () => {
        // Sig signed for shop-A, but request arrives for shop-B
        const sigForA = sign('unsubscribe-secret', 'shop-A');
        const req = new Request(`http://localhost/api/email/unsubscribe?shop=shop-B&sig=${sigForA}`);
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(html).toMatch(/баталгаажуулалт/);
        expect(updateMock).not.toHaveBeenCalled();
    });

    it('accepts a valid sig and flips token_report_email_enabled to false', async () => {
        const sig = sign('unsubscribe-secret', 'shop-OK');
        const req = new Request(`http://localhost/api/email/unsubscribe?shop=shop-OK&sig=${sig}`);
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(html).toMatch(/Захиалга цуцлагдлаа/);
        expect(fromMock).toHaveBeenCalledWith('shops');
        expect(updateMock).toHaveBeenCalledWith({ token_report_email_enabled: false });
        expect(eqMock).toHaveBeenCalledWith('id', 'shop-OK');
    });
});

describe('GET /api/email/unsubscribe — dev mode (no CRON_SECRET)', () => {
    it('accepts even without sig (no signing key configured locally)', async () => {
        const req = new Request('http://localhost/api/email/unsubscribe?shop=shop-dev');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(html).toMatch(/Захиалга цуцлагдлаа/);
        expect(updateMock).toHaveBeenCalledWith({ token_report_email_enabled: false });
        expect(eqMock).toHaveBeenCalledWith('id', 'shop-dev');
    });
});

describe('GET /api/email/unsubscribe — DB error', () => {
    it('returns an error page when the UPDATE fails', async () => {
        eqMock.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } });

        const req = new Request('http://localhost/api/email/unsubscribe?shop=shop-X');
        const res = await GET(req as unknown as Parameters<typeof GET>[0]);

        const html = await res.text();
        expect(html).toMatch(/алдаа/);
        // Even when the DB layer errors, the user gets an HTML page (no 500 raw)
        expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
    });
});
