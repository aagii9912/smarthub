import { NextRequest, NextResponse } from 'next/server';

// Instagram OAuth - Start (uses Facebook OAuth with Instagram permissions)
export async function GET(request: NextRequest) {
    const appId = process.env.FACEBOOK_APP_ID?.trim();

    if (!appId) {
        return NextResponse.json({ error: 'Facebook App ID not configured' }, { status: 500 });
    }

    // Get the current origin for redirect URI
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/instagram/callback`;

    // Check if request comes from settings (has shop_id param)
    const shopId = request.nextUrl.searchParams.get('shop_id') || '';
    const source = request.nextUrl.searchParams.get('source') || 'setup';
    const state = Buffer.from(JSON.stringify({ source, shopId })).toString('base64');

    // Required permissions for Instagram messaging
    const permissions = [
        'pages_show_list',
        'pages_messaging',
        'pages_manage_metadata',
        'instagram_basic',
        'instagram_manage_messages',
        'public_profile',
    ].join(',');

    // Build Facebook OAuth URL (Instagram uses same OAuth flow)
    const fbAuthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    fbAuthUrl.searchParams.set('client_id', appId);
    fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
    fbAuthUrl.searchParams.set('scope', permissions);
    fbAuthUrl.searchParams.set('response_type', 'code');
    fbAuthUrl.searchParams.set('state', state);
    // Force full permission dialog (not just "Reconnect")
    fbAuthUrl.searchParams.set('auth_type', 'rerequest');

    return NextResponse.redirect(fbAuthUrl.toString());
}
