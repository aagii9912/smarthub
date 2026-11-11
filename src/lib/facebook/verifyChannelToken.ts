/**
 * Клиентээс ирсэн Facebook page / Instagram бүртгэлийн ID-г тухайн page-ийн
 * access token-оор Graph API дээр баталгаажуулна.
 *
 * Яагаад: page ID нь нууц биш (page-ийн URL-аас л харагдана). Хэрэв серверт
 * ирсэн ID-д шууд итгэвэл хэн ч өөр дэлгүүрийн page ID + хог token илгээгээд
 * page-ийг нь булааж, Meta webhook-ийг өөрийн дэлгүүр рүү чиглүүлж чадна.
 * Page token-оор `GET /me` дуудахад тэр page өөрөө буцдаг тул ID таарвал
 * илгээгч тэр page-ийн token-ыг үнэхээр эзэмшиж байна гэсэн үг.
 *
 * Тест дээр `fetch`-ийг биш энэ модулийг mock хийнэ.
 */

const FB_GRAPH_URL = 'https://graph.facebook.com/v21.0';
const GRAPH_TIMEOUT_MS = 10_000;

export type ChannelTokenFailure = {
    ok: false;
    /** graph_error: token хүчингүй / Graph алдаа / сүлжээ; id_mismatch: token өөр page/IG-ийнх. */
    reason: 'graph_error' | 'id_mismatch';
    detail: string;
};

export type FacebookPageTokenResult = { ok: true; id: string; name: string | null } | ChannelTokenFailure;

export type InstagramAccountTokenResult =
    | { ok: true; id: string; username: string | null; pageId: string | null }
    | ChannelTokenFailure;

type GraphMeResult = { ok: true; data: Record<string, unknown> } | { ok: false; detail: string };

async function graphMe(fields: string, accessToken: string): Promise<GraphMeResult> {
    const url = new URL(`${FB_GRAPH_URL}/me`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('access_token', accessToken);

    try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
        const data = (await res.json().catch(() => null)) as
            | (Record<string, unknown> & { error?: { message?: string; code?: number } })
            | null;
        if (!res.ok || !data || data.error) {
            const err = data?.error;
            return { ok: false, detail: err ? `${err.code ?? ''} ${err.message ?? ''}`.trim() : `HTTP ${res.status}` };
        }
        return { ok: true, data };
    } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
}

function asString(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number') return String(value);
    return null;
}

/** Token нь яг `pageId` page-ийн page token мөн эсэх. Амжилттай бол Graph-ын page нэрийг буцаана. */
export async function verifyFacebookPageToken(pageId: string, accessToken: string): Promise<FacebookPageTokenResult> {
    const me = await graphMe('id,name', accessToken);
    if (!me.ok) return { ok: false, reason: 'graph_error', detail: me.detail };

    const id = asString(me.data.id);
    if (id !== pageId) {
        return { ok: false, reason: 'id_mismatch', detail: `token belongs to ${id ?? 'unknown'}` };
    }
    return { ok: true, id, name: asString(me.data.name) };
}

/**
 * Token нь `igAccountId` Instagram business бүртгэлтэй холбогдсон page-ийн
 * page token мөн эсэх. Амжилттай бол Graph-ын username-ийг буцаана.
 */
export async function verifyInstagramAccountToken(
    igAccountId: string,
    accessToken: string
): Promise<InstagramAccountTokenResult> {
    const me = await graphMe('id,instagram_business_account{id,username}', accessToken);
    if (!me.ok) return { ok: false, reason: 'graph_error', detail: me.detail };

    const ig = me.data.instagram_business_account as { id?: unknown; username?: unknown } | undefined;
    const id = asString(ig?.id);
    if (id !== igAccountId) {
        return { ok: false, reason: 'id_mismatch', detail: `page's IG account is ${id ?? 'none'}` };
    }
    return { ok: true, id, username: asString(ig?.username), pageId: asString(me.data.id) };
}
