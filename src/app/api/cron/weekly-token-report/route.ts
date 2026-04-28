/**
 * Weekly Token Report Cron
 *
 * Runs every Monday at 07:00 sin1. For each active shop with usage > 0
 * in the last 7 days AND `token_report_email_enabled = TRUE`, sends a
 * per-feature breakdown email so owners understand WHAT consumed tokens.
 *
 * Schedule lives in vercel.json. Bearer-auth via CRON_SECRET in production.
 *
 * Dry-run: append `?dry=1` to preview emails without sending.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendTokenUsageReport, type TokenReportFeatureRow } from '@/lib/email/email';

// Note: env vars read at runtime (inside GET) so tests / hot-reloaded env changes are honored.

interface BreakdownRow {
    shop_id: string;
    usage_date: string;
    feature: string;
    tokens_used: number;
    call_count: number;
    label_mn: string;
    sort_order: number;
}

interface ShopRow {
    id: string;
    name: string | null;
    user_id: string | null;
    token_report_email_enabled: boolean;
    user_profiles?: { email: string | null } | { email: string | null }[] | null;
}

function pickEmail(profiles: ShopRow['user_profiles']): string | null {
    if (!profiles) return null;
    if (Array.isArray(profiles)) return profiles[0]?.email ?? null;
    return profiles.email ?? null;
}

function buildUnsubscribeUrl(shopId: string, cronSecret: string | undefined, appUrl: string): string {
    if (!cronSecret) {
        // Dev fallback — still works locally without a secret
        return `${appUrl}/api/email/unsubscribe?shop=${shopId}`;
    }
    const sig = crypto
        .createHmac('sha256', cronSecret)
        .update(`unsubscribe:${shopId}`)
        .digest('hex');
    return `${appUrl}/api/email/unsubscribe?shop=${shopId}&sig=${sig}`;
}

export async function GET(request: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

        if (process.env.NODE_ENV === 'production' && cronSecret) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const dryRun = new URL(request.url).searchParams.get('dry') === '1';
        const supabase = supabaseAdmin();

        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startDate = periodStart.toISOString().split('T')[0];
        const endDate = periodEnd.toISOString().split('T')[0];

        const { data: breakdown, error: breakdownError } = await supabase
            .from('v_shop_token_breakdown')
            .select('shop_id, usage_date, feature, tokens_used, call_count, label_mn, sort_order')
            .gte('usage_date', startDate);

        if (breakdownError) {
            logger.error('Weekly token report breakdown query failed', { error: breakdownError.message });
            return NextResponse.json({ error: 'Breakdown query failed' }, { status: 500 });
        }

        const rows = (breakdown ?? []) as BreakdownRow[];
        const shopIds = Array.from(new Set(rows.map(r => r.shop_id)));
        if (shopIds.length === 0) {
            return NextResponse.json({ ok: true, sent: 0, skipped: 0, reason: 'no usage in window' });
        }

        const { data: shops, error: shopsError } = await supabase
            .from('shops')
            .select('id, name, user_id, token_report_email_enabled, user_profiles:user_id(email)')
            .in('id', shopIds)
            .eq('is_active', true);

        if (shopsError) {
            logger.error('Weekly token report shops query failed', { error: shopsError.message });
            return NextResponse.json({ error: 'Shops query failed' }, { status: 500 });
        }

        const shopMap = new Map<string, ShopRow>();
        for (const s of (shops ?? []) as ShopRow[]) {
            shopMap.set(s.id, s);
        }

        let sent = 0;
        let skipped = 0;
        const previews: Array<{ shopId: string; to: string; totalTokens: number }> = [];

        // Group breakdown rows by shop and aggregate per feature
        const byShop = new Map<string, BreakdownRow[]>();
        for (const row of rows) {
            const list = byShop.get(row.shop_id) ?? [];
            list.push(row);
            byShop.set(row.shop_id, list);
        }

        for (const [shopId, shopRows] of byShop) {
            const shop = shopMap.get(shopId);
            if (!shop || !shop.token_report_email_enabled) {
                skipped++;
                continue;
            }
            const ownerEmail = pickEmail(shop.user_profiles);
            if (!ownerEmail) {
                skipped++;
                continue;
            }

            const featureMap = new Map<string, TokenReportFeatureRow & { sort: number }>();
            for (const row of shopRows) {
                const existing = featureMap.get(row.feature);
                if (existing) {
                    existing.tokens += row.tokens_used;
                    existing.calls += row.call_count;
                } else {
                    featureMap.set(row.feature, {
                        feature: row.feature,
                        label: row.label_mn,
                        tokens: row.tokens_used,
                        calls: row.call_count,
                        sort: row.sort_order,
                    });
                }
            }

            const aggregated = Array.from(featureMap.values()).sort((a, b) => a.sort - b.sort);
            const totalTokens = aggregated.reduce((s, r) => s + r.tokens, 0);
            const totalCalls = aggregated.reduce((s, r) => s + r.calls, 0);

            // Zero-spam guard
            if (totalTokens <= 0) {
                skipped++;
                continue;
            }

            if (dryRun) {
                previews.push({ shopId, to: ownerEmail, totalTokens });
                continue;
            }

            const ok = await sendTokenUsageReport({
                to: ownerEmail,
                shopName: shop.name || 'Таны дэлгүүр',
                periodStart: startDate,
                periodEnd: endDate,
                totalTokens,
                totalCalls,
                rows: aggregated.map(({ sort: _sort, ...r }) => r),
                unsubscribeUrl: buildUnsubscribeUrl(shopId, cronSecret, appUrl),
                dashboardUrl: `${appUrl}/dashboard/reports?tab=ai`,
            });

            if (ok) sent++;
            else skipped++;
        }

        return NextResponse.json({
            ok: true,
            sent,
            skipped,
            window: { start: startDate, end: endDate },
            ...(dryRun ? { dryRun: true, previews } : {}),
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown';
        logger.error('Weekly token report failed:', { error: errMsg });
        return NextResponse.json({ error: 'Internal error', details: errMsg }, { status: 500 });
    }
}
