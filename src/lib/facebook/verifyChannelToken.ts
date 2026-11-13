/**
 * Клиентээс ирсэн Facebook page / Instagram бүртгэлийн ID-г тухайн page-ийн
 * access token-оор Graph API дээр баталгаажуулна.
 *
 * Яагаад: page ID нь нууц биш (page-ийн URL-аас л харагдана). Хэрэв серверт
 * ирсэн ID-д шууд итгэвэл хэн ч өөр дэлгүүрийн page ID + хог token илгээгээд
 * page-ийг нь булааж, Meta webhook-ийг өөрийн дэлгүүр рүү чиглүүлж чадна.
 *
 * Шалгалт нь `GET /debug_token` (манай app token-оор) дээр суурилна: Meta
 * token хүчинтэй эсэх, манай app-аас гарсан эсэх, аль page-ийнх болохыг
 * (`profile_id`) буцаадаг бөгөөд page-ийн ямар ч permission шаарддаггүй.
 *
 * АНХААР: page token-оор `GET /me` (Page node) уншихад `pages_read_engagement`
 * хэрэгтэй. Манай OAuth (api/auth/facebook, api/auth/instagram) үүнийг
 * асуудаггүй тул `/me`-д тулгуурласан шалгалт жинхэнэ token-ыг ч
 * "(#100) ... requires the 'pages_read_engagement' permission" гэж унагадаг.
 *
 * Тест дээр `fetch`-ийг биш энэ модулийг mock хийнэ.
 */

const FB_GRAPH_URL = 'https://graph.facebook.com/v21.0';
const GRAPH_TIMEOUT_MS = 10_000;

/** IG бүртгэлд хандах эрхийг илтгэх scope-ууд (debug_token-ийн granular_scopes). */
const IG_SCOPES = ['instagram_basic', 'instagram_manage_messages'];

export type ChannelTokenFailure = {
    ok: false;
    /** graph_error: token хүчингүй / Graph алдаа / сүлжээ; id_mismatch: token өөр page/IG-ийнх. */
    reason: 'graph_error' | 'id_mismatch';
    detail: string;
};

export type FacebookPageTokenResult = { ok: true; id: string } | ChannelTokenFailure;

export type InstagramAccountTokenResult =
    | { ok: true; id: string; username: string | null; pageId: string | null }
    | ChannelTokenFailure;

type GraphResult = { ok: true; data: Record<string, unknown> } | { ok: false; detail: string };

type GranularScope = { scope?: unknown; target_ids?: unknown };

type TokenInfo =
    | { ok: true; profileId: string | null; type: string | null; granularScopes: GranularScope[] }
    | { ok: false; detail: string };

function graphErrorDetail(err: { message?: unknown; code?: unknown } | undefined, fallback: string): string {
    if (!err) return fallback;
    return `${err.code ?? ''} ${err.message ?? ''}`.trim() || fallback;
}

