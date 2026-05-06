/**
 * Admin Shops API
 * List and manage all shops
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// GET - List all shops with subscription info
export async function GET(request: NextRequest) {
    try {
        const admin = await getAdminUser();

        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        logger.debug('[Admin Shops API]', { admin: admin.email });

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search');
        const status = searchParams.get('status'); // active, inactive

        const supabase = supabaseAdmin();

        let query = supabase
            .from('shops')
            .select(`
                id,
                name,
                owner_name,
                phone,
                facebook_page_id,
                facebook_page_name,
                is_active,
                setup_completed,
                created_at,
                user_id,
                plan_id,
                subscription_plan,
                subscription_status,
                trial_ends_at,
                ai_instructions,
                ai_emotion,
                plans:plan_id (
                    id,
                    name,
                    slug,
                    price_monthly
                ),
                subscriptions (
                    id,
                    status,
                    billing_cycle,
                    current_period_end,
                    plans (
                        id,
                        name,
                        price_monthly
                    )
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        // Search filter
        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        // Status filter
        if (status === 'active') {
            query = query.eq('is_active', true);
        } else if (status === 'inactive') {
            query = query.eq('is_active', false);
        } else if (status === 'trial') {
            query = query.eq('subscription_status', 'trial');
        } else if (status === 'expired_trial') {
            query = query.eq('subscription_status', 'expired_trial');
        }

        const { data: shops, count, error } = await query;

        if (error) throw error;

        return NextResponse.json({
            shops: shops || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                pages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error: unknown) {
        logger.error('Get shops error:', { error: error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch shops' },
            { status: 500 }
        );
    }
}

// UUID v4 format check (case-insensitive). Used to validate the legacy
// shops.user_id TEXT column before casting it to a UUID-typed column.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH - Update shop (enable/disable, change plan, etc.)
export async function PATCH(request: NextRequest) {
    // planSync диагностик — admin UI-д буцаах. Frontend-аас энэ
    // мэдээллийг toast/UI-аар харуулна.
    const planSync = {
        attempted: false,
        plan_slug: null as string | null,
        owner_user_id: null as string | null,
        owner_user_id_valid_uuid: false,
        subscription_upsert_by_user_id: 'skipped' as 'ok' | 'failed' | 'skipped',
        subscription_upsert_by_user_id_error: null as string | null,
        subscription_legacy_by_shop_id: 'skipped' as 'updated' | 'inserted' | 'failed' | 'skipped',
        subscription_legacy_error: null as string | null,
        user_profiles_snapshot: 'skipped' as 'ok' | 'failed' | 'skipped',
        user_profiles_error: null as string | null,
        all_user_shops_mirror: 'skipped' as 'ok' | 'failed' | 'skipped',
        all_user_shops_error: null as string | null,
    };

    try {
        const admin = await getAdminUser();

        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, is_active, plan_id } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Shop ID is required' },
                { status: 400 }
            );
        }

        const supabase = supabaseAdmin();

        const updateData: Record<string, any> = {};

        if (is_active !== undefined) {
            updateData.is_active = is_active;
        }

        // When plan_id changes, mirror the per-user plan model used by
        // the QPay payment webhook (see src/app/api/payment/webhook/route.ts).
        //
        // Sources of truth read by the user-facing pages:
        //   1. subscriptions row keyed by user_id (live source — getUserBilling)
        //   2. user_profiles snapshot (denormalized — feature gate / paywall)
        //   3. shops.plan_id / subscription_plan (legacy — middleware fallback)
        //
        // Without all three, /dashboard/subscription will keep showing the
        // user's old plan even after admin changes shops.plan_id.
        if (plan_id) {
            planSync.attempted = true;
            updateData.plan_id = plan_id;

            // Fetch the plan slug AND the shop's owner so we can sync the
            // per-user subscription record + user_profiles snapshot.
            const [planRes, shopOwnerRes] = await Promise.all([
                supabase.from('plans')
                    .select('id, slug, name')
                    .eq('id', plan_id)
                    .single(),
                supabase.from('shops')
                    .select('user_id')
                    .eq('id', id)
                    .single(),
            ]);

            const plan = planRes.data;
            if (!plan) {
                return NextResponse.json(
                    { error: `Plan id=${plan_id} not found in plans table` },
                    { status: 400 }
                );
            }
            const ownerUserIdRaw = shopOwnerRes.data?.user_id;
            // shops.user_id is TEXT (legacy Clerk). Validate as UUID before
            // casting to subscriptions.user_id (UUID NOT NULL) /
            // user_profiles.id (UUID).
            const ownerUserId =
                typeof ownerUserIdRaw === 'string' && UUID_RE.test(ownerUserIdRaw)
                    ? ownerUserIdRaw
                    : null;
            planSync.plan_slug = plan.slug;
            planSync.owner_user_id = ownerUserIdRaw ?? null;
            planSync.owner_user_id_valid_uuid = !!ownerUserId;

            updateData.subscription_plan = plan.slug;
            updateData.subscription_status = 'active';
            logger.info(`[Admin Shops] Syncing plan_id=${plan_id} (${plan.slug}) for shop=${id} owner=${ownerUserId ?? 'invalid/missing'}`);

            const nowIso = new Date().toISOString();
            const periodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            // ── 1. Sync subscription (per-user model) ──
            //
            // We can NOT use upsert(onConflict:'user_id') because the migration
            // 20260429110000_user_level_subscription.sql replaces UNIQUE(shop_id)
            // with a *partial* unique index:
            //   CREATE UNIQUE INDEX subscriptions_user_active_unique
            //       ON subscriptions (user_id)
            //       WHERE status IN ('active','trialing','pending','past_due');
            // PostgreSQL ON CONFLICT requires a regular unique constraint or
            // a non-partial unique index, so the upsert errors out with:
            //   "there is no unique or exclusion constraint matching the
            //    ON CONFLICT specification".
            //
            // Manual SELECT → UPDATE / INSERT pattern instead. We also can't
            // fall back to inserting with only shop_id because user_id is
            // NOT NULL on subscriptions post-migration.
            let subSyncOk = false;
            if (ownerUserId) {
                // Find any existing subscription for this user (any status —
                // partial-unique index allows multiple closed records but only
                // one open one; either way we update the most recent row).
                const { data: existing, error: selErr } = await supabase
                    .from('subscriptions')
                    .select('id, status')
                    .eq('user_id', ownerUserId)
                    .order('updated_at', { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                if (selErr) {
                    planSync.subscription_upsert_by_user_id = 'failed';
                    planSync.subscription_upsert_by_user_id_error = `select: ${selErr.message}`;
                } else if (existing) {
                    const { error: updErr } = await supabase
                        .from('subscriptions')
                        .update({
                            shop_id: id,
                            plan_id: plan_id,
                            status: 'active',
                            billing_cycle: 'monthly',
                            current_period_start: nowIso,
                            current_period_end: periodEndIso,
                            updated_at: nowIso,
                        })
                        .eq('id', existing.id);
                    if (updErr) {
                        planSync.subscription_upsert_by_user_id = 'failed';
                        planSync.subscription_upsert_by_user_id_error = `update: ${updErr.message}`;
                        logger.error('[Admin Shops] subscription update failed', { id: existing.id, error: updErr.message });
                    } else {
                        subSyncOk = true;
                        planSync.subscription_upsert_by_user_id = 'ok';
                        logger.info(`[Admin Shops] Updated subscription ${existing.id} for user_id=${ownerUserId} → plan_id=${plan_id}`);
                    }
                } else {
                    const { error: insErr } = await supabase
                        .from('subscriptions')
                        .insert({
                            user_id: ownerUserId,
                            shop_id: id,
                            plan_id: plan_id,
                            status: 'active',
                            billing_cycle: 'monthly',
                            current_period_start: nowIso,
                            current_period_end: periodEndIso,
                        });
                    if (insErr) {
                        planSync.subscription_upsert_by_user_id = 'failed';
                        planSync.subscription_upsert_by_user_id_error = `insert: ${insErr.message}`;
                        logger.error('[Admin Shops] subscription insert failed', { user_id: ownerUserId, error: insErr.message });
                    } else {
                        subSyncOk = true;
                        planSync.subscription_upsert_by_user_id = 'ok';
                        logger.info(`[Admin Shops] Inserted subscription for user_id=${ownerUserId} → plan_id=${plan_id}`);
                    }
                }
            }

            // ── 1b. Legacy fallback: orphan shops without a valid user_id ──
            // user_id is NOT NULL post-migration, so we can only update an
            // existing subscription if one is already linked to this shop.
            // We do NOT attempt to INSERT here (would violate NOT NULL).
            if (!subSyncOk) {
                const { data: existingByShop } = await supabase
                    .from('subscriptions')
                    .select('id')
                    .eq('shop_id', id)
                    .order('updated_at', { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                if (existingByShop) {
                    const { error: legacyUpdateErr } = await supabase
                        .from('subscriptions')
                        .update({
                            plan_id: plan_id,
                            status: 'active',
                            current_period_start: nowIso,
                            current_period_end: periodEndIso,
                            updated_at: nowIso,
                        })
                        .eq('id', existingByShop.id);
                    if (legacyUpdateErr) {
                        planSync.subscription_legacy_by_shop_id = 'failed';
                        planSync.subscription_legacy_error = legacyUpdateErr.message;
                        logger.error('[Admin Shops] (legacy) Update failed', { error: legacyUpdateErr.message });
                    } else {
                        planSync.subscription_legacy_by_shop_id = 'updated';
                        logger.info(`[Admin Shops] (legacy) Updated subscription ${existingByShop.id} via shop_id`);
                    }
                } else {
                    // Cannot insert without user_id (NOT NULL). Mark as
                    // skipped so admin sees the orphan shop diagnostic.
                    planSync.subscription_legacy_by_shop_id = 'skipped';
                    planSync.subscription_legacy_error = ownerUserId
                        ? null
                        : 'shop has no valid user_id (UUID); subscriptions.user_id NOT NULL prevents insert';
                }
            }

            // ── 2. Update user_profiles snapshot (read by getUserBilling fallback + middleware) ──
            if (ownerUserId) {
                const { error: profileUpdateError } = await supabase
                    .from('user_profiles')
                    .update({
                        plan_id: plan_id,
                        subscription_plan: plan.slug,
                        subscription_status: 'active',
                        updated_at: nowIso,
                    })
                    .eq('id', ownerUserId);

                if (profileUpdateError) {
                    planSync.user_profiles_snapshot = 'failed';
                    planSync.user_profiles_error = profileUpdateError.message;
                    logger.warn('[Admin Shops] user_profiles snapshot update failed (non-fatal)', {
                        user_id: ownerUserId,
                        error: profileUpdateError.message,
                    });
                } else {
                    planSync.user_profiles_snapshot = 'ok';
                }
            }

            // ── 3. Mirror plan to ALL of the user's shops (keeps legacy paths in sync) ──
            if (ownerUserId) {
                const { error: allShopsErr } = await supabase
                    .from('shops')
                    .update({
                        plan_id: plan_id,
                        subscription_plan: plan.slug,
                        subscription_status: 'active',
                    })
                    .eq('user_id', ownerUserId);
                if (allShopsErr) {
                    planSync.all_user_shops_mirror = 'failed';
                    planSync.all_user_shops_error = allShopsErr.message;
                    logger.warn('[Admin Shops] mirroring plan to all user shops failed (non-fatal)', {
                        user_id: ownerUserId,
                        error: allShopsErr.message,
                    });
                } else {
                    planSync.all_user_shops_mirror = 'ok';
                }
            }
        }

        // Shop Details
        if (body.name !== undefined) updateData.name = body.name;
        if (body.owner_name !== undefined) updateData.owner_name = body.owner_name;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.description !== undefined) updateData.description = body.description; // Shop description

        // Subscription Fields (only update subscription_plan if not already set by plan_id sync above)
        if (body.subscription_plan !== undefined && !updateData.subscription_plan) {
            updateData.subscription_plan = body.subscription_plan;
        }
        // subscription_status: when admin assigns a new plan, plan_id sync block above
        // sets it to 'active' — don't let the (possibly stale) form value override that.
        // When admin is NOT changing the plan, allow explicit status changes.
        if (body.subscription_status !== undefined && !plan_id) {
            updateData.subscription_status = body.subscription_status;
        }
        if (body.trial_ends_at !== undefined) updateData.trial_ends_at = body.trial_ends_at;

        // AI Settings
        if (body.ai_instructions !== undefined) updateData.ai_instructions = body.ai_instructions;
        if (body.ai_emotion !== undefined) updateData.ai_emotion = body.ai_emotion;

        const { data: shop, error } = await supabase
            .from('shops')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            shop,
            message: 'Shop updated successfully',
            plan_sync: planSync,
        });
    } catch (error: unknown) {
        logger.error('Update shop error:', { error: error });
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to update shop',
                plan_sync: planSync,
            },
            { status: 500 }
        );
    }
}
