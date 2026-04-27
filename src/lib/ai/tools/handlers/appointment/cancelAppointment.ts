import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { CancelAppointmentArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

export async function executeCancelAppointment(
    args: CancelAppointmentArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    if (!context.shopId || !context.customerId) {
        return { success: false, error: 'Missing shop or customer context.' };
    }

    const supabase = supabaseAdmin();

    // Resolve target appointment id
    let appointmentId: string;
    if (args.appointment_id) {
        appointmentId = args.appointment_id;
    } else {
        const { data: latest } = await supabase
            .from('appointments')
            .select('id')
            .eq('shop_id', context.shopId)
            .eq('customer_id', context.customerId)
            .in('status', ['pending', 'confirmed'])
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (!latest) {
            return { success: false, error: 'Цуцлах боломжтой захиалга олдсонгүй.' };
        }
        appointmentId = latest.id;
    }

    // Verify ownership before update — defense in depth even though service role
    // bypasses RLS here.
    const { data: existing } = await supabase
        .from('appointments')
        .select('id, customer_id, shop_id, status')
        .eq('id', appointmentId)
        .single();

    if (!existing || existing.shop_id !== context.shopId || existing.customer_id !== context.customerId) {
        return { success: false, error: 'Энэ захиалга танд хамаарахгүй байна.' };
    }

    if (existing.status === 'cancelled' || existing.status === 'completed') {
        return { success: false, error: `Уг захиалга аль хэдийн "${existing.status}" төлөвт байна.` };
    }

    const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

    if (error) {
        logger.error('Cancel appointment failed:', { error });
        return { success: false, error: 'Захиалга цуцлахад алдаа гарлаа.' };
    }

    return {
        success: true,
        message: `Захиалга #${appointmentId.substring(0, 8)} цуцаллаа.`,
        data: { appointmentId }
    };
}
