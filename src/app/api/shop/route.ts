import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { getPlanTypeFromSubscription } from '@/lib/ai/AIRouter';
import { checkShopLimit } from '@/lib/ai/config/plans';
import { logger } from '@/lib/utils/logger';
import { resolvePersonName } from '@/lib/payment/qpay-merchant';
import { ensureShopMerchant, QPayMerchantError } from '@/lib/payment/qpay-merchant-service';
import { qpayMerchantInputSchema, bankCodeFromName } from '@/lib/validations/qpay';

// GET - Get user's shop
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopId = request.headers.get('x-shop-id');
    const supabase = supabaseAdmin();

    let query = supabase.from('shops').select('id, name, owner_name, phone, is_active, subscription_plan, setup_completed, created_at, facebook_page_id, facebook_page_name, instagram_business_account_id, instagram_username, description, bank_name, account_name, account_number, register_number, merchant_type, owner_last_name, owner_first_name, qpay_merchant_type, qpay_last_error, ai_emotion, ai_instructions, is_ai_active, custom_knowledge, policies, notify_on_order, notify_on_contact, notify_on_support, notify_on_cancel, qpay_status, business_type, business_setup_data, ai_agent_role, ai_agent_capabilities, ai_agent_config, ai_agent_name, ai_setup_completed_at, accepted_payment_methods, delivery_policy').eq('user_id', userId);
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
    const { name, owner_name, phone, forceCreate, business_type } = body;
    const ALLOWED_BUSINESS_TYPES = [
      'retail', 'restaurant', 'service', 'ecommerce', 'beauty', 'other',
      'healthcare', 'education', 'realestate_auto',
    ];
    const sanitizedBusinessType = business_type && ALLOWED_BUSINESS_TYPES.includes(business_type) ? business_type : undefined;

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
        const updatePayload: Record<string, unknown> = { name, owner_name, phone };
        if (sanitizedBusinessType) updatePayload.business_type = sanitizedBusinessType;

        const { data: updatedShop, error } = await supabase
          .from('shops')
          .update(updatePayload)
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

    // Per-user plan model: a new shop adopts the user's existing plan + status.
    // First-time users land on 'unpaid' until they explicitly start a trial
    // or pay for a plan from the setup wizard's plan-selection step.
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_id, subscription_plan, subscription_status, trial_ends_at')
      .eq('id', userId)
      .maybeSingle();

    const userHasPlan =
      !!profile?.subscription_status &&
      !['unpaid', 'expired_trial'].includes(profile.subscription_status);

    const newShopRow: Record<string, unknown> = {
      name,
      owner_name,
      phone,
      user_id: userId,
      is_active: true,
      setup_completed: false,
      ...(sanitizedBusinessType ? { business_type: sanitizedBusinessType } : {}),
    };

    if (userHasPlan) {
      newShopRow.plan_id = profile?.plan_id ?? null;
      newShopRow.subscription_plan = profile?.subscription_plan ?? 'starter';
      // user_profiles uses 'trialing'; shops uses the legacy 'trial' enum
      // so the daily trial-expiry cron can find the row.
      newShopRow.subscription_status =
        profile?.subscription_status === 'trialing' ? 'trial' : (profile?.subscription_status ?? 'unpaid');
      newShopRow.trial_ends_at = profile?.trial_ends_at ?? null;
    } else {
      newShopRow.subscription_plan = null;
      newShopRow.subscription_status = 'unpaid';
      newShopRow.trial_ends_at = null;
    }

    const { data: shop, error } = await supabase
      .from('shops')
      .insert(newShopRow)
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
    // RBAC: дэлгүүрийн тохиргоо засах эрх (owner / admin). Staff хориглоно.
    const { shop: accessShop } = await requirePermission('settings:write');

    const body = await request.json();
    const supabase = supabaseAdmin();

    // Get the resolved shop (include QPay status + register_number for auto-registration)
    const { data: shop } = await supabase
      .from('shops')
      .select('id, name, phone, register_number, merchant_type, owner_last_name, owner_first_name, qpay_merchant_id, qpay_status, user_id')
      .eq('id', accessShop.id)
      .maybeSingle();

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Whitelist allowed fields to prevent mass assignment (SEC-5)
    const ALLOWED_FIELDS = [
      'name', 'owner_name', 'phone', 'description', 'address', 'business_hours',
      'ai_instructions', 'ai_emotion', 'is_ai_active',
      'custom_knowledge', 'policies',
      // AI info-sharing toggles (#5b/#5c)
      'ai_share_phone', 'ai_share_address', 'ai_share_hours',
      'ai_share_policies', 'ai_share_description',
      'bank_name', 'account_name', 'account_number', 'register_number', 'merchant_type',
      'owner_last_name', 'owner_first_name',
      'notify_on_order', 'notify_on_contact', 'notify_on_support', 'notify_on_cancel', 'notify_on_complaints',
      'notify_on_payment_received', 'notify_on_payment_failed', 'notify_on_refund',
      'notify_on_new_customer', 'notify_on_subscription', 'notify_on_automation',
      'notify_on_plan_limit', 'notify_on_low_stock', 'notify_on_import',
      'facebook_page_id', 'facebook_page_name', 'facebook_page_username',
      'facebook_page_access_token',
      'instagram_business_account_id', 'instagram_access_token', 'instagram_username',
      // Business taxonomy (setup wizard)
      'business_type', 'business_setup_data',
      // AI agent role / capabilities (multi-agent support)
      'ai_agent_role', 'ai_agent_capabilities', 'ai_agent_config',
      'ai_agent_name', 'ai_setup_completed_at',
      // Accepted payment methods toggle (shop-level)
      'accepted_payment_methods',
      // Delivery policy (shop-level): free threshold, UB / province fees
      'delivery_policy',
    ] as const;

    const ALLOWED_BUSINESS_TYPES = [
      'retail', 'restaurant', 'service', 'ecommerce', 'beauty', 'other',
      'healthcare', 'education', 'realestate_auto',
    ];
    const ALLOWED_AGENT_ROLES = [
      'sales', 'booking', 'information', 'support', 'lead_capture', 'hybrid',
    ];
    const ALLOWED_AGENT_CAPABILITIES = [
      'sales', 'booking', 'information', 'support', 'lead_capture',
    ];

    const sanitizedUpdate: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        sanitizedUpdate[key] = body[key];
      }
    }

    // Reject business_type values that don't match the CHECK constraint to fail fast (better error)
    if (sanitizedUpdate.business_type !== undefined && sanitizedUpdate.business_type !== null) {
      if (!ALLOWED_BUSINESS_TYPES.includes(String(sanitizedUpdate.business_type))) {
        return NextResponse.json({ error: 'Invalid business_type' }, { status: 400 });
      }
    }
    // business_setup_data must be a plain object (JSONB)
    if (sanitizedUpdate.business_setup_data !== undefined) {
      const v = sanitizedUpdate.business_setup_data;
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        return NextResponse.json({ error: 'business_setup_data must be an object' }, { status: 400 });
      }
    }
    // ai_agent_role
    if (sanitizedUpdate.ai_agent_role !== undefined && sanitizedUpdate.ai_agent_role !== null) {
      if (!ALLOWED_AGENT_ROLES.includes(String(sanitizedUpdate.ai_agent_role))) {
        return NextResponse.json({ error: 'Invalid ai_agent_role' }, { status: 400 });
      }
    }
    // ai_agent_capabilities — array of capability strings
    if (sanitizedUpdate.ai_agent_capabilities !== undefined) {
      const caps = sanitizedUpdate.ai_agent_capabilities;
      if (!Array.isArray(caps) || caps.some((c) => !ALLOWED_AGENT_CAPABILITIES.includes(String(c)))) {
        return NextResponse.json({ error: 'Invalid ai_agent_capabilities' }, { status: 400 });
      }
    }
    // ai_agent_config — must be a plain object
    if (sanitizedUpdate.ai_agent_config !== undefined) {
      const v = sanitizedUpdate.ai_agent_config;
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        return NextResponse.json({ error: 'ai_agent_config must be an object' }, { status: 400 });
      }
    }
    // ai_agent_name — string or null
    if (sanitizedUpdate.ai_agent_name !== undefined && sanitizedUpdate.ai_agent_name !== null) {
      if (typeof sanitizedUpdate.ai_agent_name !== 'string' || sanitizedUpdate.ai_agent_name.length > 100) {
        return NextResponse.json({ error: 'ai_agent_name must be a string up to 100 chars' }, { status: 400 });
      }
    }
    // accepted_payment_methods — must be a plain object with boolean values
    // for known method keys. At least one method must remain enabled.
    if (sanitizedUpdate.accepted_payment_methods !== undefined) {
      const v = sanitizedUpdate.accepted_payment_methods;
      const ALLOWED_METHODS = ['cod', 'qpay', 'bank_transfer'];
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        return NextResponse.json({ error: 'accepted_payment_methods must be an object' }, { status: 400 });
      }
      const obj = v as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (!ALLOWED_METHODS.includes(key)) {
          return NextResponse.json({ error: `Unknown payment method: ${key}` }, { status: 400 });
        }
        if (typeof obj[key] !== 'boolean') {
          return NextResponse.json({ error: `Payment method ${key} must be boolean` }, { status: 400 });
        }
      }
      const anyEnabled = ALLOWED_METHODS.some((m) => obj[m] === true);
      if (!anyEnabled) {
        return NextResponse.json({ error: 'Хамгийн багадаа нэг төлбөрийн хэлбэр идэвхтэй байх ёстой' }, { status: 400 });
      }
    }
    // delivery_policy — must be a plain object with the expected numeric /
    // string fields. Negative fees / thresholds are nonsensical.
    if (sanitizedUpdate.delivery_policy !== undefined) {
      const v = sanitizedUpdate.delivery_policy;
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        return NextResponse.json({ error: 'delivery_policy must be an object' }, { status: 400 });
      }
      const obj = v as Record<string, unknown>;
      const numericKeys = ['free_delivery_threshold', 'ub_delivery_fee', 'province_delivery_fee'];
      for (const key of numericKeys) {
        if (obj[key] !== undefined && obj[key] !== null) {
          const n = Number(obj[key]);
          if (!Number.isFinite(n) || n < 0) {
            return NextResponse.json({ error: `delivery_policy.${key} must be a non-negative number or null` }, { status: 400 });
          }
          obj[key] = n;
        }
      }
      for (const noteKey of ['province_delivery_note', 'delivery_schedule_note']) {
        if (obj[noteKey] !== undefined && obj[noteKey] !== null) {
          if (typeof obj[noteKey] !== 'string' || (obj[noteKey] as string).length > 500) {
            return NextResponse.json({ error: `delivery_policy.${noteKey} must be a string up to 500 chars` }, { status: 400 });
          }
        }
      }
    }

    if (Object.keys(sanitizedUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Clear unique fields from ANY shop that already holds this FB page / IG account.
    // A Facebook page or Instagram account can only be connected to one shop at a time
    // across all users, so we must release it globally before claiming it here.
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
    // Банкны мэдээлэл хадгалагдаж, merchant хараахан active биш бол
    // ensureShopMerchant-аар бүртгэнэ (validation + pending/timeout + reuse нэг газар).
    const bankInfoSaved = sanitizedUpdate.account_number && sanitizedUpdate.account_name && sanitizedUpdate.bank_name;
    const needsQPaySetup = !shop.qpay_merchant_id || shop.qpay_status !== 'active';

    if (bankInfoSaved && needsQPaySetup) {
      const qpaySetup = await autoRegisterQPayMerchant({
        shop: shop as unknown as AutoRegisterShop,
        updatedShop: updatedShop as { name?: string | null; phone?: string | null } | null,
        sanitizedUpdate,
        body: body as Record<string, unknown>,
        supabase,
      });
      if (qpaySetup) {
        return NextResponse.json({ shop: updatedShop, qpay_setup: qpaySetup });
      }
    }

    return NextResponse.json({ shop: updatedShop });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

    // NOTE: QPay merchant intentionally NOT removed.
    // Merchants are scoped by register_number on QPay's side (not by shop), so:
    //   - If the user creates a new shop with the same register_number, the
    //     PATCH/auto-register flow looks up and reuses the existing merchant.
    //   - Historical invoices/transactions on QPay are indexed by merchant_id;
    //     deleting it would orphan that history.
    // For full GDPR-style erasure, call removeMerchant() from an admin tool.

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

// ──────────────────────────────────────────────
// Auto QPay merchant registration (PATCH /api/shop)
// ──────────────────────────────────────────────

interface AutoRegisterShop {
  id: string;
  name: string | null;
  phone: string | null;
  register_number: string | null;
  merchant_type: string | null;
  owner_last_name: string | null;
  owner_first_name: string | null;
  user_id: string;
}

interface QPaySetupResult {
  success: boolean;
  merchant_id?: string;
  message: string;
  fields?: Record<string, string>;
}

/**
 * Банкны мэдээлэл хадгалахад дагалдан QPay merchant үүсгэнэ.
 * Танихгүй банкны нэр бол null буцааж хуучин шигээ чимээгүй өнгөрнө.
 * Бусад тохиолдолд success/fail + хэрэглэгчид харуулах мессеж буцаана.
 */
async function autoRegisterQPayMerchant(args: {
  shop: AutoRegisterShop;
  updatedShop: { name?: string | null; phone?: string | null } | null;
  sanitizedUpdate: Record<string, unknown>;
  body: Record<string, unknown>;
  supabase: ReturnType<typeof supabaseAdmin>;
}): Promise<QPaySetupResult | null> {
  const { shop, updatedShop, sanitizedUpdate, body, supabase } = args;

  const bankCode = bankCodeFromName(sanitizedUpdate.bank_name as string);
  if (!bankCode) {
    logger.warn('Unknown bank name for QPay auto-setup:', { bankName: sanitizedUpdate.bank_name });
    return null;
  }

  const registerNumber =
    (sanitizedUpdate.register_number as string) ||
    (body.register_number as string) ||
    shop.register_number ||
    '';
  if (!registerNumber) {
    logger.warn('Auto QPay registration skipped: register_number missing', { shopId: shop.id });
    return { success: false, message: 'Регистрийн дугаар заавал шаардлагатай. Settings-ээс оруулна уу.' };
  }

  const requestedType =
    (sanitizedUpdate.merchant_type as string | undefined) ||
    (body.merchant_type as string | undefined) ||
    shop.merchant_type;
  const merchantType: 'person' | 'company' = requestedType === 'company' ? 'company' : 'person';

  // Имэйл — auth хэрэглэгчээс (QPay-н мэдэгдэл энд очно)
  let userEmail: string | undefined;
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(shop.user_id);
    userEmail = user?.email || undefined;
  } catch { /* non-critical */ }

  const accountName = String(sanitizedUpdate.account_name || '');
  const candidate: Record<string, unknown> = {
    merchant_type: merchantType,
    register_number: registerNumber,
    bank_code: bankCode,
    account_number: sanitizedUpdate.account_number,
    account_name: accountName,
    phone: updatedShop?.phone || shop.phone || '',
    email: userEmail,
  };
  if (merchantType === 'person') {
    const resolved = resolvePersonName({
      lastName: (sanitizedUpdate.owner_last_name as string) || shop.owner_last_name || undefined,
      firstName: (sanitizedUpdate.owner_first_name as string) || shop.owner_first_name || undefined,
      accountName,
    });
    candidate.last_name = resolved.lastName;
    candidate.first_name = resolved.firstName;
  } else {
    candidate.company_name = updatedShop?.name || shop.name || accountName;
  }

  const parsed = qpayMerchantInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]));
    const first = parsed.error.issues[0];
    logger.warn('Auto QPay registration skipped: invalid input', { shopId: shop.id, fields });
    return {
      success: false,
      message: first ? `${first.message}` : 'Мэдээлэл дутуу байна.',
      fields,
    };
  }

  try {
    logger.info('Auto-registering QPay merchant for shop:', { shopId: shop.id, type: merchantType });
    const result = await ensureShopMerchant(shop.id, parsed.data, { email: userEmail });
    return { success: true, merchant_id: result.merchantId, message: result.message };
  } catch (err) {
    if (err instanceof QPayMerchantError) {
      if (err.code === 'ALREADY_ACTIVE') {
        return { success: true, merchant_id: err.merchantId ?? undefined, message: 'QPay аль хэдийн идэвхтэй байна. ✅' };
      }
      logger.warn('Auto QPay registration failed (non-blocking):', { shopId: shop.id, code: err.code, detail: err.detail });
      return { success: false, message: err.userMessage };
    }
    logger.warn('Auto QPay registration failed (non-blocking):', { shopId: shop.id, error: String(err) });
    return { success: false, message: 'QPay бүртгэл амжилтгүй боллоо. Дахин оролдоно уу.' };
  }
}
