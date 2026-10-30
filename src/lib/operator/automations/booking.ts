/**
 * Цаг захиалгат бизнесийн automation-ууд (booking archetype).
 * Эхэлж beauty pack-д; healthcare, service pack-ууд мөн дахин ашиглана.
 *
 *   reminder_24h / reminder_2h — цагийн сануулга (deterministic, 0 нэгж)
 *   daily_owner_summary        — эзэнд өглөөний тойм push (deterministic)
 *
 * Сануулга deliver()-ээр явна: 24ц цонх дотор текст, гадна нь Utility
 * template, аль нь ч болохгүй бол эзэнд "залгаж сануул" даалгавар.
 * Үйлчлүүлэгч хариу бичвэл чатын AI (cancel_appointment tool) хүлээж авна.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { deliver } from '../deliver';
import { formatUbDateTime, ubDayStart } from '../time';
import type { AutomationDef } from '../types';
import { DAY, MINUTE, dailyShopSubject, one, outcomeFromDelivery, summaryHourField } from './shared';
import { pushOwnerReport } from './report';

const ACTIVE_STATUSES = ['pending', 'confirmed'];

export function buildReminderText(params: { shopName: string; service: string; when: string }): string {
    return `⏰ Сануулга: ${params.shopName}-д ${params.when}-д "${params.service}" цаг захиалгатай байна.\nӨөрчлөх, цуцлах бол энд бичээрэй 🙏`;
}

export function appointmentReminder(opts: {
    key: string;
    label: string;
    description: string;
    /** Цаг эхлэхээс хэдэн минутын өмнөх цонх [min, max]. */
    minAheadMin: number;
    maxAheadMin: number;
    /** Үүнээс саяхан захиалсан бол сануулахгүй (дөнгөж захиалсан хүнд илүүц). */
    minLeadMin: number;
}): AutomationDef {
    return {
        key: opts.key,
        label: opts.label,
        description: opts.description,
        kind: 'customer_message',
        defaultMode: 'auto',
        defaultEnabled: true,
        usesLLM: false,

        async select(ctx) {
            const now = ctx.now.getTime();
            const { data, error } = await supabaseAdmin()
                .from('appointments')
                .select('id, scheduled_at')
                .eq('shop_id', ctx.shopId)
                .in('status', ACTIVE_STATUSES)
                .not('customer_id', 'is', null)
                .gte('scheduled_at', new Date(now + opts.minAheadMin * MINUTE).toISOString())
                .lte('scheduled_at', new Date(now + opts.maxAheadMin * MINUTE).toISOString())
                .lte('created_at', new Date(now - opts.minLeadMin * MINUTE).toISOString())
                .limit(200);
            if (error) throw new Error(error.message);

            // windowKey = цаг: цаг нь шилжвэл шинэ сануулга явна.
            return (data ?? []).map((a) => ({
                subjectType: 'appointment',
                subjectId: a.id as string,
                windowKey: new Date(a.scheduled_at as string).toISOString(),
                payload: { scheduled_at: a.scheduled_at },
            }));
        },

        async execute(ctx, run) {
            const db = supabaseAdmin();
            const [{ data: appt }, { data: shop }] = await Promise.all([
                db
                    .from('appointments')
                    .select('id, status, scheduled_at, customer_id, products(name), customers(name, phone)')
                    .eq('id', run.subject_id ?? '')
                    .eq('shop_id', ctx.shopId)
                    .maybeSingle(),
                db.from('shops').select('name').eq('id', ctx.shopId).maybeSingle(),
            ]);

            if (!appt || !appt.customer_id) return { status: 'skipped', result: { reason: 'appointment_missing' } };
            if (!ACTIVE_STATUSES.includes(appt.status as string)) {
                return { status: 'skipped', result: { reason: `status_${appt.status}` } };
            }
            const plannedAt = new Date(String(run.payload.scheduled_at)).getTime();
            if (new Date(appt.scheduled_at as string).getTime() !== plannedAt) {
                return { status: 'skipped', result: { reason: 'rescheduled' } };
            }

            type Named = { name: string | null };
            const service = one(appt.products as Named | Named[] | null)?.name ?? 'үйлчилгээ';
            const customer = one(appt.customers as (Named & { phone: string | null }) | (Named & { phone: string | null })[] | null);
            const when = formatUbDateTime(new Date(appt.scheduled_at as string));
            const shopName = (shop?.name as string) || 'Манай';

            const delivery = await deliver({
                shopId: ctx.shopId,
                customerId: appt.customer_id as string,
                operation: run.agent_slug,
                text: buildReminderText({ shopName, service, when }),
                utility: { purpose: 'appointment_reminder', params: { shop: shopName, when, service } },
                ownerFallback: {
                    topic: 'automation',
                    title: '📞 Цагийн сануулга хүрсэнгүй',
                    body: `${customer?.name ?? 'Үйлчлүүлэгч'}: ${service} — ${when}. Messenger-ээр хүрэх боломжгүй тул залгаж сануулна уу.`,
                    url: '/dashboard/appointments',
                    tag: `reminder-${appt.id}`,
                },
            });

            return outcomeFromDelivery(delivery, {
                customerName: customer?.name ?? null,
                phone: customer?.phone ?? null,
                note: `${service} — ${when} цагийг сануулах`,
            });
        },
    };
}

