import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { checkShopLimit } from '@/lib/ai/config/plans';
import { logger } from '@/lib/utils/logger';

// GET - Get user's shop
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopId = request.headers.get('x-shop-id');
    const supabase = supabaseAdmin();

    let query = supabase.from('shops').select('id, name, owner_name, phone, is_active, subscription_plan, setup_completed, created_at, facebook_page_id, facebook_page_name, instagram_business_account_id, instagram_username, description, bank_name, account_name, account_number, ai_emotion, ai_instructions, is_ai_active').eq('user_id', userId);
    if (shopId) {
      query = query.eq('id', shopId);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data: shop, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ shop });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
    logger.error('Get shop error:', { error: errMsg });
    return NextResponse.json({ error: errMsg || 'Unknown error' }, { status: 500 });
  }
}

// POST - Create or update shop (upsert)
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, owner_name, phone, forceCreate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Shop name required' }, { status: 400 });
    }

    const shopId = request.headers.get('x-shop-id');
    const supabase = supabaseAdmin();

    // Check if shop already exists
    if (!forceCreate) {
      let query = supabase.from('shops').select('id, name, owner_name, phone').eq('user_id', userId);
      if (shopId) {
        query = query.eq('id', shopId);
      } else {
        query = query.order('created_at', { ascending: false }).limit(1);
      }

      const { data: existingShop } = await query.maybeSingle();

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
    }

    // Check shop creation limit
    // Get count of all shops for this user
    const { count, error: countError } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    // Get plan type from existing shops
    const { data: userShops } = await supabase
      .from('shops')
      .select('subscription_plan, subscription_status')
      .eq('user_id', userId);

    // Determine effective plan - find highest tier plan among existing shops
    let effectivePlan: ReturnType<typeof getPlanTypeFromSubscription> = 'starter';

    if (userShops && userShops.length > 0) {
      // Map all plans
      const plans = userShops.map(s => getPlanTypeFromSubscription({
        plan: s.subscription_plan,
        status: s.subscription_status,
      }));

      // Pick best plan
      if (plans.includes('enterprise')) effectivePlan = 'enterprise';
      else if (plans.includes('pro')) effectivePlan = 'pro';
      else effectivePlan = 'starter';
    }

    const limitCheck = checkShopLimit(effectivePlan, count || 0);

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
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
    logger.error('Create shop error:', { error: errMsg });
    return NextResponse.json({ error: errMsg || 'Unknown error' }, { status: 500 });
  }
}

// PATCH - Update shop
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const shopId = request.headers.get('x-shop-id');
    const supabase = supabaseAdmin();

    // Get user's shop
    let query = supabase.from('shops').select('id').eq('user_id', userId);
    if (shopId) {
      query = query.eq('id', shopId);
    } else {
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data: shop } = await query.maybeSingle();

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Whitelist allowed fields to prevent mass assignment (SEC-5)
    const ALLOWED_FIELDS = [
      'name', 'owner_name', 'phone', 'description',
      'ai_instructions', 'ai_emotion', 'is_ai_active',
      'bank_name', 'account_name', 'account_number',
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

    // Clear unique fields from other shops to prevent constraint violations
    if (sanitizedUpdate.facebook_page_id) {
      await supabase
        .from('shops')
        .update({ facebook_page_id: null, facebook_page_name: null, facebook_page_access_token: null })
        .eq('facebook_page_id', sanitizedUpdate.facebook_page_id as string)
        .neq('id', shop.id);
    }
    if (sanitizedUpdate.instagram_business_account_id) {
      await supabase
        .from('shops')
        .update({ instagram_business_account_id: null, instagram_access_token: null, instagram_username: null })
        .eq('instagram_business_account_id', sanitizedUpdate.instagram_business_account_id as string)
        .neq('id', shop.id);
    }

    // Update shop with sanitized data
    const { data: updatedShop, error } = await supabase
      .from('shops')
      .update(sanitizedUpdate)
      .eq('id', shop.id)
      .select()
      .single();

    if (error) {
      const dbErrMsg = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : JSON.stringify(error);
      logger.error('Update shop DB error:', { error: dbErrMsg, code: (error as { code?: string }).code, details: (error as { details?: string }).details });
      return NextResponse.json({ error: dbErrMsg || 'DB update failed' }, { status: 500 });
    }

    return NextResponse.json({ shop: updatedShop });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error));
    logger.error('Update shop error:', { error: errMsg });
    return NextResponse.json({ error: errMsg || 'Unknown error' }, { status: 500 });
  }
}

// DELETE - Delete shop and all related data
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopId = request.headers.get('x-shop-id');
    const supabase = supabaseAdmin();

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('id', shopId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found or unauthorized' }, { status: 404 });
    }

    // Delete related data that may not have CASCADE
    const tablesToClean = [
      'comment_automations',
      'ai_conversations',
      'ai_question_stats',
      'ai_analytics',
      'shop_faqs',
      'shop_quick_replies',
      'shop_slogans',
      'pending_messages',
      'customer_complaints',
      'feedback',
      'email_logs',
      'push_subscriptions',
      'carts',
      'payments',
      'usage_logs',
      'usage_summary',
      'invoices',
      'subscriptions',
    ];

    for (const table of tablesToClean) {
      await supabase.from(table).delete().eq('shop_id', shopId);
    }

    // Delete the shop (CASCADE handles: products, product_variants, customers, orders, order_items, chat_history)
    const { error } = await supabase
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (error) {
      logger.error('Delete shop DB error:', { error: error.message });
      throw error;
    }

    logger.info('Shop deleted successfully', { shopId, userId });
    return NextResponse.json({ success: true, message: 'Shop deleted successfully' });
  } catch (error: unknown) {
    logger.error('Delete shop error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
