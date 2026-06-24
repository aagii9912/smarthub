import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { parseWithErrors } from '@/lib/validations';
import { createStaffSchema } from '@/lib/validations/staff';
import { logger } from '@/lib/utils/logger';

// GET /api/dashboard/staff — list the shop's staff
export async function GET() {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('shop_id', authShop.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ staff: data || [] });
    } catch (error: unknown) {
        logger.error('Staff GET error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }
}

// POST /api/dashboard/staff — create a staff member
export async function POST(request: Request) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const validation = parseWithErrors(createStaffSchema, body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('staff')
            .insert({ shop_id: authShop.id, ...validation.data })
            .select('*')
            .single();

        if (error) throw error;
        return NextResponse.json({ staff: data }, { status: 201 });
    } catch (error: unknown) {
        logger.error('Staff POST error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
    }
}
