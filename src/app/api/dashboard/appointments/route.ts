import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// GET /api/dashboard/appointments?status=&payment=&limit=
// Booking shops' "Цаг захиалга" list — straight from the appointments table.
export async function GET(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // pending|confirmed|completed|cancelled|no_show
        const payment = searchParams.get('payment'); // paid|unpaid|partial
        const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

        const supabase = supabaseAdmin();
        let query = supabase
            .from('appointments')
            .select('id, scheduled_at, duration_minutes, status, payment_status, price, notes, staff_id, customers (name, phone), products (name, category)')
            .eq('shop_id', authShop.id)
            .order('scheduled_at', { ascending: false })
            .limit(limit);

        if (status) query = query.eq('status', status);
        if (payment) query = query.eq('payment_status', payment);

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ appointments: data || [] });
    } catch (error: unknown) {
        logger.error('Appointments GET error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }
}
