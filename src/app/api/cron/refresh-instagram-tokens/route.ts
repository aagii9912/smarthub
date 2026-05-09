/**
 * Refresh Instagram Login long-lived tokens.
 *
 * IG-Login tokens are 60-day; Meta provides ig_refresh_token to extend them
 * up to another 60 days, but only if the current token is at least 24h old
 * and not yet expired. This cron runs daily and refreshes any token within
 * 7 days of expiry — comfortably outside the 24h-floor and well before
 * the cliff.
 *
 * Tokens that fail to refresh (permission_denied / OAuth error) are NOT
 * cleared automatically; we mark instagram_token_revoked_at so the UI can
 * prompt the user to reconnect, while preserving the rest of the row's
 * shop config.
 *
 * Touches only shops with instagram_auth_type = 'instagram_login'. The
 * legacy facebook_login flow uses Page tokens which do not expire on this
 * schedule and have a separate refresh path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

const CRON_SECRET = process.env.CRON_SECRET;

interface RefreshResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string; type?: string; code?: number };
}

interface ShopRow {
    id: string;
    name: string;
    instagram_username: string | null;
    instagram_access_token: string | null;
    instagram_token_expires_at: string | null;
}

export async function GET(request: NextRequest) {
    try {
        if (process.env.NODE_ENV === 'production' && CRON_SECRET) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${CRON_SECRET}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabase = supabaseAdmin();

        // 7-day refresh window: comfortably before the 60-day cliff and
        // long enough to retry once if the first attempt fails transiently.
        const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: shops, error: fetchError } = await supabase
            .from('shops')
            .select('id, name, instagram_username, instagram_access_token, instagram_token_expires_at')
            .eq('instagram_auth_type', 'instagram_login')
            .not('instagram_access_token', 'is', null)
            .is('instagram_token_revoked_at', null)
            .lt('instagram_token_expires_at', cutoff);

        if (fetchError) {
            logger.error('IG-Login token refresh: failed to fetch shops', {
                error: fetchError.message,
            });
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const candidates = (shops as ShopRow[] | null) ?? [];

        if (candidates.length === 0) {
            return NextResponse.json({ refreshed: 0, message: 'No tokens nearing expiry' });
        }

        let refreshed = 0;
        let revoked = 0;

        for (const shop of candidates) {
            if (!shop.instagram_access_token) continue;

            try {
                const url = new URL('https://graph.instagram.com/refresh_access_token');
                url.searchParams.set('grant_type', 'ig_refresh_token');
                url.searchParams.set('access_token', shop.instagram_access_token);

                const res = await fetch(url.toString());
                const data: RefreshResponse = await res.json();

                if (!res.ok || !data.access_token) {
                    // Treat any 4xx as revocation rather than retrying — Meta
                    // returns the same shape for "expired", "permission denied",
                    // and "user revoked", and none are recoverable without the
                    // user re-authorizing.
                    logger.warn('IG-Login token refresh failed — marking revoked', {
                        shopId: shop.id,
                        username: shop.instagram_username,
                        status: res.status,
                        error: data.error?.message,
                    });

                    await supabase
                        .from('shops')
                        .update({ instagram_token_revoked_at: new Date().toISOString() })
                        .eq('id', shop.id);

                    revoked += 1;
                    continue;
                }

                const expiresInSec = Number(data.expires_in) || 5184000;
                const newExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

                await supabase
                    .from('shops')
                    .update({
                        instagram_access_token: data.access_token,
                        instagram_token_expires_at: newExpiresAt,
                    })
                    .eq('id', shop.id);

                refreshed += 1;
                logger.info('IG-Login token refreshed', {
                    shopId: shop.id,
                    username: shop.instagram_username,
                    newExpiresAt,
                });
            } catch (err) {
                logger.error('IG-Login token refresh: exception', {
                    shopId: shop.id,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        logger.info(`IG-Login token refresh complete: ${refreshed} refreshed, ${revoked} revoked, ${candidates.length} candidates`);

        return NextResponse.json({
            refreshed,
            revoked,
            candidates: candidates.length,
        });
    } catch (error: unknown) {
        logger.error('IG-Login token refresh: unhandled error', { error });
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
