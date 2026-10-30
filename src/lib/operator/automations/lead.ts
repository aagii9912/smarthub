/**
 * Лийд бизнесийн automation-ууд (lead archetype): realestate_auto, education.
 *
 *   lead_followup           — удаан холбогдоогүй лийдийг эзэнд "залгах" даалгавар болгоно
 *   daily_pipeline_summary  — өглөөний лийдийн тойм (push)
 *
 * Лийдийн тодорхойлолт нь lead dashboard-тай ижил (api/dashboard/stats):
 * утастай, захиалгагүй, `customers.tags`-аар хаагдаагүй (Хөрвүүлсэн/Татгалзсан).
 * Брокерийн дагалт ихэвчлэн 24ц цонхны гадна тул үйлчлүүлэгч рүү бичихгүй —
 * эзэн/менежер өөрөө залгана. Даалгаврыг "Хийсэн" гэвэл last_contact_at шинэчлэгдэнэ.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { LEAD_STAGE_TAGS, isClosedLead } from '@/lib/dashboard/leadStages';
import { ubDayStart } from '../time';
import type { AutomationConfigField, AutomationDef } from '../types';
import { DAY, HOUR, callCustomerTask, configNumber, dailyShopSubject, summaryHourField } from './shared';
import { pushOwnerReport } from './report';

/** Нэг удаад үүсгэх даалгаврын дээд хэмжээ — inbox-ыг үерлүүлэхгүй. */
const MAX_TASKS_PER_RUN = 20;
/** Хөрсөн лийдийг зөвхөн энэ хугацааны "шинэ хөрсөн" цонхонд барина. */
const STALE_BAND_DAYS = 3;

export const followUpDaysField: AutomationConfigField = {
    key: 'days',
    label: 'Холбогдоогүй хоног',
    type: 'number',
    min: 1,
    max: 14,
    default: 2,
    unit: 'хоног',
};

/** Лийдийн одоогийн шат (pipeline-ийн хамгийн ахисан tag). */
export function currentStage(tags: unknown): string | null {
    const list = Array.isArray(tags) ? tags : [];
    let stage: string | null = null;
    for (const s of LEAD_STAGE_TAGS) if (list.includes(s)) stage = s;
    return stage;
}

export function followUpNote(days: number, tags: unknown): string {
    const stage = currentStage(tags);
    return `${days}+ хоног холбогдоогүй лийд${stage ? ` (${stage})` : ''} — дахин холбогдоорой`;
}

export const leadFollowup: AutomationDef = {
    key: 'lead_followup',
    label: 'Лийдийн дагалт',
    description: 'Хэд хоног холбогдоогүй лийдийг таны "залгах" жагсаалтад автоматаар нэмнэ.',
    kind: 'owner_task',
    defaultMode: 'auto',
    defaultEnabled: true,
    usesLLM: false,
    intervalMinutes: 60,
    configFields: [followUpDaysField],

    async select(ctx) {
        const days = configNumber(ctx.config, followUpDaysField);
        const now = ctx.now.getTime();
        const staleTo = new Date(now - days * DAY).toISOString();
        const staleFrom = new Date(now - (days + STALE_BAND_DAYS) * DAY).toISOString();
        const neverSince = new Date(now - 7 * DAY).toISOString();

        // Хуучин бүх лийдийг биш, саяхан "хөрсөн" эсвэл огт холбогдоогүй шинэ лийдийг л авна.
        const { data, error } = await supabaseAdmin()
            .from('customers')
            .select('id, last_contact_at, tags')
            .eq('shop_id', ctx.shopId)
            .not('phone', 'is', null)
            .eq('total_orders', 0)
            .or(
                `and(last_contact_at.gte.${staleFrom},last_contact_at.lte.${staleTo}),` +
                    `and(last_contact_at.is.null,created_at.gte.${neverSince},created_at.lte.${staleTo})`,
            )
            .limit(100);
        if (error) throw new Error(error.message);

        return (data ?? [])
            .filter((c) => !isClosedLead(c.tags))
            .slice(0, MAX_TASKS_PER_RUN)
            .map((c) => ({
                subjectType: 'customer',
                subjectId: c.id as string,
                // Холбогдох бүрт last_contact_at өөрчлөгдөнө → дараагийн хөрөлтөд шинэ даалгавар.
                windowKey: (c.last_contact_at as string | null) ?? 'never',
                payload: { last_contact_at: c.last_contact_at ?? null },
            }));
    },

    async execute(ctx, run) {
        const { data: lead } = await supabaseAdmin()
            .from('customers')
            .select('id, name, phone, tags, last_contact_at')
            .eq('id', run.subject_id ?? '')
            .eq('shop_id', ctx.shopId)
            .maybeSingle();

        if (!lead) return { status: 'skipped', result: { reason: 'lead_missing' } };
        if (isClosedLead(lead.tags)) return { status: 'skipped', result: { reason: 'lead_closed' } };
        if ((lead.last_contact_at ?? null) !== (run.payload.last_contact_at ?? null)) {
            return { status: 'skipped', result: { reason: 'contacted_since' } };
        }

        return callCustomerTask({
            customerName: (lead.name as string | null) ?? null,
            phone: (lead.phone as string | null) ?? null,
            note: followUpNote(configNumber(ctx.config, followUpDaysField), lead.tags),
        });
    },
};

