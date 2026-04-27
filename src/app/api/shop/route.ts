import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { checkShopLimit } from '@/lib/ai/config/plans';
import { logger } from '@/lib/utils/logger';
import { registerShopAsMerchant } from '@/lib/payment/qpay-merchant';
import { getBillingSettings } from '@/lib/admin/settings';

// GET - Get user's shop
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopId = request.headers.get('x-shop-id');
    const supabase = supabaseAdmin();

    let query = supabase.from('shops').select('id, name, owner_name, phone, is_active, subscription_plan, setup_completed, created_at, facebook_page_id, facebook_page_name, instagram_business_account_id, instagram_username, description, bank_name, account_name, account_number, register_number, merchant_type, ai_emotion, ai_instructions, is_ai_active, custom_knowledge, policies, notify_on_order, notify_on_contact, notify_on_support, notify_on_cancel, qpay_status').eq('user_id', userId);
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

    // Pull admin-configured trial length so the new shop's trial respects the setting.
    // Falls back to DEFAULT_SETTINGS.billing.trial_days (3) on read failure.
    const billing = await getBillingSettings();
    const trialDays = Math.max(0, Math.floor(billing.trial_days));
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    // Create new shop
    const { data: shop, error } = await supabase
      .from('shops')
      .insert({
        name,
        owner_name,
        phone,
        user_id: userId,
        is_active: true,
        setup_completed: false,
        subscription_status: trialDays > 0 ? 'trial' : 'expired_trial',
        trial_ends_at: trialEndsAt.toISOString(),
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

    // Get user's shop (include QPay status for auto-registration)
    let query = supabase.from('shops').select('id, name, phone, qpay_merchant_id, qpay_status').eq('user_id', userId);
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
      'custom_knowledge', 'policies',
      'bank_name', 'account_name', 'account_number', 'register_number', 'merchant_type',
      'notify_on_order', 'notify_on_contact', 'notify_on_support', 'notify_on_cancel', 'notify_on_complaints',
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

    // ── Auto QPay Merchant Registration ──
    // When bank info is saved and shop has no QPay merchant yet, auto-register
    const bankInfoSaved = sanitizedUpdate.account_number && sanitizedUpdate.account_name && sanitizedUpdate.bank_name;
    const needsQPaySetup = !shop.qpay_merchant_id || shop.qpay_status !== 'active';

    if (bankInfoSaved && needsQPaySetup) {
      // Map bank_name to QPay bank code
      const bankCodeMap: Record<string, string> = {
        'хаан банк': '050000', 'khan bank': '050000',
        'голомт банк': '150000', 'golomt': '150000', 'golomt bank': '150000',
        'худалдаа хөгжлийн банк': '040000', 'tdb': '040000', 'хxб': '040000',
        'хас банк': '320000', 'xac bank': '320000',
        'капитрон банк': '300000', 'capitron': '300000',
        'төрийн банк': '340000', 'state bank': '340000',
        'богд банк': '380000', 'bogd bank': '380000',
        'м банк': '390000', 'm bank': '390000',
        'капитал банк': '020000', 'capital bank': '020000',
      };

      const bankName = (sanitizedUpdate.bank_name as string).toLowerCase().trim();
      const bankCode = bankCodeMap[bankName] || Object.entries(bankCodeMap).find(([key]) => bankName.includes(key))?.[1];

      if (bankCode) {
        try {
          logger.info('Auto-registering QPay merchant for shop:', { shopId: shop.id });

          // Get user email from Supabase auth
          let userEmail = '';
          try {
            const { data: { user } } = await supabase.auth.admin.getUserById(userId);
            userEmail = user?.email || '';
          } catch { /* non-critical */ }

          const merchant = await registerShopAsMerchant({
            shopName: (updatedShop as { name?: string } | null)?.name || shop.name || 'Shop',
            merchantType: (sanitizedUpdate.merchant_type as 'company' | 'person') || (body.merchant_type as 'company' | 'person') || 'person',
            registerNumber: (sanitizedUpdate.register_number as string) || (body.register_number as string) || undefined,
            bankCode,
            accountNumber: sanitizedUpdate.account_number as string,
            accountName: sanitizedUpdate.account_name as string,
            phone: (updatedShop as { phone?: string } | null)?.phone || shop.phone || '',
            email: userEmail || `${shop.id.substring(0, 8)}@syncly.mn`,
          });

          // Save QPay merchant info
          await supabase
            .from('shops')
            .update({
              qpay_merchant_id: merchant.id,
              qpay_bank_code: bankCode,
              qpay_account_number: sanitizedUpdate.account_number as string,
              qpay_account_name: sanitizedUpdate.account_name as string,
              qpay_status: 'active',
            })
            .eq('id', shop.id);

          logger.success('QPay merchant auto-registered:', { shopId: shop.id, merchantId: merchant.id });

          return NextResponse.json({
            shop: updatedShop,
            qpay_setup: { success: true, merchant_id: merchant.id, message: 'QPay автоматаар идэвхжлээ! ✅' },
          });
        } catch (qpayErr) {
          // QPay failed but bank info saved — non-blocking
          logger.warn('Auto QPay registration failed (non-blocking):', { error: String(qpayErr) });
          return NextResponse.json({
            shop: updatedShop,
            qpay_setup: { success: false, message: 'Банкны мэдээлэл хадгалагдлаа. QPay бүртгэл амжилтгүй — дараа дахин оролдоно уу.' },
          });
        }
      } else {
        logger.warn('Unknown bank name for QPay auto-setup:', { bankName: sanitizedUpdate.bank_name });
      }
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
