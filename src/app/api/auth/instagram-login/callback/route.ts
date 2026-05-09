import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

interface IgTokenExchangeResponse {
    access_token?: string;
    user_id?: string | number;
    error_type?: string;
    error_message?: string;
    error?: { message?: string; type?: string; code?: number };
}

interface IgLongLivedTokenResponse {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string; type?: string; code?: number };
}

interface IgProfileResponse {
    user_id?: string;
    username?: string;
    account_type?: 'BUSINESS' | 'CREATOR' | 'PERSONAL' | string;
    profile_picture_url?: string;
    error?: { message?: string; type?: string; code?: number };
}

function timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateParam = searchParams.get('state');
    const origin = request.nextUrl.origin;

    let source = 'setup';
    let shopId = '';
    let nonce = '';
    if (stateParam) {
        try {
            const stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString());
            source = stateData.source || 'setup';
            shopId = stateData.shopId || '';
            nonce = stateData.nonce || '';
        } catch { /* ignore parse errors */ }
    }

    const redirectBase = source === 'settings' ? '/dashboard/settings' : '/setup';
    const redirectErr = (key: string) =>
        NextResponse.redirect(`${origin}${redirectBase}?ig_error=${encodeURIComponent(key)}`);

    // CSRF check — match the FB-Login flow's pattern. Cookie is named
    // ig_login_oauth_state to keep flows isolated.
    const cookieStore = await cookies();
    const savedNonce = cookieStore.get('ig_login_oauth_state')?.value;
    cookieStore.delete('ig_login_oauth_state');

    if (!nonce || !savedNonce || !timingSafeStringEqual(nonce, savedNonce)) {
        logger.warn('Instagram-Login OAuth CSRF validation failed', {
            hasStateNonce: !!nonce,
            hasCookieNonce: !!savedNonce,
        });
        return redirectErr('csrf_validation_failed');
    }

    if (error) {
        const errorReason = searchParams.get('error_reason') || 'Unknown error';
        return redirectErr(errorReason);
    }

    if (!code) return redirectErr('no_code');
    if (!shopId) return redirectErr('missing_shop_id');

    const appId = process.env.INSTAGRAM_APP_ID?.trim();
    const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();

    if (!appId || !appSecret) return redirectErr('config_missing');

    const redirectUri = `${origin}/api/auth/instagram-login/callback`;

    try {
        // Step 1: Exchange code → short-lived token. Note: form-encoded, NOT JSON.
        // Instagram's token endpoint rejects JSON bodies with a generic OAuth
        // error which is surprisingly hard to debug — keep this as URLSearchParams.
        const tokenBody = new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code,
        });

        const shortTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString(),
        });
        const shortTokenData: IgTokenExchangeResponse = await shortTokenRes.json();

        if (!shortTokenRes.ok || !shortTokenData.access_token) {
            logger.error('IG-Login short token exchange failed', {
                status: shortTokenRes.status,
                error: shortTokenData.error_message || shortTokenData.error?.message,
            });
            return redirectErr('token_error');
        }

        const shortToken = shortTokenData.access_token;

        // Step 2: Exchange short-lived → long-lived (60-day) token.
        const longUrl = new URL('https://graph.instagram.com/access_token');
        longUrl.searchParams.set('grant_type', 'ig_exchange_token');
        longUrl.searchParams.set('client_secret', appSecret);
        longUrl.searchParams.set('access_token', shortToken);

        const longRes = await fetch(longUrl.toString());
        const longData: IgLongLivedTokenResponse = await longRes.json();

        if (!longRes.ok || !longData.access_token) {
            logger.error('IG-Login long-lived token exchange failed', {
                status: longRes.status,
                error: longData.error?.message,
            });
            return redirectErr('long_token_error');
        }

        const longToken = longData.access_token;
        const expiresInSec = Number(longData.expires_in) || 5184000; // ~60 days
        const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

        // Step 3: Profile fetch — needed for account_type gate, username, and
        // the canonical user_id (== instagram_business_account_id used for
        // webhook routing).
        const profileUrl = new URL('https://graph.instagram.com/v21.0/me');
        profileUrl.searchParams.set('fields', 'user_id,username,account_type,profile_picture_url');
        profileUrl.searchParams.set('access_token', longToken);

        const profileRes = await fetch(profileUrl.toString());
        const profile: IgProfileResponse = await profileRes.json();

        if (!profileRes.ok || !profile.user_id) {
            logger.error('IG-Login profile fetch failed', {
                status: profileRes.status,
                error: profile.error?.message,
            });
            return redirectErr('profile_error');
        }

        // Personal accounts cannot use Messaging or Comments APIs at all —
        // reject early with a specific error so the UI can prompt the user
        // to convert to Business/Creator first.
        if (profile.account_type !== 'BUSINESS' && profile.account_type !== 'CREATOR') {
            logger.warn('IG-Login: non-business account rejected', {
                accountType: profile.account_type,
                username: profile.username,
            });
            return redirectErr('personal_account_unsupported');
        }

        const igUserId = String(profile.user_id);
        const username = profile.username || '';

        const supabase = supabaseAdmin();

        // Auth + ownership: confirm the shop in state belongs to the
        // currently authenticated user before mutating.
        const { getAuthUser } = await import('@/lib/auth/auth');
        const authUserId = await getAuthUser();

        if (!authUserId) return redirectErr('not_authenticated');

        const { data: shopRow } = await supabase
            .from('shops')
            .select('id, user_id')
            .eq('id', shopId)
            .maybeSingle();

        if (!shopRow || shopRow.user_id !== authUserId) {
            logger.warn('IG-Login callback: shop ownership check failed', {
                shopId,
                authUserId,
                rowUserId: shopRow?.user_id,
            });
            return redirectErr('shop_ownership');
        }

        // Uniqueness: enforce the partial UNIQUE index defensively up-front.
        // Without this, two different users could authorize the same IG
        // account and the second would 500 on the constraint violation.
        const { data: existingShop } = await supabase
            .from('shops')
            .select('id')
            .eq('instagram_business_account_id', igUserId)
            .neq('id', shopId)
            .maybeSingle();

        if (existingShop) {
            logger.warn('IG-Login: account already attached to another shop', {
                igUserId,
                conflictingShop: existingShop.id,
                requestedShop: shopId,
            });
            return redirectErr('already_connected');
        }

        const { error: dbError } = await supabase
            .from('shops')
            .update({
                instagram_business_account_id: igUserId,
                instagram_username: username,
                instagram_access_token: longToken,
                instagram_auth_type: 'instagram_login',
                instagram_token_expires_at: expiresAt,
                instagram_token_revoked_at: null,
            })
            .eq('id', shopId)
            .eq('user_id', authUserId);

        if (dbError) {
            logger.error('IG-Login: failed to save Instagram data', { error: dbError.message });
            return redirectErr('db_save_failed');
        }

        logger.success(`IG-Login connected for shop ${shopId} (@${username})`);
        return NextResponse.redirect(
            `${origin}${redirectBase}?ig_success=true&via=instagram_login`
        );
    } catch (err) {
        logger.error('IG-Login OAuth exception', {
            error: err instanceof Error ? err.message : 'Unknown',
        });
        return redirectErr('exception');
    }
}
