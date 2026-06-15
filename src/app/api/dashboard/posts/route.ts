import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/dashboard/posts
 * Fetch Facebook Page posts + Instagram media for the shop
 * Returns unified list for post selector dropdown
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const shopId = request.headers.get('x-shop-id');
        if (!shopId) {
            return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        // SECURITY: scope by user_id. supabaseAdmin() uses the service role and
        // BYPASSES RLS, so without this an authenticated user could pass any
        // shop's id and read its Facebook/Instagram access tokens + posts (IDOR).
        const { data: shop } = await supabase
            .from('shops')
            .select('facebook_page_id, facebook_page_access_token, instagram_business_account_id, instagram_access_token')
            .eq('id', shopId)
            .eq('user_id', userId)
            .maybeSingle();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        const posts: Array<{
            id: string;
            message: string;
            picture: string | null;
            created_time: string;
            platform: 'facebook' | 'instagram';
            type: string;
        }> = [];

        // 1. Fetch Facebook Page posts.
        // NOTE: `type` was removed from /published_posts after Graph API v3.3
        // and including it makes the whole call 400 in v21.0 — so the dropdown
        // always rendered empty. Drop it from the field list and infer locally.
        // Try /published_posts first (page's own published posts); fall back
        // to /feed (broader, includes visitor posts) if /published_posts errors
        // or returns empty.
        const fbDiagnostics: { tried: string; status?: number; error?: unknown; count?: number }[] = [];
        if (shop.facebook_page_id && shop.facebook_page_access_token) {
            const token = encodeURIComponent(shop.facebook_page_access_token);
            const baseFields = 'id,message,full_picture,created_time';
            const endpoints = [
                `https://graph.facebook.com/v21.0/${shop.facebook_page_id}/published_posts?fields=${baseFields}&limit=25&access_token=${token}`,
                `https://graph.facebook.com/v21.0/${shop.facebook_page_id}/feed?fields=${baseFields}&limit=25&access_token=${token}`,
                `https://graph.facebook.com/v21.0/${shop.facebook_page_id}/posts?fields=${baseFields}&limit=25&access_token=${token}`,
            ];

            for (const fbUrl of endpoints) {
                const tag = fbUrl.split('?')[0].split('/').pop() || 'fb';
                try {
                    const fbRes = await fetch(fbUrl);
                    if (fbRes.ok) {
                        const fbData = await fbRes.json();
                        const items = fbData.data || [];
                        fbDiagnostics.push({ tried: tag, status: fbRes.status, count: items.length });
                        for (const post of items) {
                            posts.push({
                                id: post.id,
                                message: post.message || '(Зурагтай пост)',
                                picture: post.full_picture || null,
                                created_time: post.created_time,
                                platform: 'facebook',
                                type: post.full_picture ? 'photo' : 'status',
                            });
                        }
                        if (items.length > 0) break; // got results — stop trying further endpoints
                    } else {
                        const errBody = await fbRes.json().catch(() => ({}));
                        fbDiagnostics.push({ tried: tag, status: fbRes.status, error: errBody?.error });
                        logger.error('FB posts API non-OK response', {
                            endpoint: tag,
                            status: fbRes.status,
                            error: errBody?.error,
                        });
                    }
                } catch (e) {
                    fbDiagnostics.push({ tried: tag, error: e instanceof Error ? e.message : String(e) });
                    logger.error('Error fetching FB posts:', { endpoint: tag, error: e });
                }
            }
        }

        // 2. Fetch Instagram media
        const igToken = shop.instagram_access_token || shop.facebook_page_access_token;
        if (shop.instagram_business_account_id && igToken) {
            try {
                const igRes = await fetch(
                    `https://graph.facebook.com/v21.0/${shop.instagram_business_account_id}/media?fields=id,caption,media_url,timestamp,media_type&limit=25&access_token=${igToken}`
                );

                if (igRes.ok) {
                    const igData = await igRes.json();
                    for (const media of igData.data || []) {
                        posts.push({
                            id: media.id,
                            message: media.caption || '(Instagram пост)',
                            picture: media.media_url || null,
                            created_time: media.timestamp,
                            platform: 'instagram',
                            type: media.media_type?.toLowerCase() || 'image',
                        });
                    }
                }
            } catch (e) {
                logger.error('Error fetching IG media:', { error: e });
            }
        }

        // Sort by date (newest first)
        posts.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());

        // Diagnostics: surface FB-side issues to the client so the dashboard
        // can show a precise reason ("token expired", "missing permission",
        // etc.) when no FB posts come back. The IG fetch already works
        // separately, so this only flags the FB hot path.
        const fbHasResults = posts.some(p => p.platform === 'facebook');
        return NextResponse.json({
            posts,
            diagnostics: {
                facebook: {
                    pageConnected: !!shop.facebook_page_id,
                    hasResults: fbHasResults,
                    attempts: fbDiagnostics,
                },
            },
        });
    } catch (error: unknown) {
        logger.error('GET posts error:', { error: error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
