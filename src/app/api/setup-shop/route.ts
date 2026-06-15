import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { checkShopLimit } from '@/lib/ai/config/plans';

export async function GET(request: NextRequest) {
    // SEC-6: Require authentication
    const userId = await getAuthUser();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const envPageId = process.env.FACEBOOK_PAGE_ID;
    const pageId = searchParams.get('pageId') || envPageId;
    const shopName = searchParams.get('name') || 'Аагий Shop';

    if (!pageId) {
        return NextResponse.json({ error: 'Page ID not provided and not in env' });
    }

    // Check if shop exists
    const { data: existingShop } = await supabase
        .from('shops')
        .select('id, name, created_at')
        .eq('facebook_page_id', pageId)
        .single();

    if (existingShop) {
        return NextResponse.json({ message: 'Shop already exists', shop: existingShop });
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
            user_id: userId
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: 'Shop Create Error: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Shop created successfully', shop: newShop });
}
