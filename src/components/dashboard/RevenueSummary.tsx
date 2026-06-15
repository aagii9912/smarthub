'use client';

import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { computeInsights, type InsightInput } from './SmartInsights';
import { formatCurrencyFull } from '@/lib/utils/format';

function headlinePeriod(period: string): string {
    switch (period) {
        case 'today': return 'Өнөөдөр';
        case 'week': return 'Энэ 7 хоног';
        case 'month': return 'Энэ сар';
        case 'year': return 'Сүүлийн жил'; // route нь rolling-365 ашигладаг
        default: return 'Энэ үе';
    }
}

export function RevenueSummary(props: InsightInput) {
    const { revenue, period } = props;
    const { total, growth, prevPeriodTotal } = revenue;
    const periodLabel = headlinePeriod(period);

    // Headline — growth-ийн тэмдэг ба prev=0 ирмэгийг зөв илэрхийлнэ
    let headline: string;
    let tone: 'up' | 'down' | 'flat';
    if (prevPeriodTotal === 0 && total > 0) {
        headline = `${periodLabel} ${formatCurrencyFull(total)} орлоготой эхэллээ`;
        tone = 'up';
    } else if (growth > 0) {
        headline = `${periodLabel} борлуулалт ${growth}%-аар өслөө`;
        tone = 'up';
    } else if (growth < 0) {
        headline = `${periodLabel} борлуулалт ${Math.abs(growth)}%-аар буурлаа`;
        tone = 'down';
    } else {
        headline = `${periodLabel} борлуулалт өмнөх үетэй ойролцоо`;
        tone = 'flat';
    }

    const toneColor = tone === 'up' ? 'var(--success)' : tone === 'down' ? 'var(--destructive)' : 'var(--brand-indigo)';
    const TrendIcon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus;

    const takeaway = computeInsights(props)[0];
    const delta = total - prevPeriodTotal;

    return (
        <div className="card-featured p-5">
            <div className="flex items-start gap-3">
                <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${toneColor} 18%, transparent)`, color: toneColor }}
                >
                    <TrendIcon className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold text-foreground tracking-[-0.02em]">{headline}</p>
                    {prevPeriodTotal > 0 && (
                        <p className="mt-0.5 text-[12px] text-white/45 tabular-nums">
                            {formatCurrencyFull(total)}
                            <span className="text-white/30"> vs өмнөх {formatCurrencyFull(prevPeriodTotal)}</span>
                            <span style={{ color: toneColor }}> ({delta >= 0 ? '+' : '−'}{formatCurrencyFull(Math.abs(delta))})</span>
                        </p>
                    )}
                </div>
            </div>

            {takeaway && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-violet-500)]" strokeWidth={1.8} />
                    <p className="text-[13px] leading-relaxed text-white/70 tracking-[-0.01em]">{takeaway.message}</p>
                </div>
            )}
        </div>
    );
}
