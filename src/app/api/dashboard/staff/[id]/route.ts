import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { parseWithErrors } from '@/lib/validations';
import { updateStaffSchema } from '@/lib/validations/staff';
import { logger } from '@/lib/utils/logger';

// PATCH /api/dashboard/staff/[id] — update a staff member
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await ctx.params;
        const body = await request.json();
        const validation = parseWithErrors(updateStaffSchema, body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('staff')
            .update(validation.data)
            .eq('id', id)
            .eq('shop_id', authShop.id) // ownership scope
            .select('*')
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ staff: data });
    } catch (error: unknown) {
        logger.error('Staff PATCH error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
    }
}

// DELETE /api/dashboard/staff/[id] — remove a staff member
// appointments.staff_id is ON DELETE SET NULL, so existing bookings are kept.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await ctx.params;
        const supabase = supabaseAdmin();
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id)
            .eq('shop_id', authShop.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        logger.error('Staff DELETE error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
    }
}
