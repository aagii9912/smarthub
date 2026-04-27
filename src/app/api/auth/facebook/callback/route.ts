import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const origin = request.nextUrl.origin;

  // Read return destination from cookie (defaults to /setup)
  const cookieStore = await cookies();
  const returnTo = cookieStore.get('fb_oauth_return_to')?.value || '/setup';
  // Clean up returnTo cookie
  cookieStore.delete('fb_oauth_return_to');

  // Handle error from Facebook
  if (error) {
    const errorReason = searchParams.get('error_reason') || 'Unknown error';
    return NextResponse.redirect(`${origin}${returnTo}?fb_error=${encodeURIComponent(errorReason)}`);
  }

  // SEC-4: Verify CSRF state token
  const savedState = cookieStore.get('fb_oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${origin}${returnTo}?fb_error=csrf_validation_failed`);
  }
  // Clear the state cookie
  cookieStore.delete('fb_oauth_state');

  if (!code) {
    return NextResponse.redirect(`${origin}${returnTo}?fb_error=no_code`);
  }

  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();

  if (!appId || !appSecret || appSecret === 'your_facebook_app_secret') {
    return NextResponse.redirect(`${origin}${returnTo}?fb_error=config_missing`);
  }

  const redirectUri = `${origin}/api/auth/facebook/callback`;

  try {
    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error('Facebook token error:', { error: tokenData.error });
      return NextResponse.redirect(`${origin}${returnTo}?fb_error=token_error`);
    }

    const userAccessToken = tokenData.access_token;

    // Get user's Facebook Pages
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,category`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      logger.error('Facebook pages error:', { error: pagesData.error });
      return NextResponse.redirect(`${origin}${returnTo}?fb_error=pages_error`);
    }

    // Store pages data in a cookie
    const pages = (pagesData.data || []).slice(0, 10);

    // If FB returned zero pages, do NOT pretend success — surface an actionable
    // error to the user and capture diagnostics so we can investigate why this
    // particular admin's `/me/accounts` came back empty (granular permissions,
    // wrong Business, Meta App permission gap, etc.).
    if (pages.length === 0) {
      // One extra Graph call so the log entry identifies which FB user this is.
      // Failures here are non-blocking — diagnostics are best-effort.
      let fbUserId: string | undefined;
      let fbUserName: string | undefined;
      try {
        const meResponse = await fetch(
          `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${userAccessToken}`
        );
        const meData = await meResponse.json();
        if (!meData.error) {
          fbUserId = meData.id;
          fbUserName = meData.name;
        }
      } catch (meErr) {
        logger.warn('Facebook /me lookup failed (non-blocking):', { error: meErr });
      }

      logger.warn('Facebook callback: 0 pages returned', {
        fbUserId,
        fbUserName,
        rawDataLength: Array.isArray(pagesData.data) ? pagesData.data.length : null,
        paging: pagesData.paging,
        userTokenLength: userAccessToken?.length ?? 0,
      });

      return NextResponse.redirect(`${origin}${returnTo}?fb_error=no_pages_granted`);
    }

    const pagesJson = JSON.stringify(pages);
    const encodedPages = Buffer.from(pagesJson).toString('base64');

    // Set cookie with pages data
    cookieStore.set('fb_pages', encodedPages, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/',
    });

    // Redirect back to the originating page with success
    return NextResponse.redirect(`${origin}${returnTo}?fb_success=true&page_count=${pages.length}`);

  } catch (err) {
    logger.error('Facebook OAuth error:', { error: err });
    return NextResponse.redirect(`${origin}${returnTo}?fb_error=exception`);
  }
}
