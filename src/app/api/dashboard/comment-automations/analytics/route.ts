import { logger } from '@/lib/utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { phoneMatchKey } from '@/lib/utils/phone';
import { resolveArchetype } from '@/lib/dashboard/archetypes';
import type { CommentLead } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * Resolve the shop for the authenticated user. SECURITY: the x-shop-id header is
 * attacker-controllable and this route reads via the service-role client (RLS
 * bypass), so we MUST verify the header shop belongs to the user (IDOR guard).
 * Mirrors /api/dashboard/comment-automations.
 */
async function getShopId(request: NextRequest): Promise<string | null> {
    const userId = await getAuthUser();
    if (!userId) return null;

    const supabase = supabaseAdmin();
    const headerShopId = request.headers.get('x-shop-id');
    if (headerShopId) {
        const { data } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', userId)
            .eq('id', headerShopId)
            .maybeSingle();
        return data?.id ?? null;
    }

    const { data } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    return data?.id || null;
}

type OrderRow = {
    id: string;
    total_amount: number | null;
    status: string | null;
    created_at: string;
    customer_phone: string | null;
    customer_id: string | null;
};

/**
 * GET /api/dashboard/comment-automations/analytics
 *
 * Lead-collection report for comment automations (live + post).
 *
 * Query params:
 *   - days?: number              (default 30, clamped 1..365)
 *   - automation_id?: string     (filter to one rule)
 *   - source_type?: 'live'|'post'
 *
 * Funnel: a captured comment's phone ("авна 99XXXXXX") is matched against
 * orders (by last-8-digits) to derive converted leads + attributed revenue at
 * read time. Cancelled orders are excluded.
 */
