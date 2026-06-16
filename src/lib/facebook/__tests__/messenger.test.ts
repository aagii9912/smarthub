/**
 * Tests for the Meta Graph API messenger helpers.
 *
 * Two things here are easy to silently break:
 *   1. The FB-Login vs IG-Login host switch. sendTextMessage must hit
 *      graph.facebook.com for the legacy/Messenger flow and
 *      graph.instagram.com only when authType === 'instagram_login'. A wrong
 *      host means messages vanish with no error the owner ever sees.
 *   2. classifyMetaError, which decides whether a failure is a token issue
 *      (prompt reconnect), a rate limit (back off), or noise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));
vi.mock('@/lib/monitoring/errorMonitoring', () => ({
    captureException: vi.fn(),
}));

import {
    sendTextMessage,
    classifyMetaError,
    verifyWebhook,
} from '@/lib/facebook/messenger';

function mockFetchOk() {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message_id: 'mid.123' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('sendTextMessage — Graph host routing', () => {
    it('uses graph.facebook.com by default (no authType)', async () => {
        const fetchMock = mockFetchOk();
        await sendTextMessage({ recipientId: 'r1', message: 'hi', pageAccessToken: 'tok' });

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toContain('https://graph.facebook.com');
        expect(calledUrl).not.toContain('graph.instagram.com');
    });

    it('uses graph.facebook.com for explicit facebook_login', async () => {
        const fetchMock = mockFetchOk();
        await sendTextMessage({
            recipientId: 'r1', message: 'hi', pageAccessToken: 'tok', authType: 'facebook_login',
        });
        expect(fetchMock.mock.calls[0][0] as string).toContain('https://graph.facebook.com');
    });

    it('switches to graph.instagram.com for instagram_login', async () => {
        const fetchMock = mockFetchOk();
        await sendTextMessage({
            recipientId: 'r1', message: 'hi', pageAccessToken: 'tok', authType: 'instagram_login',
        });
        expect(fetchMock.mock.calls[0][0] as string).toContain('https://graph.instagram.com');
    });

    it('posts the recipient + text payload to /me/messages', async () => {
        const fetchMock = mockFetchOk();
        await sendTextMessage({ recipientId: 'r-42', message: '  hello  ', pageAccessToken: 'tok' });

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/me/messages');
        expect(init.method).toBe('POST');
        const body = JSON.parse(init.body as string);
        expect(body.recipient).toEqual({ id: 'r-42' });
        // message is trimmed before sending
        expect(body.message).toEqual({ text: 'hello' });
    });

    it('substitutes a fallback message when the text is empty', async () => {
        const fetchMock = mockFetchOk();
        await sendTextMessage({ recipientId: 'r1', message: '   ', pageAccessToken: 'tok' });

        const init = fetchMock.mock.calls[0][1] as RequestInit;
        const body = JSON.parse(init.body as string);
        expect(body.message.text).toMatch(/Уучлаарай/);
    });

    it('throws with the Meta error message when the API responds not-ok', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Invalid OAuth token', code: 190 } }),
        }) as unknown as typeof fetch;

        await expect(
            sendTextMessage({ recipientId: 'r1', message: 'hi', pageAccessToken: 'bad' }),
        ).rejects.toThrow(/Invalid OAuth token/);
    });
});

describe('classifyMetaError', () => {
    it('returns "token_expired" for OAuth/token codes', () => {
        expect(classifyMetaError({ code: 190 })).toBe('token_expired');
        expect(classifyMetaError({ code: 463 })).toBe('token_expired');
    });
    it('returns "permission_denied" for permission codes', () => {
        expect(classifyMetaError({ code: 200 })).toBe('permission_denied');
        expect(classifyMetaError({ code: 10 })).toBe('permission_denied');
    });
    it('returns "rate_limit" for throttling codes', () => {
        expect(classifyMetaError({ code: 4 })).toBe('rate_limit');
        expect(classifyMetaError({ code: 613 })).toBe('rate_limit');
    });
    it('returns "other" for unknown or missing codes', () => {
        expect(classifyMetaError({ code: 999 })).toBe('other');
        expect(classifyMetaError({})).toBe('other');
        expect(classifyMetaError(undefined)).toBe('other');
    });
});

describe('verifyWebhook (GET challenge handshake)', () => {
    it('echoes the challenge when mode=subscribe and the token matches', () => {
        expect(verifyWebhook('subscribe', 'secret', 'CHALLENGE-1', 'secret')).toBe('CHALLENGE-1');
    });
    it('rejects when the verify token does not match', () => {
        expect(verifyWebhook('subscribe', 'wrong', 'CHALLENGE-1', 'secret')).toBeNull();
    });
    it('rejects when mode is not "subscribe"', () => {
        expect(verifyWebhook('unsubscribe', 'secret', 'CHALLENGE-1', 'secret')).toBeNull();
    });
    it('rejects null inputs', () => {
        expect(verifyWebhook(null, null, null, 'secret')).toBeNull();
    });
});
