import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Facebook OAuth - Start
export async function GET(request: NextRequest) {
  const appId = process.env.FACEBOOK_APP_ID?.trim();

  if (!appId) {
    return NextResponse.json({ error: 'Facebook App ID not configured' }, { status: 500 });
  }

  // Get the current origin for redirect URI
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/facebook/callback`;

  // Determine where to return after OAuth completes
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/setup';

  // Required permissions for Messenger chatbot
  const permissions = [
    'pages_show_list',
    'pages_messaging',
    'pages_manage_metadata',
    'public_profile',
  ].join(',');

  // SEC-4: Generate CSRF state token
  const state = crypto.randomUUID();

  // Build Facebook OAuth URL
  const fbAuthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  fbAuthUrl.searchParams.set('client_id', appId);
  fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
  fbAuthUrl.searchParams.set('scope', permissions);
  fbAuthUrl.searchParams.set('response_type', 'code');
  fbAuthUrl.searchParams.set('state', state);
  // Force Facebook to re-show the permission + Page-selection screen even if the
  // user previously granted (or skipped/declined) it. Without this, FB silently
  // reuses the prior consent, so a user who skipped Page selection the first time
  // gets stuck in a loop where `/me/accounts` keeps returning 0 pages and the
  // "no_pages_granted" error repeats. `rerequest` lets them re-pick their Page.
  fbAuthUrl.searchParams.set('auth_type', 'rerequest');

  // Store state and returnTo in cookies for callback verification
  const response = NextResponse.redirect(fbAuthUrl.toString());
  response.cookies.set('fb_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
  response.cookies.set('fb_oauth_return_to', returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
