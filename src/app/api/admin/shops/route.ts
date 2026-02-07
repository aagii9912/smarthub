/**
 * Admin Shops API
 * List and manage all shops
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';
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
    } catch (error: any) {
        console.error('Get shops error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch shops' },
            { status: 500 }
        );
    }
}

// PATCH - Update shop (enable/disable, change plan, etc.)
export async function PATCH(request: NextRequest) {
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

        // When plan_id changes, sync subscription_plan with the plan's slug AND update subscriptions table
        if (plan_id) {
            updateData.plan_id = plan_id;

            // Fetch the plan slug to keep subscription_plan in sync
            const { data: plan } = await supabase
                .from('plans')
                .select('slug')
                .eq('id', plan_id)
                .single();

            if (plan?.slug) {
                updateData.subscription_plan = plan.slug;
                updateData.subscription_status = 'active'; // Activate subscription when plan is set
                console.log(`[Admin Shops] Syncing plan_id=${plan_id} with subscription_plan=${plan.slug}`);
            }

            // Also update/create subscription in subscriptions table for UI consistency
            // First check if subscription exists
            const { data: existingSubscription } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('shop_id', id)
                .maybeSingle();

            if (existingSubscription) {
                // Update existing subscription
                await supabase
                    .from('subscriptions')
                    .update({
                        plan_id: plan_id,
                        status: 'active',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingSubscription.id);
                console.log(`[Admin Shops] Updated subscription ${existingSubscription.id} with plan_id=${plan_id}`);
            } else {
                // Create new subscription
                const { data: newSub, error: subError } = await supabase
                    .from('subscriptions')
                    .insert({
                        shop_id: id,
                        plan_id: plan_id,
                        status: 'active',
                        billing_cycle: 'monthly',
                        current_period_start: new Date().toISOString(),
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
                    })
                    .select()
                    .single();

                if (subError) {
                    console.error('[Admin Shops] Failed to create subscription:', subError);
                } else {
                    console.log(`[Admin Shops] Created new subscription ${newSub.id} for shop ${id}`);
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
        if (body.subscription_status !== undefined) updateData.subscription_status = body.subscription_status;
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

        return NextResponse.json({ shop, message: 'Shop updated successfully' });
    } catch (error: any) {
        console.error('Update shop error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update shop' },
            { status: 500 }
        );
    }
}
