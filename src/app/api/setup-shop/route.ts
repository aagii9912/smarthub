import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { checkShopLimit } from '@/lib/ai/config/plans';
import { verifyFacebookPageToken } from '@/lib/facebook/verifyChannelToken';
import { logger } from '@/lib/utils/logger';

function nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * POST /api/setup-shop — Facebook page-тэй шинэ дэлгүүр үүсгэнэ.
 * Body: { pageId, accessToken, name? }
 *
 * Page ID-г зөвхөн тухайн page-ийн жинхэнэ page token-той хамт хүлээж авна
 * (Graph API-аар шалгана). Үгүй бол хэн ч өөр дэлгүүрийн (эсвэл салгагдсан)
 * page ID-г өөртөө бүртгээд webhook-ийг нь өөр рүүгээ чиглүүлж чадна.
 * Token-ыг URL-д оруулахгүйн тулд GET биш POST.
 */
export async function POST(request: NextRequest) {
    // SEC-6: Require authentication
    const userId = await getAuthUser();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const pageId = nonEmptyString(body.pageId) ?? nonEmptyString(process.env.FACEBOOK_PAGE_ID);
    const accessToken = nonEmptyString(body.accessToken);

    if (!pageId) {
        return NextResponse.json({ error: 'Page ID шаардлагатай.' }, { status: 400 });
    }
    if (!accessToken) {
        return NextResponse.json({ error: 'Facebook page холбохын тулд page access token шаардлагатай.' }, { status: 400 });
    }

    const check = await verifyFacebookPageToken(pageId, accessToken);
    if (!check.ok) {
        logger.warn('setup-shop: rejected Facebook page claim, token verification failed', {
            userId, pageId, reason: check.reason, detail: check.detail,
        });
        return NextResponse.json(
            {
                error: check.reason === 'id_mismatch'
                    ? 'Token нь сонгосон Facebook page-д хамаарахгүй байна.'
                    : 'Facebook page-ийн token хүчингүй байна. Page-ээ дахин холбоно уу.',
            },
            { status: 400 }
        );
    }

    const supabase = supabaseAdmin();
    const shopName = nonEmptyString(body.name) ?? check.name ?? 'Аагий Shop';

    // Check if shop exists
    const { data: existingShop } = await supabase
        .from('shops')
        .select('id, name, created_at, user_id')
        .eq('facebook_page_id', pageId)
        .maybeSingle();

    if (existingShop) {
        // Өөр хэрэглэгчийн дэлгүүрийн мэдээллийг задруулахгүй.
        if (existingShop.user_id !== userId) {
            return NextResponse.json({ error: 'Энэ Facebook page өөр дэлгүүрт холбогдсон байна.' }, { status: 409 });
        }
        return NextResponse.json({
            message: 'Shop already exists',
            shop: { id: existingShop.id, name: existingShop.name, created_at: existingShop.created_at },
        });
    }

    // Enforce plan-based shop limit (same pattern as POST /api/shop)
    const { count, error: countError } = await supabase
        .from('shops')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (countError) {
        return NextResponse.json({ error: 'Shop limit check error: ' + countError.message }, { status: 500 });
    }

    // Determine effective plan — highest tier among the user's existing shops
    const { data: userShops } = await supabase
        .from('shops')
        .select('subscription_plan, subscription_status')
        .eq('user_id', userId);

    let effectivePlan: ReturnType<typeof getPlanTypeFromSubscription> = 'starter';

    if (userShops && userShops.length > 0) {
        const plans = userShops.map(s => getPlanTypeFromSubscription({
            plan: s.subscription_plan,
            status: s.subscription_status,
        }));

        if (plans.includes('enterprise')) effectivePlan = 'enterprise';
        else if (plans.includes('pro')) effectivePlan = 'pro';
        else effectivePlan = 'starter';
    }

    const limitCheck = checkShopLimit(effectivePlan, count || 0);

    if (!limitCheck.allowed) {
        return NextResponse.json({
            error: `Shop limit reached. Your ${effectivePlan} plan allows ${limitCheck.limit} shops. Please upgrade to create more.`
        }, { status: 403 });
    }

    // Create shop
    const { data: newShop, error } = await supabase
        .from('shops')
        .insert({
            name: shopName,
            facebook_page_id: pageId,
            facebook_page_name: check.name,
            facebook_page_access_token: accessToken,
            user_id: userId
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: 'Shop Create Error: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Shop created successfully', shop: newShop });
}