export async function GET(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = request.nextUrl;
        const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30));
        const automationId = searchParams.get('automation_id');
        const sourceTypeFilter = searchParams.get('source_type');
        const captureTypeFilter = searchParams.get('capture_type');
        const fromIso = new Date(Date.now() - days * 86_400_000).toISOString();
        const toIso = new Date().toISOString();

        const supabase = supabaseAdmin();

        // 1. Leads in range
        let leadsQuery = supabase
            .from('comment_leads')
            .select(
                'id, automation_id, capture_type, platform, source_type, post_id, commenter_id, commenter_name, comment_text, extracted_phone, matched_keyword, dm_sent, reply_sent, status, created_at'
            )
            .eq('shop_id', shopId)
            .gte('created_at', fromIso)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (automationId) leadsQuery = leadsQuery.eq('automation_id', automationId);
        if (sourceTypeFilter === 'live' || sourceTypeFilter === 'post') {
            leadsQuery = leadsQuery.eq('source_type', sourceTypeFilter);
        }
        if (captureTypeFilter === 'automation' || captureTypeFilter === 'missed') {
            leadsQuery = leadsQuery.eq('capture_type', captureTypeFilter);
        }

        const { data: leadsData, error: leadsError } = await leadsQuery;
        if (leadsError) {
            logger.error('analytics: leads query failed', { error: leadsError.message });
            return NextResponse.json({ error: 'Тайлан ачаалж чадсангүй' }, { status: 500 });
        }
        const leads = (leadsData || []) as Array<Partial<CommentLead>>;

        // 1b. Archetype. A үл хөдлөх / авто shop never writes an `orders` row, so
        //     order-based conversion, revenue and the per-rule Орлого column are
        //     structurally zero for it — the screen read "your automations
        //     produced nothing" while the 45 phone numbers it really collected
        //     were the only true figure on the page. For those shops we derive
        //     conversion from `comment_leads.status`, which the broker sets, and
        //     report `revenue: null` so the UI can drop the money columns.
        const { data: shopRow } = await supabase
            .from('shops')
            .select('business_type, ai_agent_capabilities')
            .eq('id', shopId)
            .single();
        const isLeadShop = resolveArchetype(shopRow?.business_type, shopRow?.ai_agent_capabilities) === 'lead';

        // 2. Automation names (for per-rule rollup labels)
        const { data: autoRows } = await supabase
            .from('comment_automations')
            .select('id, name')
            .eq('shop_id', shopId);
        const automationName = new Map<string, string>(
            (autoRows || []).map((a) => [a.id as string, a.name as string])
        );

        // 3. Orders + customer phones for funnel attribution (range start onward —
        //    any attributable order is created at/after its lead).
        const { data: orderRows } = isLeadShop
            ? { data: [] as OrderRow[] }
            : await supabase
                .from('orders')
                .select('id, total_amount, status, created_at, customer_phone, customer_id')
                .eq('shop_id', shopId)
                .gte('created_at', fromIso)
                .limit(10000);
        const orders = (orderRows || []) as OrderRow[];

        // Fill missing order phones from the customer record.
        const missingCustomerIds = [
            ...new Set(orders.filter((o) => !o.customer_phone && o.customer_id).map((o) => o.customer_id as string)),
        ];
        const customerPhone = new Map<string, string>();
        if (missingCustomerIds.length > 0) {
            const { data: custRows } = await supabase
                .from('customers')
                .select('id, phone')
                .in('id', missingCustomerIds);
            for (const c of custRows || []) {
                if (c.phone) customerPhone.set(c.id as string, c.phone as string);
            }
        }

        // --- Aggregations ---------------------------------------------------
        const totalLeads = leads.length;
        const isMissed = (l: Partial<CommentLead>) => l.capture_type === 'missed';
        const capturedCount = leads.filter((l) => !isMissed(l)).length;
        const missedCount = leads.filter(isMissed).length;
        const uniqueCommenters = new Set(
            leads.map((l) => l.commenter_id || l.commenter_name || l.id)
        ).size;

        const dmSent = leads.filter((l) => l.dm_sent).length;
        const replySent = leads.filter((l) => l.reply_sent).length;

        // Distinct phones left by missed leads (the uncaptured opportunity set).
        const missedPhoneSet = new Set<string>();
        for (const l of leads) {
            if (!isMissed(l)) continue;
            const key = phoneMatchKey(l.extracted_phone);
            if (key) missedPhoneSet.add(key);
        }

        // Earliest lead time + capture type per phone (order must come after the
        // comment; earliest capture type decides whether a conversion is credited
        // to an automation or to a missed opportunity).
        const phoneEarliestLeadAt = new Map<string, number>();
        const phoneToAutomation = new Map<string, string | null>();
        const phoneToCaptureType = new Map<string, 'automation' | 'missed'>();
        for (const l of leads) {
            const key = phoneMatchKey(l.extracted_phone);
            if (!key) continue;
            const t = new Date(l.created_at as string).getTime();
            const prev = phoneEarliestLeadAt.get(key);
            if (prev === undefined || t < prev) {
                phoneEarliestLeadAt.set(key, t);
                phoneToAutomation.set(key, l.automation_id ?? null);
                phoneToCaptureType.set(key, isMissed(l) ? 'missed' : 'automation');
            }
        }
        const uniquePhones = phoneEarliestLeadAt.size;

        const convertedByAutomationSeed = new Map<string, Set<string>>();
        const missedConvertedPhonesSeed = new Set<string>();

        // Lead shops: the broker marks a lead 'contacted'/'converted' by hand
        // (PATCH /api/dashboard/comment-automations/leads/[id]); that is the only
        // conversion signal that exists for them.
        const convertedPhones = new Set<string>();
        if (isLeadShop) {
            for (const l of leads) {
                if (l.status !== 'converted') continue;
                const key = phoneMatchKey(l.extracted_phone);
                if (!key) continue;
                convertedPhones.add(key);
                if (l.capture_type === 'missed') missedConvertedPhonesSeed.add(key);
                const autoId = l.automation_id ?? 'none';
                if (!convertedByAutomationSeed.has(autoId)) convertedByAutomationSeed.set(autoId, new Set());
                convertedByAutomationSeed.get(autoId)!.add(key);
            }
        }

        // Attribute each non-cancelled order to a phone (counted once).
        const revenueByAutomation = new Map<string, number>();
        const convertedByAutomation = convertedByAutomationSeed;
        const missedConvertedPhones = missedConvertedPhonesSeed;
        let revenue = 0;
        let missedRevenue = 0;
        let ordersAttributed = 0;
        for (const o of orders) {
            if (o.status === 'cancelled') continue;
            const phone = o.customer_phone || (o.customer_id ? customerPhone.get(o.customer_id) : null);
            const key = phoneMatchKey(phone);
            if (!key) continue;
            const leadAt = phoneEarliestLeadAt.get(key);
            if (leadAt === undefined) continue;
            if (new Date(o.created_at).getTime() < leadAt) continue; // order predates the comment

            convertedPhones.add(key);
            ordersAttributed += 1;
            revenue += o.total_amount || 0;

            if (phoneToCaptureType.get(key) === 'missed') {
                missedConvertedPhones.add(key);
                missedRevenue += o.total_amount || 0;
            }

            const autoId = phoneToAutomation.get(key) || 'none';
            revenueByAutomation.set(autoId, (revenueByAutomation.get(autoId) || 0) + (o.total_amount || 0));
            if (!convertedByAutomation.has(autoId)) convertedByAutomation.set(autoId, new Set());
            convertedByAutomation.get(autoId)!.add(key);
        }

        // By source (live vs post)
        const bySource = { live: { leads: 0, phones: 0 }, post: { leads: 0, phones: 0 } };
        const sourcePhoneSeen = { live: new Set<string>(), post: new Set<string>() };
        for (const l of leads) {
            const src = (l.source_type as 'live' | 'post') || 'post';
            const bucket = bySource[src];
            if (!bucket) continue;
            bucket.leads += 1;
            const key = phoneMatchKey(l.extracted_phone);
            if (key && !sourcePhoneSeen[src].has(key)) {
                sourcePhoneSeen[src].add(key);
                bucket.phones += 1;
            }
        }

        // By automation
        const byAutomationMap = new Map<
            string,
            { automationId: string | null; name: string; leads: number; phones: Set<string> }
        >();
        for (const l of leads) {
            if (isMissed(l)) continue; // missed leads have no rule; reported separately
            const autoId = l.automation_id ?? 'none';
            if (!byAutomationMap.has(autoId)) {
                byAutomationMap.set(autoId, {
                    automationId: l.automation_id ?? null,
                    name: (l.automation_id && automationName.get(l.automation_id)) || 'Устгасан дүрэм',
                    leads: 0,
                    phones: new Set(),
                });
            }
            const entry = byAutomationMap.get(autoId)!;
            entry.leads += 1;
            const key = phoneMatchKey(l.extracted_phone);
            if (key) entry.phones.add(key);
        }
        const byAutomation = [...byAutomationMap.entries()]
            .map(([autoId, e]) => ({
                automationId: e.automationId,
                name: e.name,
                leads: e.leads,
                phones: e.phones.size,
                converted: convertedByAutomation.get(autoId)?.size || 0,
                // null = "энэ бизнест орлого гэж хэмжигдэхгүй" (UI баганыг нуана)
                revenue: isLeadShop ? null : (revenueByAutomation.get(autoId) || 0),
            }))
            .sort((a, b) => b.leads - a.leads);

        // Daily time series
        const seriesMap = new Map<string, { leads: number; phones: number }>();
        for (const l of leads) {
            const date = (l.created_at as string).slice(0, 10);
            if (!seriesMap.has(date)) seriesMap.set(date, { leads: 0, phones: 0 });
            const s = seriesMap.get(date)!;
            s.leads += 1;
            if (l.extracted_phone) s.phones += 1;
        }
        const timeSeries = [...seriesMap.entries()]
            .map(([date, s]) => ({ date, ...s }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Recent leads (newest 50) with computed conversion status
        const recentLeads = leads.slice(0, 50).map((l) => {
            const key = phoneMatchKey(l.extracted_phone);
            const isConverted = key ? convertedPhones.has(key) : false;
            return {
                id: l.id,
                commenter_name: l.commenter_name,
                extracted_phone: l.extracted_phone,
                comment_text: l.comment_text,
                source_type: l.source_type,
                capture_type: l.capture_type || 'automation',
                platform: l.platform,
                matched_keyword: l.matched_keyword,
                dm_sent: l.dm_sent,
                reply_sent: l.reply_sent,
                status: isConverted ? 'converted' : (l.status || 'new'),
                created_at: l.created_at,
                automation_name: (l.automation_id && automationName.get(l.automation_id)) || null,
            };
        });

        return NextResponse.json({
            range: { from: fromIso, to: toIso, days },
            totals: {
                leads: totalLeads,
                captured: capturedCount,
                missed: missedCount,
                uniqueCommenters,
                phonesCaptured: uniquePhones,
                dmSent,
                replySent,
            },
            // isLeadShop үед орлого / захиалга гэж хэмжих зүйл байхгүй — UI
            // тэдгээр KPI-г нуугаад "Холбогдсон" гэсэн утгаар харуулна.
            isLeadShop,
            funnel: {
                qualifiedPhones: uniquePhones,
                convertedPhones: convertedPhones.size,
                ordersAttributed: isLeadShop ? null : ordersAttributed,
                revenue: isLeadShop ? null : revenue,
                conversionRate: uniquePhones > 0 ? convertedPhones.size / uniquePhones : 0,
            },
            missed: {
                leads: missedCount,
                phones: missedPhoneSet.size,
                converted: missedConvertedPhones.size,
                revenue: isLeadShop ? null : missedRevenue,
            },
            bySource,
            byAutomation,
            timeSeries,
            recentLeads,
        });
    } catch (error: unknown) {
        logger.error('GET comment-automations analytics error:', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
