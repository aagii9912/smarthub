/**
 * Public Plans API
 * List available subscription plans for users
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = supabaseAdmin();

        const { data: plans, error } = await supabase
            .from('plans')
            .select('id, name, slug, description, price_monthly, price_yearly, features, is_featured')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ plans: plans || [] });
    } catch (error: any) {
        console.error('Get plans error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch plans' },
            { status: 500 }
        );
    }
}
