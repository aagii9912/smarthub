import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyFacebookPageToken, verifyInstagramAccountToken } from '@/lib/facebook/verifyChannelToken';

function mockGraph(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('verifyFacebookPageToken', () => {
    it('accepts a page token for the same page and returns the Graph name', async () => {
        const fetchMock = mockGraph(200, { id: 'page-1', name: 'Real Page' });

        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toEqual({ ok: true, id: 'page-1', name: 'Real Page' });

        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v21.0/me');
        expect(url.searchParams.get('fields')).toBe('id,name');
        expect(url.searchParams.get('access_token')).toBe('tok');
    });

    it('rejects a token that belongs to another page (or a user token)', async () => {
        mockGraph(200, { id: 'someone-else', name: 'Other' });
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });
    });

    it('rejects when Graph returns an error', async () => {
        mockGraph(400, { error: { code: 190, message: 'Invalid OAuth access token.' } });
        await expect(verifyFacebookPageToken('page-1', 'junk')).resolves.toMatchObject({ ok: false, reason: 'graph_error' });
    });

    it('rejects when the network call throws', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
        await expect(verifyFacebookPageToken('page-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'graph_error', detail: 'ECONNRESET' });
    });
});

describe('verifyInstagramAccountToken', () => {
    it("accepts when the token's page is linked to that IG account", async () => {
        mockGraph(200, { id: 'page-1', instagram_business_account: { id: 'ig-1', username: 'real_ig' } });
        await expect(verifyInstagramAccountToken('ig-1', 'tok')).resolves.toEqual({ ok: true, id: 'ig-1', username: 'real_ig', pageId: 'page-1' });
    });

    it("rejects when the token's page has a different or no IG account", async () => {
        mockGraph(200, { id: 'page-1', instagram_business_account: { id: 'ig-other' } });
        await expect(verifyInstagramAccountToken('ig-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });

        mockGraph(200, { id: 'page-1' });
        await expect(verifyInstagramAccountToken('ig-1', 'tok')).resolves.toMatchObject({ ok: false, reason: 'id_mismatch' });
    });
});
