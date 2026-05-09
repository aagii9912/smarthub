import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Instagram Login OAuth start (direct IG flow — no Facebook Page required).
// Used by shops whose Instagram Business/Creator account is NOT linked to
// a Facebook Page; they cannot use the legacy /api/auth/instagram entry
// because that path discovers IG accounts via the user's FB Pages.
export async function GET(request: NextRequest) {
    const appId = process.env.INSTAGRAM_APP_ID?.trim();

    if (!appId) {
        return NextResponse.json(
            { error: 'Instagram App ID not configured (INSTAGRAM_APP_ID)' },
            { status: 500 }
        );
    }

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/instagram-login/callback`;

    const shopId = request.nextUrl.searchParams.get('shop_id') || '';
    const source = request.nextUrl.searchParams.get('source') || 'setup';

    // CSRF: same nonce-in-state-and-cookie pattern as the FB-Login flow.
    // Cookie name is intentionally distinct so a user can have both flows
    // in flight in different tabs without the cookies clobbering each other.
    const nonce = crypto.randomUUID();
    const state = Buffer.from(JSON.stringify({ source, shopId, nonce })).toString('base64');

    // Scopes for Instagram Login API (different namespace from FB-Login flow).
    // These require a SEPARATE Meta App Review submission — see
    // docs/meta-review/INSTAGRAM_LOGIN_REVIEW.md.
    const permissions = [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
    ].join(',');

    const igAuthUrl = new URL('https://www.instagram.com/oauth/authorize');
    igAuthUrl.searchParams.set('client_id', appId);
    igAuthUrl.searchParams.set('redirect_uri', redirectUri);
    igAuthUrl.searchParams.set('scope', permissions);
    igAuthUrl.searchParams.set('response_type', 'code');
    igAuthUrl.searchParams.set('state', state);
    // Force the consent dialog every time so re-auth after a token revoke
    // shows the full permission list (matches FB flow's auth_type=rerequest).
    igAuthUrl.searchParams.set('force_reauth', 'true');

    const response = NextResponse.redirect(igAuthUrl.toString());
    response.cookies.set('ig_login_oauth_state', nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
    });

    return response;
}