// ── Өглөөний лийдийн тойм ───────────────────────────────────────────

export interface PipelineSummary {
    newLeads: number;
    newWithPhone: number;
    waitingFollowUp: number;
}

export function formatPipelineSummary(s: PipelineSummary): { title: string; body: string } | null {
    if (s.newLeads === 0 && s.waitingFollowUp === 0) return null;
    const parts: string[] = [];
    parts.push(
        s.newLeads > 0
            ? `Өчигдөр ${s.newLeads} шинэ лийд${s.newWithPhone > 0 ? ` (${s.newWithPhone} утастай)` : ''}`
            : 'Өчигдөр шинэ лийд ороогүй',
    );
    if (s.waitingFollowUp > 0) parts.push(`${s.waitingFollowUp} лийд дагалт хүлээж байна`);
    return { title: '☀️ Лийдийн тойм', body: parts.join(' · ') };
}

export const dailyPipelineSummary: AutomationDef = {
    key: 'daily_pipeline_summary',
    label: 'Өглөөний лийдийн тойм',
    description: 'Өглөө бүр шинэ лийд, дагалт хүлээж буй лийдийн тоог push-ээр илгээнэ.',
    kind: 'owner_report',
    defaultMode: 'auto',
    defaultEnabled: true,
    usesLLM: false,
    configFields: [summaryHourField],

    async select(ctx) {
        return dailyShopSubject(ctx);
    },

    async execute(ctx) {
        const db = supabaseAdmin();
        const todayStart = ubDayStart(ctx.now).getTime();
        const followUpCutoff = new Date(ctx.now.getTime() - 24 * HOUR).toISOString();

        const [newResult, waitingResult] = await Promise.all([
            db
                .from('customers')
                .select('phone')
                .eq('shop_id', ctx.shopId)
                .gte('created_at', new Date(todayStart - DAY).toISOString())
                .lt('created_at', new Date(todayStart).toISOString())
                .limit(2000),
            // Lead dashboard-ийн follow-up дараалалтай ижил тодорхойлолт.
            db
                .from('customers')
                .select('tags')
                .eq('shop_id', ctx.shopId)
                .not('phone', 'is', null)
                .eq('total_orders', 0)
                .or(`last_contact_at.is.null,last_contact_at.lt.${followUpCutoff}`)
                .limit(500),
        ]);
        if (newResult.error) throw new Error(newResult.error.message);
        if (waitingResult.error) throw new Error(waitingResult.error.message);

        const fresh = newResult.data ?? [];
        const summary: PipelineSummary = {
            newLeads: fresh.length,
            newWithPhone: fresh.filter((c) => Boolean(c.phone)).length,
            waitingFollowUp: (waitingResult.data ?? []).filter((c) => !isClosedLead(c.tags)).length,
        };
        return pushOwnerReport(ctx, formatPipelineSummary(summary), {
            url: '/dashboard',
            tag: 'daily-pipeline',
            stats: summary,
        });
    },
};