// ── Өглөөний тойм ───────────────────────────────────────────────────

export interface DayAppointment {
    status: string;
    scheduled_at: string;
    payment_status: string | null;
    price: number | string | null;
}

export interface DaySummary {
    today: number;
    yesterdayCompleted: number;
    yesterdayNoShow: number;
    yesterdayRevenue: number;
    unpaidCompleted7d: number;
}

export function summarizeDay(appts: DayAppointment[], now: Date): DaySummary {
    const todayStart = ubDayStart(now).getTime();
    const tomorrowStart = todayStart + DAY;
    const yesterdayStart = todayStart - DAY;
    const weekStart = todayStart - 7 * DAY;

    const summary: DaySummary = { today: 0, yesterdayCompleted: 0, yesterdayNoShow: 0, yesterdayRevenue: 0, unpaidCompleted7d: 0 };
    for (const a of appts) {
        const t = new Date(a.scheduled_at).getTime();
        if (t >= todayStart && t < tomorrowStart && ACTIVE_STATUSES.includes(a.status)) summary.today++;
        if (t >= yesterdayStart && t < todayStart) {
            if (a.status === 'completed') {
                summary.yesterdayCompleted++;
                if (a.payment_status === 'paid') summary.yesterdayRevenue += Number(a.price ?? 0);
            }
            if (a.status === 'no_show') summary.yesterdayNoShow++;
        }
        if (t >= weekStart && t < todayStart && a.status === 'completed' && a.payment_status !== 'paid') {
            summary.unpaidCompleted7d++;
        }
    }
    return summary;
}

export function formatSummary(s: DaySummary): { title: string; body: string } | null {
    const parts: string[] = [];
    parts.push(s.today > 0 ? `Өнөөдөр ${s.today} цаг захиалга` : 'Өнөөдөр захиалга алга');
    if (s.yesterdayCompleted > 0) {
        const revenue = s.yesterdayRevenue > 0 ? ` (${s.yesterdayRevenue.toLocaleString()}₮)` : '';
        parts.push(`өчигдөр ${s.yesterdayCompleted} үйлчилгээ${revenue}`);
    }
    if (s.yesterdayNoShow > 0) parts.push(`${s.yesterdayNoShow} хүн ирээгүй`);
    if (s.unpaidCompleted7d > 0) parts.push(`${s.unpaidCompleted7d} төлбөр дутуу`);

    const empty = s.today === 0 && s.yesterdayCompleted === 0 && s.yesterdayNoShow === 0 && s.unpaidCompleted7d === 0;
    if (empty) return null;
    return { title: '☀️ Өнөөдрийн тойм', body: parts.join(' · ') };
}

export const dailyOwnerSummary: AutomationDef = {
    key: 'daily_owner_summary',
    label: 'Өглөөний тойм',
    description: 'Өглөө бүр өнөөдрийн захиалга, өчигдрийн ирц, дутуу төлбөрийг эзэнд push-ээр илгээнэ.',
    kind: 'owner_report',
    defaultMode: 'auto',
    defaultEnabled: true,
    usesLLM: false,
    configFields: [summaryHourField],

    async select(ctx) {
        return dailyShopSubject(ctx);
    },

    async execute(ctx) {
        const todayStart = ubDayStart(ctx.now).getTime();
        const { data, error } = await supabaseAdmin()
            .from('appointments')
            .select('status, scheduled_at, payment_status, price')
            .eq('shop_id', ctx.shopId)
            .gte('scheduled_at', new Date(todayStart - 7 * DAY).toISOString())
            .lt('scheduled_at', new Date(todayStart + DAY).toISOString())
            .limit(2000);
        if (error) throw new Error(error.message);

        const summary = summarizeDay((data ?? []) as DayAppointment[], ctx.now);
        return pushOwnerReport(ctx, formatSummary(summary), {
            url: '/dashboard/appointments',
            tag: 'daily-summary',
            stats: summary,
        });
    },
};

export const reminder24h = appointmentReminder({
    key: 'reminder_24h',
    label: '24 цагийн өмнөх сануулга',
    description: 'Цагаас ~1 өдрийн өмнө үйлчлүүлэгчид сануулна.',
    minAheadMin: 20 * 60,
    maxAheadMin: 24 * 60,
    minLeadMin: 6 * 60,
});

export const reminder2h = appointmentReminder({
    key: 'reminder_2h',
    label: '2 цагийн өмнөх сануулга',
    description: 'Цагаас 1–2 цагийн өмнө үйлчлүүлэгчид сануулна.',
    minAheadMin: 60,
    maxAheadMin: 120,
    minLeadMin: 30,
});
