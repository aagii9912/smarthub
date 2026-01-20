/**
 * Features API - Get current shop's enabled features and limits
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get shop for current user
        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select(`
                id,
                plan_id,
                enabled_features,
                limit_overrides,
                plans!inner (
                    id,
                    slug,
                    name,
                    features,
                    limits
                )
            `)
            .eq('clerk_user_id', userId)
            .single();

        if (shopError || !shop) {
            // Return default free features if no shop found
            return NextResponse.json({
                features: {
                    ai_enabled: true,
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
                    priority_support: false
                },
                limits: {
                    max_messages: 50,
                    max_shops: 1,
                    max_products: 10,
                    max_customers: 50
                },
                plan: {
                    slug: 'free',
                    name: 'Free'
                }
            });
        }

        // Merge plan features with shop overrides (shop overrides take precedence)
        const planData = shop.plans as any;
        const planFeatures = planData?.features || {};
        const planLimits = planData?.limits || {};
        const shopOverrides = shop.enabled_features || {};
        const limitOverrides = shop.limit_overrides || {};

        const effectiveFeatures = { ...planFeatures, ...shopOverrides };
        const effectiveLimits = { ...planLimits, ...limitOverrides };

        return NextResponse.json({
            features: effectiveFeatures,
            limits: effectiveLimits,
            plan: {
                slug: planData?.slug || 'free',
                name: planData?.name || 'Free'
            },
            shopId: shop.id
        });

    } catch (error) {
        console.error('Features API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
        );
    }
}
