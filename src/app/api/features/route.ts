/**
 * Features API
 *
 * Plan & limits live at the USER level — one plan covers all of the user's
 * shops. The optional x-shop-id header is still validated (so the response
 * can carry shop-scoped overrides like `enabled_features` and
 * `limit_overrides`), but plan/limits/quota always come from the user.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/utils/logger';
import { getUserBilling } from '@/lib/billing/getUserBilling';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const userId = await getAuthUser();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const headerList = await headers();
        const requestedShopId = headerList.get('x-shop-id');

        // Look up the user's plan via user_profiles snapshot first.
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('plan_id, subscription_plan, subscription_status, trial_ends_at')
            .eq('id', userId)
            .maybeSingle();

        // Look up shop overrides (and validate the shop belongs to the user).
        let shopOverrides: Record<string, unknown> = {};
        let limitOverrides: Record<string, unknown> = {};
        let validatedShopId: string | null = null;

        if (requestedShopId) {
            const { data: shop } = await supabase
                .from('shops')
                .select('id, enabled_features, limit_overrides')
                .eq('id', requestedShopId)
                .eq('user_id', userId)
                .maybeSingle();

            if (shop) {
                validatedShopId = shop.id as string;
                shopOverrides = (shop.enabled_features as Record<string, unknown>) || {};
                limitOverrides = (shop.limit_overrides as Record<string, unknown>) || {};
            }
        }

        // Resolve the plan row.
        interface PlanData {
            id?: string;
            slug: string;
            name?: string;
            features?: Record<string, unknown>;
            limits?: Record<string, unknown>;
        }

        let planData: PlanData | null = null;

        if (profile?.plan_id) {
            const { data } = await supabase
                .from('plans')
                .select('id, slug, name, features, limits')
                .eq('id', profile.plan_id)
                .maybeSingle();
            if (data) planData = data as PlanData;
        }

        if (!planData && profile?.subscription_plan) {
            const { data } = await supabase
                .from('plans')
                .select('id, slug, name, features, limits')
                .eq('slug', profile.subscription_plan)
                .maybeSingle();
            if (data) planData = data as PlanData;
        }

        // Last-resort: read the user's most recent active subscription's plan.
        if (!planData) {
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('plans (id, slug, name, features, limits)')
                .eq('user_id', userId)
                .in('status', ['active', 'trialing', 'pending', 'past_due'])
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            const joined = sub?.plans as PlanData | PlanData[] | null | undefined;
            const plan = Array.isArray(joined) ? joined[0] : joined;
            if (plan) planData = plan;
        }

        const billing = await getUserBilling(userId);

        if (!planData) {
            // No paid plan and no trial in flight: minimal feature set.
            return NextResponse.json({
                features: {
                    ai_enabled: false,
                    ai_model: 'gpt-4o-mini',
                    sales_intelligence: false,
                    ai_memory: false,
                    cart_system: 'none',
                    payment_integration: false,
                    crm_analytics: 'none',
                    auto_tagging: false,
                    appointment_booking: false,
                    bulk_marketing: false,
                    excel_export: false,
                    custom_branding: false,
                    comment_reply: false,
                    priority_support: false,
                },
                limits: {
                    max_messages: 0,
                    max_shops: 1,
                    max_products: 0,
                    max_customers: 0,
                },
                plan: { slug: 'unpaid', name: 'Төлбөргүй' },
                billing,
                requires_subscription: true,
                shopId: validatedShopId,
            });
        }

        const planFeatures = planData.features || {};
        const planLimits = planData.limits || {};

        const effectiveFeatures = { ...planFeatures, ...shopOverrides };
        const effectiveLimits = { ...planLimits, ...limitOverrides };

        const planSlug = planData.slug || profile?.subscription_plan || 'unpaid';
        const planName =
            planData.name ||
            (profile?.subscription_plan
                ? profile.subscription_plan.charAt(0).toUpperCase() + profile.subscription_plan.slice(1)
                : 'Төлбөргүй');

        logger.debug('[Features API] resolved plan', { userId, planSlug, validatedShopId });

        return NextResponse.json({
            features: effectiveFeatures,
            limits: effectiveLimits,
            plan: { slug: planSlug, name: planName },
            billing,
            shopId: validatedShopId,
        });
    } catch (error: unknown) {
        logger.error('Features API error:', { error });
        return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
        );
    }
}
