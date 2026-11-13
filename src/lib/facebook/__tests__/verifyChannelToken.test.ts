import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyFacebookPageToken, verifyInstagramAccountToken } from '@/lib/facebook/verifyChannelToken';

type GraphReply = { status?: number; body: unknown };

/** Graph-ын хариуг URL-ийн замаар нь ялгаж mock хийнэ (жнь '/debug_token', '/me'). */
function mockGraph(routes: Record<string, GraphReply>) {
    const fetchMock = vi.fn(async (input: unknown) => {
        const path = new URL(String(input)).pathname.replace('/v21.0', '');
        const reply = routes[path];
        if (!reply) throw new Error(`unexpected Graph call: ${path}`);
        const status = reply.status ?? 200;
        return { ok: status >= 200 && status < 300, status, json: async () => reply.body };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function calledPaths(fetchMock: ReturnType<typeof mockGraph>): string[] {
    return fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname.replace('/v21.0', ''));
}

const pageToken = (profileId: string, extra: Record<string, unknown> = {}): GraphReply => ({
    body: { data: { is_valid: true, type: 'PAGE', app_id: 'app-1', profile_id: profileId, ...extra } },
});

/** Жинхэнэ production алдаа: манай OAuth scope-уудтай page token-оор Page node уншихад. */
const missingPagePermission: GraphReply = {
    status: 400,
    body: { error: { code: 100, message: "(#100) This endpoint requires the 'pages_read_engagement' permission" } },
};

beforeEach(() => {
    vi.stubEnv('FACEBOOK_APP_ID', 'app-1');
    vi.stubEnv('FACEBOOK_APP_SECRET', 'secret-1');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('verifyFacebookPageToken', () => {
    it('accepts a valid page token for the same page via debug_token only', async () => {
        const fetchMock = mockGraph({ '/debug_token': pageToken('page-1') });

        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toEqual({ ok: true, id: 'page-1' });

        // Page node (/me) уншихгүй — тэр нь pages_read_engagement шаарддаг.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v21.0/debug_token');
        expect(url.searchParams.get('input_token')).toBe('tok');
        expect(url.searchParams.get('access_token')).toBe('app-1|secret-1');
    });

    it('rejects a token that belongs to another page', async () => {
        mockGraph({ '/debug_token': pageToken('someone-else') });
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });
    });

    it('rejects a user token (no profile_id)', async () => {
        mockGraph({ '/debug_token': { body: { data: { is_valid: true, type: 'USER', user_id: 'page-1' } } } });
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });
    });

    it('rejects a token Meta reports as invalid', async () => {
        mockGraph({
            '/debug_token': { body: { data: { is_valid: false, error: { code: 190, message: 'Invalid OAuth access token.' } } } },
        });
        await expect(verifyFacebookPageToken('page-1', 'junk')).resolves.toEqual({
            ok: false, reason: 'graph_error', detail: '190 Invalid OAuth access token.',
        });
    });

    it('rejects when Graph returns an error (e.g. token from another app)', async () => {
        mockGraph({ '/debug_token': { status: 400, body: { error: { code: 100, message: 'App_id mismatch' } } } });
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'graph_error' });
    });

    it('rejects without calling Graph when app credentials are missing', async () => {
        vi.stubEnv('FACEBOOK_APP_SECRET', '');
        const fetchMock = mockGraph({});
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'graph_error' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects when the network call throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'graph_error', detail: 'ECONNRESET' });
    });
});

describe('verifyInstagramAccountToken', () => {
    it("accepts when the token's page is linked to that IG account (/me readable)", async () => {
        const fetchMock = mockGraph({
            '/me': { body: { id: 'page-1', instagram_business_account: { id: '111', username: 'real_ig' } } },
        });
        await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toEqual({ ok: true, id: '111', username: 'real_ig', pageId: 'page-1' });
        expect(calledPaths(fetchMock)).toEqual(['/me']);
    });

    it("rejects when the token's page has a different or no IG account", async () => {
        mockGraph({ '/me': { body: { id: 'page-1', instagram_business_account: { id: '999' } } } });
        await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });

        mockGraph({ '/me': { body: { id: 'page-1' } } });
        await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });
    });

    describe('when /me is blocked by the missing pages_read_engagement permission', () => {
        it('accepts when the token can read that IG account directly', async () => {
            const fetchMock = mockGraph({
                '/me': missingPagePermission,
                '/debug_token': pageToken('page-1'),
                '/111': { body: { id: '111', username: 'real_ig' } },
            });
            await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toEqual({ ok: true, id: '111', username: 'real_ig', pageId: 'page-1' });
            expect(calledPaths(fetchMock)).toEqual(['/me', '/debug_token', '/111']);
        });

        it('accepts when the OAuth grant lists that IG account', async () => {
            mockGraph({
                '/me': missingPagePermission,
                '/debug_token': pageToken('page-1', {
                    granular_scopes: [
                        { scope: 'pages_messaging', target_ids: ['page-1'] },
                        { scope: 'instagram_basic', target_ids: ['111'] },
                    ],
                }),
                '/111': missingPagePermission,
            });
            await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toEqual({ ok: true, id: '111', username: null, pageId: 'page-1' });
        });

        it('rejects as id_mismatch when the OAuth grant lists other IG accounts only', async () => {
            mockGraph({
                '/me': missingPagePermission,
                '/debug_token': pageToken('page-1', { granular_scopes: [{ scope: 'instagram_basic', target_ids: ['999'] }] }),
                '/111': missingPagePermission,
            });
            await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });
        });

        it('does not treat a page-scope grant as an IG grant', async () => {
            mockGraph({
                '/me': missingPagePermission,
                '/debug_token': pageToken('page-1', { granular_scopes: [{ scope: 'pages_messaging', target_ids: ['111'] }] }),
                '/111': missingPagePermission,
            });
            await expect(verifyInstagramAccountToken('111', 'tok')).resolves.toMatchObject({ ok: false, reason: 'graph_error' });
        });

        it('rejects when the token is not valid', async () => {
            const fetchMock = mockGraph({
                '/me': missingPagePermission,
                '/debug_token': { body: { data: { is_valid: false } } },
            });
            await expect(verifyInstagramAccountToken('111', 'junk')).resolves.toMatchObject({ ok: false, reason: 'graph_error' });
            expect(calledPaths(fetchMock)).toEqual(['/me', '/debug_token']);
        });

        it('never puts a non-numeric IG id into the Graph path', async () => {
            const fetchMock = mockGraph({ '/me': missingPagePermission, '/debug_token': pageToken('page-1') });
            await expect(verifyInstagramAccountToken('me/accounts', 'tok')).resolves.toMatchObject({ ok: false, reason: 'graph_error' });
            expect(calledPaths(fetchMock)).toEqual(['/me', '/debug_token']);
        });
    });
});
