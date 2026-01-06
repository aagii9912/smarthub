import { NextRequest, NextResponse } from 'next/server';

// Facebook OAuth - Start
export async function GET(request: NextRequest) {
  const appId = process.env.FACEBOOK_APP_ID;
  
  if (!appId) {
    return NextResponse.json({ error: 'Facebook App ID not configured' }, { status: 500 });
  }
  
  // Get the current origin for redirect URI
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/facebook/callback`;
  
  // Required permissions for Messenger chatbot
  const permissions = [
    'pages_show_list',
    'pages_messaging',
    'pages_read_engagement',
    'pages_manage_metadata',
    'public_profile',
  ].join(',');
  
  // Build Facebook OAuth URL
  const fbAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  fbAuthUrl.searchParams.set('client_id', appId);
  fbAuthUrl.searchParams.set('redirect_uri', redirectUri);
  fbAuthUrl.searchParams.set('scope', permissions);
  fbAuthUrl.searchParams.set('response_type', 'code');
  fbAuthUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection
  
  return NextResponse.redirect(fbAuthUrl.toString());
}

