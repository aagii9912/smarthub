import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { BookAppointmentArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

// Mongolian short weekday names that match the values stored in
// products.available_days (per ProductForm "Дав, Мяг, Лха, Пүр, Баа, Бям, Ням").
const WEEKDAYS_MN = ['Ням', 'Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям'];

interface AppointmentProduct {
    id: string;
    name: string;
    type: string;
    duration_minutes: number | null;
    available_days: string[] | null;
    start_time: string | null;
    end_time: string | null;
    max_bookings_per_day: number | null;
}

function parseTimeOfDay(t: string | null): { h: number; m: number } | null {
    if (!t) return null;
    const [hh, mm] = t.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return { h: hh, m: mm };
}

function isWithinWorkingHours(scheduled: Date, start: string | null, end: string | null): boolean {
    const s = parseTimeOfDay(start);
    const e = parseTimeOfDay(end);
    if (!s || !e) return true;
    const minutes = scheduled.getHours() * 60 + scheduled.getMinutes();
    return minutes >= s.h * 60 + s.m && minutes < e.h * 60 + e.m;
}

export async function executeBookAppointment(
    args: BookAppointmentArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { product_name, scheduled_at, notes } = args;

    if (!context.shopId || !context.customerId) {
        return { success: false, error: 'Missing shop or customer context.' };
    }

    const supabase = supabaseAdmin();

    // Resolve the appointment product by fuzzy name match, restricted to type='appointment'
    const { data: products } = await supabase
        .from('products')
        .select('id, name, type, duration_minutes, available_days, start_time, end_time, max_bookings_per_day')
        .eq('shop_id', context.shopId)
        .eq('type', 'appointment')
        .eq('is_active', true);

    const product = (products as AppointmentProduct[] | null)?.find(p =>
        p.name.toLowerCase().includes(product_name.toLowerCase())
    );

    if (!product) {
        return { success: false, error: `"${product_name}" нэртэй цаг захиалгын үйлчилгээ олдсонгүй.` };
    }

    // Validate the timestamp
    const scheduled = new Date(scheduled_at);
    if (Number.isNaN(scheduled.getTime())) {
        return { success: false, error: `Огноо буруу форматтай байна (ISO 8601 шаардана).` };
    }
    if (scheduled.getTime() <= Date.now()) {
        return { success: false, error: 'Өнгөрсөн цагт цаг захиалах боломжгүй.' };
    }

    // Day-of-week check
    if (product.available_days && product.available_days.length > 0) {
        const dayName = WEEKDAYS_MN[scheduled.getDay()];
        if (!product.available_days.includes(dayName)) {
            return {
                success: false,
                error: `${dayName} өдөр уг үйлчилгээ ажилладаггүй. Боломжит өдрүүд: ${product.available_days.join(', ')}.`
            };
        }
    }

    // Working hours check
    if (!isWithinWorkingHours(scheduled, product.start_time, product.end_time)) {
        return {
            success: false,
            error: `Уг цаг ажлын цагт хамаарахгүй (${product.start_time || '?'} - ${product.end_time || '?'}).`
        };
    }

    // Per-day capacity check
    if (product.max_bookings_per_day && product.max_bookings_per_day > 0) {
        const dayStart = new Date(scheduled);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const { count } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', product.id)
            .in('status', ['pending', 'confirmed'])
            .gte('scheduled_at', dayStart.toISOString())
            .lt('scheduled_at', dayEnd.toISOString());

        if (count !== null && count >= product.max_bookings_per_day) {
            return {
                success: false,
                error: `Тухайн өдөр захиалга дүүрсэн байна (${count}/${product.max_bookings_per_day}). Өөр өдөр сонгоно уу.`
            };
        }
    }

    // Idempotency: prevent duplicate booking by same customer for same product+slot
    const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('customer_id', context.customerId)
        .eq('product_id', product.id)
        .eq('scheduled_at', scheduled.toISOString())
        .in('status', ['pending', 'confirmed'])
        .maybeSingle();

    if (existing) {
        return {
            success: true,
            message: `Энэ цагт танд аль хэдийн захиалга байна (#${existing.id.substring(0, 8)}).`,
            data: { appointmentId: existing.id, duplicate: true }
        };
    }

    // Insert appointment
    const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
            shop_id: context.shopId,
            product_id: product.id,
            customer_id: context.customerId,
            scheduled_at: scheduled.toISOString(),
            duration_minutes: product.duration_minutes || 30,
            status: 'pending',
            notes: notes || null,
        })
        .select()
        .single();

    if (insertError || !appointment) {
        logger.error('Appointment insert failed:', { error: insertError });
        return { success: false, error: 'Цаг захиалга үүсгэхэд алдаа гарлаа.' };
    }

    const slotLabel = scheduled.toLocaleString('mn-MN', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    return {
        success: true,
        message: `Амжилттай! ${product.name} — ${slotLabel} цагт захиалга #${appointment.id.substring(0, 8)} үүслээ.`,
        data: {
            appointmentId: appointment.id,
            productName: product.name,
            scheduledAt: appointment.scheduled_at,
            durationMinutes: appointment.duration_minutes,
        }
    };
}
