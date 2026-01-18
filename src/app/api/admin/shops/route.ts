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
        const { userId } = await auth();
        const admin = await getAdminUser();

        logger.debug('[Admin Shops API]', { userId, admin: admin?.email });

        // For now, allow if user is authenticated (will add strict admin check later)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized - Not logged in' }, { status: 401 });
        }

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
                plan_id
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
        const { id, is_active, plan_id, notes } = body;

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

        if (plan_id) {
            updateData.plan_id = plan_id;
        }

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
