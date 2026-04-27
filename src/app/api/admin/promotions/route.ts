/**
 * Admin Promotions API
 * Manage the single-row "1 жил төлж 2 жил" bonus_year campaign.
 *
 * GET   — list all promotions + redemption counts
 * PATCH — update promotion (toggle is_active, change window, edit eligible plans)
 *
 * POST/DELETE intentionally omitted in v1: the bonus_year row is seeded by
 * migration and there is exactly one active campaign at a time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

interface PromotionRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    type: string;
    bonus_months: number;
    eligible_billing_cycles: string[];
    eligible_plan_slugs: string[];
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    updated_at: string;
}

export async function GET() {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        const { data: promotions, error } = await supabase
            .from('promotions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const promoIds = (promotions || []).map((p: PromotionRow) => p.id);
        const counts: Record<string, { total: number; last30: number }> = {};

        if (promoIds.length > 0) {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const [{ data: totalRows }, { data: recentRows }] = await Promise.all([
                supabase
                    .from('promotion_redemptions')
                    .select('promotion_id')
                    .in('promotion_id', promoIds),
                supabase
                    .from('promotion_redemptions')
                    .select('promotion_id')
                    .in('promotion_id', promoIds)
                    .gte('redeemed_at', thirtyDaysAgo),
            ]);

            for (const id of promoIds) {
                counts[id] = { total: 0, last30: 0 };
            }
            for (const r of totalRows || []) {
                if (r.promotion_id && counts[r.promotion_id]) counts[r.promotion_id].total += 1;
            }
            for (const r of recentRows || []) {
                if (r.promotion_id && counts[r.promotion_id]) counts[r.promotion_id].last30 += 1;
            }
        }

        return NextResponse.json({
            promotions: (promotions || []).map((p: PromotionRow) => ({
                ...p,
                redemption_count: counts[p.id]?.total ?? 0,
                redemption_count_last30: counts[p.id]?.last30 ?? 0,
            })),
        });
    } catch (error: unknown) {
        logger.error('Get promotions error:', { error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch promotions' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (admin.role !== 'super_admin' && admin.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const {
            id,
            name,
            description,
            bonus_months,
            eligible_billing_cycles,
            eligible_plan_slugs,
            is_active,
            starts_at,
            ends_at,
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Promotion ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (bonus_months !== undefined) {
            const n = Number(bonus_months);
            if (!Number.isFinite(n) || n <= 0) {
                return NextResponse.json({ error: 'bonus_months must be a positive number' }, { status: 400 });
            }
            updateData.bonus_months = n;
        }
        if (Array.isArray(eligible_billing_cycles)) {
            updateData.eligible_billing_cycles = eligible_billing_cycles;
        }
        if (Array.isArray(eligible_plan_slugs)) {
            updateData.eligible_plan_slugs = eligible_plan_slugs;
        }
        if (is_active !== undefined) updateData.is_active = !!is_active;
        if (starts_at !== undefined) updateData.starts_at = starts_at || null;
        if (ends_at !== undefined) updateData.ends_at = ends_at || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data: promotion, error } = await supabase
            .from('promotions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        logger.success('Promotion updated', {
            id,
            actor: admin.email,
            changes: Object.keys(updateData),
        });

        return NextResponse.json({ promotion, message: 'Promotion updated successfully' });
    } catch (error: unknown) {
        logger.error('Update promotion error:', { error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update promotion' },
            { status: 500 }
        );
    }
}
