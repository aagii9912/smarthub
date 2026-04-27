/**
 * Public Plans API
 * List available subscription plans for users.
 * Also returns the active "bonus_year" promotion (if any in window) so UIs can
 * render a promo ribbon and the right yearly subtext.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export async function GET() {
    try {
        const supabase = supabaseAdmin();

        const [{ data: plans, error }, { data: promo }] = await Promise.all([
            supabase
                .from('plans')
                .select('id, name, slug, description, price_monthly, price_yearly, features, limits, is_featured')
                .eq('is_active', true)
                .order('sort_order', { ascending: true }),
            supabase
                .from('promotions')
                .select('id, code, name, description, bonus_months, eligible_billing_cycles, eligible_plan_slugs, starts_at, ends_at')
                .eq('is_active', true)
                .eq('type', 'bonus_year')
                .maybeSingle(),
        ]);

        if (error) throw error;

        const now = new Date();
        const inWindow = promo &&
            (!promo.starts_at || new Date(promo.starts_at) <= now) &&
            (!promo.ends_at || new Date(promo.ends_at) > now);

        return NextResponse.json({
            plans: plans || [],
            promotion: inWindow ? promo : null,
        });
    } catch (error: unknown) {
        logger.error('Get plans error:', { error: error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch plans' },
            { status: 500 }
        );
    }
}
