import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

interface AppointmentRow {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    products: { name: string } | null;
}

export async function executeListAppointments(
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    if (!context.shopId || !context.customerId) {
        return { success: false, error: 'Missing shop or customer context.' };
    }

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
        .from('appointments')
        .select('id, scheduled_at, duration_minutes, status, products(name)')
        .eq('shop_id', context.shopId)
        .eq('customer_id', context.customerId)
        .in('status', ['pending', 'confirmed'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10);

    if (error) {
        logger.error('List appointments failed:', { error });
        return { success: false, error: 'Цаг захиалгын мэдээлэл татахад алдаа гарлаа.' };
    }

    const rows = (data as unknown as AppointmentRow[]) || [];

    if (rows.length === 0) {
        return { success: true, message: 'Танд одоогоор удахгүй болох цаг захиалга алга.' };
    }

    const lines = rows.map(r => {
        const slot = new Date(r.scheduled_at).toLocaleString('mn-MN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const productName = r.products?.name || 'Үйлчилгээ';
        return `• #${r.id.substring(0, 8)} — ${productName} — ${slot} (${r.duration_minutes} мин)`;
    });

    return {
        success: true,
        message: `Удахгүй болох ${rows.length} захиалга:\n${lines.join('\n')}`,
        data: { count: rows.length, appointments: rows }
    };
}
