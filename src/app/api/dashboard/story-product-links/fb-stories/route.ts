import { logger } from '@/lib/utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Resolve the shop for the authenticated user with the SAME ownership check as
 * the parent story-product-links route (the x-shop-id header is attacker-
 * controllable and these reads use the service-role client which bypasses RLS).
 */
async function getShopId(request: NextRequest): Promise<string | null> {
    const userId = await getAuthUser();
    if (!userId) return null;

    const supabase = supabaseAdmin();
    const headerShopId = request.headers.get('x-shop-id');
    if (headerShopId) {
        const { data } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', userId)
            .eq('id', headerShopId)
            .maybeSingle();
        return data?.id ?? null;
    }
    const { data } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
    return data?.id || null;
}

interface FbStory {
    id: string;
    media_type: string | null;
    created_time: string | null;
    permalink: string | null;
}

/**
 * GET /api/dashboard/story-product-links/fb-stories
 *
 * Lists the shop's recent Facebook Page stories via the Page Stories API so the
 * owner can pick one and assign a product (the active-pin window is derived from
 * the story's expiry, not typed by hand).
 *
 * Always returns 200 with `{ stories, available, reason? }`. When the page isn't
 * connected, the token lacks the stories-read permission, or the Graph call
 * fails, `available` is false and the UI falls back to manual hours — reading
 * stories is best-effort, never an error the owner has to resolve.
 */
export async function GET(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const { data: shop } = await supabase
            .from('shops')
            .select('facebook_page_id, facebook_page_access_token')
            .eq('id', shopId)
            .maybeSingle();

        const pageId = shop?.facebook_page_id as string | null | undefined;
        const token = shop?.facebook_page_access_token as string | null | undefined;
        if (!pageId || !token) {
            return NextResponse.json({ stories: [], available: false, reason: 'no_page' });
        }

        // Page Stories API. `url` is a facebook.com permalink (not a media file),
        // so the UI identifies stories by time/type + a "view" link.
        const graphUrl =
            `https://graph.facebook.com/v21.0/${pageId}/stories` +
            `?fields=post_id,media_id,media_type,status,creation_time,url&limit=25` +
            `&access_token=${encodeURIComponent(token)}`;

        const res = await fetch(graphUrl);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            logger.warn('FB stories fetch failed', { status: res.status, body: body.slice(0, 200) });
            return NextResponse.json({ stories: [], available: false, reason: 'fetch_error' });
        }

        const json = await res.json();
        const raw: Array<Record<string, unknown>> = Array.isArray(json?.data) ? json.data : [];
        const stories: FbStory[] = raw
            .map(s => ({
                id: String(s.post_id || s.media_id || s.id || ''),
                media_type: (s.media_type as string) ?? null,
                created_time: (s.creation_time as string) ?? null,
                permalink: (s.url as string) ?? null,
            }))
            .filter(s => !!s.id);

        return NextResponse.json({ stories, available: true });
    } catch (error: unknown) {
        logger.error('GET fb-stories error:', { error });
        return NextResponse.json({ stories: [], available: false, reason: 'error' });
    }
}
