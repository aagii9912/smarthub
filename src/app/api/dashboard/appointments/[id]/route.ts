import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { parseWithErrors } from '@/lib/validations';
import { updateAppointmentSchema } from '@/lib/validations/appointment';
import { logger } from '@/lib/utils/logger';

// PATCH /api/dashboard/appointments/[id] — update status / payment / staff / time
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await ctx.params;
        const body = await request.json();
        const validation = parseWithErrors(updateAppointmentSchema, body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('appointments')
            .update(validation.data)
            .eq('id', id)
            .eq('shop_id', authShop.id) // ownership scope
            .select('id, scheduled_at, duration_minutes, status, payment_status, price, notes, staff_id, customers (name, phone), products (name, category)')
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ appointment: data });
    } catch (error: unknown) {
        logger.error('Appointments PATCH error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }
}
