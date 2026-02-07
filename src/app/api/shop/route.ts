import { NextRequest, NextResponse } from 'next/server';
import { getClerkUser, supabaseAdmin } from '@/lib/auth/clerk-auth';
import { getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { checkShopLimit } from '@/lib/ai/config/plans';

// GET - Get user's shop
export async function GET() {
  try {
    const userId = await getClerkUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    const { data: shop, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({ shop });
  } catch (error: any) {
    console.error('Get shop error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create or update shop (upsert)
export async function POST(request: NextRequest) {
  try {
    const userId = await getClerkUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, owner_name, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Shop name required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Check if shop already exists
    const { data: existingShop } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingShop) {
      // Update existing shop instead of returning error
      const { data: updatedShop, error } = await supabase
        .from('shops')
        .update({ name, owner_name, phone })
        .eq('id', existingShop.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ shop: updatedShop });
    }

    // Check shop creation limit
    // Get count of all shops for this user
    const { count, error: countError } = await supabase
      .from('shops')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    // Get plan type from existing shops
    const { data: userShops } = await supabase
      .from('shops')
      .select('subscription_plan, subscription_status, trial_ends_at')
      .eq('user_id', userId);

    // Determine effective plan - find highest tier plan among existing shops
    let effectivePlan = 'trial';

    if (userShops && userShops.length > 0) {
      // Map all plans
      const plans = userShops.map(s => getPlanTypeFromSubscription({
        plan: s.subscription_plan,
        status: s.subscription_status,
        trial_ends_at: s.trial_ends_at
      }));

      // Pick best plan
      if (plans.includes('ultimate')) effectivePlan = 'ultimate';
      else if (plans.includes('pro')) effectivePlan = 'pro';
      else if (plans.includes('starter')) effectivePlan = 'starter';
      // else fallback to trial
    } else {
      // No shops yet = first shop is free (Trial logic typically allows 1 shop)
      effectivePlan = 'trial';
    }

    const limitCheck = checkShopLimit(effectivePlan as any, count || 0);

    // Allow creation if limit not reached
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: `Shop limit reached. Your ${effectivePlan} plan allows ${limitCheck.limit} shops. Please upgrade your existing shop to create more.`
      }, { status: 403 });
    }

    // Create new shop
    const { data: shop, error } = await supabase
      .from('shops')
      .insert({
        name,
        owner_name,
        phone,
        user_id: userId,
        is_active: true,
        setup_completed: false
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ shop });
  } catch (error: any) {
    console.error('Create shop error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update shop
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getClerkUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = supabaseAdmin();

    // Get user's shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Whitelist allowed fields to prevent mass assignment (SEC-5)
    const ALLOWED_FIELDS = [
      'name', 'owner_name', 'phone', 'description',
      'ai_instructions', 'ai_emotion', 'is_ai_active',
      'notify_on_order', 'notify_on_contact', 'notify_on_support', 'notify_on_cancel',
      'facebook_page_id', 'facebook_page_name', 'facebook_page_username',
      'facebook_page_access_token',
      'instagram_business_account_id', 'instagram_access_token', 'instagram_username',
    ] as const;

    const sanitizedUpdate: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        sanitizedUpdate[key] = body[key];
      }
    }

    if (Object.keys(sanitizedUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update shop with sanitized data
    const { data: updatedShop, error } = await supabase
      .from('shops')
      .update(sanitizedUpdate)
      .eq('id', shop.id)
      .select()
      .single();

    if (error) {
      console.error('Update shop DB error:', error);
      throw error;
    }

    return NextResponse.json({ shop: updatedShop });
  } catch (error: any) {
    console.error('Update shop error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
