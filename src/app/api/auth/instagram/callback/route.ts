import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

interface PageWithInstagram {
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
    };
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateParam = searchParams.get('state');
    const origin = request.nextUrl.origin;

    // Parse state to determine source, shop_id, and verify CSRF
    let source = 'setup';
    let shopId = '';
    let csrfTokenFromState = '';

    if (stateParam) {
        try {
            const stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString());
            source = stateData.source || 'setup';
            shopId = stateData.shopId || '';
            csrfTokenFromState = stateData.csrfToken || '';
        } catch { /* ignore parse errors */ }
    }

    const redirectBase = source === 'settings' ? '/dashboard/settings' : '/setup';

    const cookieStore = await cookies();

    // SEC: Verify CSRF state token
    const savedState = cookieStore.get('ig_oauth_state')?.value;
    if (!stateParam || !savedState || csrfTokenFromState !== savedState) {
        return NextResponse.redirect(`${origin}${redirectBase}?ig_error=csrf_validation_failed`);
    }
    // Clear the state cookie
    cookieStore.delete('ig_oauth_state');

    // Handle error from Facebook
    if (error) {
        const errorReason = searchParams.get('error_reason') || 'Unknown error';
        return NextResponse.redirect(`${origin}${redirectBase}?ig_error=${encodeURIComponent(errorReason)}`);
    }

    if (!code) {
        return NextResponse.redirect(`${origin}${redirectBase}?ig_error=no_code`);
    }

    const appId = process.env.FACEBOOK_APP_ID?.trim();
    const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();

    if (!appId || !appSecret || appSecret === 'your_facebook_app_secret') {
        return NextResponse.redirect(`${origin}${redirectBase}?ig_error=config_missing`);
    }

    const redirectUri = `${origin}/api/auth/instagram/callback`;

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
            logger.error('Instagram token error:', { error: tokenData.error.message });
            return NextResponse.redirect(`${origin}${redirectBase}?ig_error=token_error`);
        }

        const userAccessToken = tokenData.access_token;

        // Get user's Facebook Pages with Instagram Business Account info
        const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}`;
        const pagesResponse = await fetch(pagesUrl);
        const pagesData = await pagesResponse.json();

        if (pagesData.error) {
            logger.error('Instagram pages error:', { error: pagesData.error.message });
            return NextResponse.redirect(`${origin}${redirectBase}?ig_error=pages_error`);
        }

        logger.info('Instagram OAuth: found pages', { pageCount: (pagesData.data || []).length });

        // Filter pages that have Instagram Business Account connected
        const pagesWithInstagram: PageWithInstagram[] = (pagesData.data || [])
            .filter((page: PageWithInstagram) => page.instagram_business_account?.id)
            .slice(0, 10);

        logger.info('Pages with Instagram:', { count: pagesWithInstagram.length });

        if (pagesWithInstagram.length === 0) {
            const allPages = pagesData.data || [];
            logger.info('No Instagram accounts found', { totalPages: allPages.length });

            return NextResponse.redirect(`${origin}${redirectBase}?ig_error=no_instagram_account&pages=${allPages.length}`);
        }

        // If from settings — save directly to DB
        if (source === 'settings' && shopId) {
            const igAccount = pagesWithInstagram[0]; // Use first matched IG account
            const supabase = supabaseAdmin();

            const { error: dbError } = await supabase
                .from('shops')
                .update({
                    instagram_business_account_id: igAccount.instagram_business_account!.id,
                    instagram_account_id: igAccount.instagram_business_account!.id,
                    instagram_username: igAccount.instagram_business_account!.username || '',
                    instagram_access_token: igAccount.access_token,
                })
                .eq('id', shopId);

            if (dbError) {
                logger.error('Failed to save Instagram data:', { error: dbError.message });
                return NextResponse.redirect(`${origin}${redirectBase}?ig_error=db_save_failed`);
            }

            logger.success(`Instagram connected for shop ${shopId}`);
            return NextResponse.redirect(`${origin}/dashboard/settings?ig_success=true`);
        }

        // If from setup — store in cookie (existing behavior)
        const instagramAccounts = pagesWithInstagram.map((page) => ({
            pageId: page.id,
            pageName: page.name,
            pageAccessToken: page.access_token,
            instagramId: page.instagram_business_account!.id,
            instagramUsername: page.instagram_business_account!.username || '',
            instagramName: page.instagram_business_account!.name || page.name,
            profilePicture: page.instagram_business_account!.profile_picture_url || '',
        }));

        const accountsJson = JSON.stringify(instagramAccounts);
        const encodedAccounts = Buffer.from(accountsJson).toString('base64');

        cookieStore.set('ig_accounts', encodedAccounts, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400,
            path: '/',
        });

        return NextResponse.redirect(`${origin}/setup?ig_success=true&ig_count=${instagramAccounts.length}`);

    } catch (err) {
        logger.error('Instagram OAuth error:', { error: err instanceof Error ? err.message : 'Unknown' });
        return NextResponse.redirect(`${origin}${redirectBase}?ig_error=exception`);
    }
}
