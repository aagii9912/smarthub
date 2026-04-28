import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/dashboard/connect-instagram
 *
 * Two modes:
 *   1. Auto-detect (no body) — use the shop's existing Page Access Token to
 *      query Graph API for the linked IG Business Account.
 *   2. Picker mode (body: { picked_ig_account_id, picked_page_access_token,
 *      picked_ig_username }) — apply a user-chosen account from the
 *      multi-account picker page.
 *
 * In both modes the endpoint requires:
 *   • authenticated user
 *   • shopId from x-shop-id header that the user actually owns
 */
export async function POST(request: NextRequest) {
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

        // Validate ownership BEFORE doing anything else. supabaseAdmin uses the
        // service role and bypasses RLS, so we must enforce user_id manually.
        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('id, name, facebook_page_id, facebook_page_access_token, instagram_business_account_id')
            .eq('id', shopId)
            .eq('user_id', userId)
            .maybeSingle();

        if (shopError || !shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        // Try to read picker payload (body is optional).
        let pickedId: string | undefined;
        let pickedToken: string | undefined;
        let pickedUsername: string | undefined;
        try {
            const body = await request.json();
            pickedId = body?.picked_ig_account_id;
            pickedToken = body?.picked_page_access_token;
            pickedUsername = body?.picked_ig_username;
        } catch {
            // No body = auto-detect mode.
        }

        let igAccountId = pickedId;
        let igUsername = pickedUsername || '';
        let pageAccessToken = pickedToken || shop.facebook_page_access_token;

        if (!igAccountId) {
            // Auto-detect from the shop's existing FB page.
            if (!shop.facebook_page_id || !shop.facebook_page_access_token) {
                return NextResponse.json(
                    { error: 'Facebook Page not connected. Connect Facebook first.' },
                    { status: 400 }
                );
            }

            const igUrl = `https://graph.facebook.com/v21.0/${shop.facebook_page_id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${shop.facebook_page_access_token}`;
            const igResponse = await fetch(igUrl);
            const igData = await igResponse.json();

            if (igData.error) {
                logger.error('Failed to fetch IG account from Page', { error: igData.error });
                return NextResponse.json({ error: `Facebook API: ${igData.error.message}` }, { status: 400 });
            }

            if (!igData.instagram_business_account?.id) {
                return NextResponse.json(
                    {
                        error:
                            'Instagram Business Account олдсонгүй. Facebook Page → Settings → Linked Accounts дээр Instagram холбосон эсэхийг шалгана уу.',
                        debug: { pageId: shop.facebook_page_id },
                    },
                    { status: 404 }
                );
            }

            igAccountId = igData.instagram_business_account.id;
            igUsername = igData.instagram_business_account.username || '';
        }

        // Sanity: refuse to connect an IG account already in use by another
        // shop owned by THIS user. Cross-user collisions are blocked by the
        // partial UNIQUE index from migration 20260429100000.
        const { data: collidingShop } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', userId)
            .eq('instagram_business_account_id', igAccountId!)
            .neq('id', shopId)
            .maybeSingle();

        if (collidingShop) {
            return NextResponse.json(
                { error: 'Энэ Instagram бүртгэл өөр дэлгүүрт холбогдсон байна.' },
                { status: 409 }
            );
        }

        const { error: updateError } = await supabase
            .from('shops')
            .update({
                instagram_business_account_id: igAccountId,
                instagram_username: igUsername,
                instagram_access_token: pageAccessToken,
            })
            .eq('id', shopId)
            .eq('user_id', userId);

        if (updateError) {
            logger.error('Failed to save Instagram data', { error: updateError.message });
            return NextResponse.json(
                { error: `DB хадгалахад алдаа: ${updateError.message}` },
                { status: 500 }
            );
        }

        logger.success(`✅ Instagram connected: @${igUsername || igAccountId} for shop ${shop.name}`);

        return NextResponse.json({
            success: true,
            instagram: {
                id: igAccountId,
                username: igUsername,
            },
        });
    } catch (err) {
        logger.error('Connect Instagram error', { error: err });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