async function graphGet(path: string, params: Record<string, string>): Promise<GraphResult> {
    const url = new URL(`${FB_GRAPH_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
        const data = (await res.json().catch(() => null)) as
            | (Record<string, unknown> & { error?: { message?: string; code?: number } })
            | null;
        if (!res.ok || !data || data.error) {
            return { ok: false, detail: graphErrorDetail(data?.error, `HTTP ${res.status}`) };
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

/**
 * Token-ыг манай app token-оор шинжилнэ. Өөр app-ийн token-д Graph алдаа
 * буцаадаг тул амжилттай хариу = манай app-аас гарсан хүчинтэй token.
 */
async function debugToken(inputToken: string): Promise<TokenInfo> {
    const appId = process.env.FACEBOOK_APP_ID?.trim();
    const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
    if (!appId || !appSecret) {
        return { ok: false, detail: 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not configured' };
    }

    const res = await graphGet('/debug_token', {
        input_token: inputToken,
        access_token: `${appId}|${appSecret}`,
    });
    if (!res.ok) return res;

    const info = res.data.data as
        | {
              is_valid?: unknown;
              profile_id?: unknown;
              type?: unknown;
              granular_scopes?: unknown;
              error?: { message?: unknown; code?: unknown };
          }
        | undefined;
    if (!info || info.is_valid !== true) {
        return { ok: false, detail: graphErrorDetail(info?.error, 'token is not valid') };
    }

    return {
        ok: true,
        profileId: asString(info.profile_id),
        type: asString(info.type),
        granularScopes: Array.isArray(info.granular_scopes) ? (info.granular_scopes as GranularScope[]) : [],
    };
}

/**
 * Хэрэглэгч OAuth дээр тодорхой бүртгэлүүдийг сонгосон бол granular_scopes-д
 * `target_ids` ирнэ ("бүгдийг" сонгосон бол ирэхгүй → null).
 */
function instagramGrantTargets(scopes: GranularScope[]): string[] | null {
    const targets: string[] = [];
    let listed = false;
    for (const entry of scopes) {
        if (typeof entry.scope !== 'string' || !IG_SCOPES.includes(entry.scope)) continue;
        if (!Array.isArray(entry.target_ids)) continue;
        listed = true;
        for (const id of entry.target_ids) {
            const value = asString(id);
            if (value) targets.push(value);
        }
    }
    return listed ? targets : null;
}

/** Token нь яг `pageId` page-ийн, манай app-аас гарсан хүчинтэй page token мөн эсэх. */
export async function verifyFacebookPageToken(pageId: string, accessToken: string): Promise<FacebookPageTokenResult> {
    const info = await debugToken(accessToken);
    if (!info.ok) return { ok: false, reason: 'graph_error', detail: info.detail };

    if (info.profileId !== pageId) {
        return {
            ok: false,
            reason: 'id_mismatch',
            detail: `token belongs to ${info.profileId ?? `no page (type ${info.type ?? 'unknown'})`}`,
        };
    }
    return { ok: true, id: pageId };
}

/**
 * Token нь `igAccountId` Instagram business бүртгэлд хандах эрхтэй page token
 * мөн эсэх. Боломжтой бол Graph-ын username-ийг буцаана.
 *
 * 1. `GET /me` — token `pages_read_engagement`-тэй бол page ↔ IG холбоосыг шууд өгнө.
 * 2. Тэр нь permission-оор унавал: debug_token-оор token-ыг баталгаажуулаад
 *    IG бүртгэлийг тэр token-оор шууд уншина, эсвэл OAuth дээр яг тэр
 *    бүртгэлд эрх өгсөн эсэхийг granular_scopes-оос харна.
 */
export async function verifyInstagramAccountToken(
    igAccountId: string,
    accessToken: string
): Promise<InstagramAccountTokenResult> {
    const me = await graphGet('/me', {
        fields: 'id,instagram_business_account{id,username}',
        access_token: accessToken,
    });
    if (me.ok) {
        const ig = me.data.instagram_business_account as { id?: unknown; username?: unknown } | undefined;
        const id = asString(ig?.id);
        if (id !== igAccountId) {
            return { ok: false, reason: 'id_mismatch', detail: `page's IG account is ${id ?? 'none'}` };
        }
        return { ok: true, id, username: asString(ig?.username), pageId: asString(me.data.id) };
    }

    const info = await debugToken(accessToken);
    if (!info.ok) return { ok: false, reason: 'graph_error', detail: info.detail };

    // ID нь URL-ийн зам болж орох тул зөвхөн тоон ID-г зөвшөөрнө.
    let nodeDetail = 'not a numeric IG id';
    if (/^\d+$/.test(igAccountId)) {
        const node = await graphGet(`/${igAccountId}`, { fields: 'id,username', access_token: accessToken });
        if (node.ok && asString(node.data.id) === igAccountId) {
            return { ok: true, id: igAccountId, username: asString(node.data.username), pageId: info.profileId };
        }
        nodeDetail = node.ok ? `returned ${asString(node.data.id) ?? 'no id'}` : node.detail;
    }

    const targets = instagramGrantTargets(info.granularScopes);
    if (targets?.includes(igAccountId)) {
        return { ok: true, id: igAccountId, username: null, pageId: info.profileId };
    }
    if (targets) {
        return { ok: false, reason: 'id_mismatch', detail: `token is granted for IG ${targets.join(',') || 'none'}` };
    }
    return { ok: false, reason: 'graph_error', detail: `/me: ${me.detail}; IG node: ${nodeDetail}` };
}
