'use client';

import {
    TrendingUp,
    TrendingDown,
    Lightbulb,
    AlertTriangle,
    Award,
    Package,
    CalendarCheck,
    type LucideIcon,
} from 'lucide-react';
import { formatCurrencyFull } from '@/lib/utils/format';

type InsightType = 'success' | 'warning' | 'tip' | 'info';

export interface Insight {
    type: InsightType;
    icon: LucideIcon;
    message: string;
    priority: number;
}

interface InsightRevenue {
    total: number;
    growth: number;
    orderCount: number;
    avgOrderValue: number;
    prevPeriodTotal: number;
    unpaidTotal: number;
}

export interface InsightInput {
    bestSellers: Array<{ name: string; quantity: number; revenue: number; percent: number }>;
    revenue: InsightRevenue;
    chartData: Array<{ date: string; revenue: number; label: string }>;
    period: string;
}

/**
 * Pure rule engine — shared by SmartInsights (full list) and RevenueSummary
 * (top takeaway). Returns insights sorted by priority (highest first).
 */
export function computeInsights({ bestSellers, revenue, chartData }: InsightInput): Insight[] {
    const result: Insight[] = [];

    // 1. Revenue growth (three bands)
    if (revenue.growth > 20) {
        result.push({
            type: 'success',
            icon: TrendingUp,
            priority: 90,
            message: `🎉 Борлуулалт ${revenue.growth}% өссөн байна. Энэ хандлагаа барьж, эрэлттэй бараагаа нөөцлөөрэй.`,
        });
    } else if (revenue.growth >= 10) {
        result.push({
            type: 'info',
            icon: TrendingUp,
            priority: 60,
            message: `Борлуулалт ${revenue.growth}% өсөв. Тогтвортой өсөлттэй байна.`,
        });
    } else if (revenue.growth < -10) {
        result.push({
            type: 'warning',
            icon: TrendingDown,
            priority: 95,
            message: `⚠️ Борлуулалт ${Math.abs(revenue.growth)}% буурсан. Хямдрал эсвэл маркетинг хийх цаг болжээ.`,
        });
    }

    // 2. Period-over-period absolute delta (only when prev period has data)
    if (revenue.prevPeriodTotal > 0) {
        const delta = revenue.total - revenue.prevPeriodTotal;
        if (Math.abs(delta) > 0) {
            result.push({
                type: delta >= 0 ? 'info' : 'warning',
                icon: delta >= 0 ? TrendingUp : TrendingDown,
                priority: 50,
                message: `Өмнөх үетэй харьцуулахад ${formatCurrencyFull(Math.abs(delta))}-аар ${delta >= 0 ? 'нэмэгдсэн' : 'буурсан'}.`,
            });
        }
    }

    // 3. Unpaid exposure — meaningful chunk of order value not yet collected
    if (revenue.unpaidTotal > 0) {
        const gross = revenue.total + revenue.unpaidTotal;
        const pct = gross > 0 ? Math.round((revenue.unpaidTotal / gross) * 100) : 0;
        if (revenue.unpaidTotal > revenue.total * 0.15) {
            result.push({
                type: 'warning',
                icon: AlertTriangle,
                priority: 92,
                message: `Төлбөр хүлээгдэж буй ${formatCurrencyFull(revenue.unpaidTotal)} (нийт захиалгын ${pct}%). Баталгаажуулж, орлогоо бүрэн болгохыг санал болгоё.`,
            });
        }
    }

    // 4. Top product concentration
    if (bestSellers.length > 0) {
        const top = bestSellers[0];
        if (top.percent > 40) {
            result.push({
                type: 'info',
                icon: Award,
                priority: 55,
                message: `🏆 "${top.name}" нийт борлуулалтын ${top.percent.toFixed(0)}%-ийг эзэлж байна. Нөөцийг хангалттай байлга.`,
            });
        }
        // 5. Top-3 dominance
        if (bestSellers.length >= 3) {
            const top3 = bestSellers.slice(0, 3).reduce((s, p) => s + p.percent, 0);
            if (top3 > 80) {
                result.push({
                    type: 'tip',
                    icon: Lightbulb,
                    priority: 45,
                    message: `💡 Топ 3 бараа ${top3.toFixed(0)}% эзэлж байна. Бусад бараагаа идэвхжүүлэхийг санал болгоё.`,
                });
            }
        }
    }

    // 6. Best-selling day from the daily revenue chart
    const bestDay = chartData.reduce<{ label: string; revenue: number } | null>((best, d) => {
        if (d.revenue > 0 && (!best || d.revenue > best.revenue)) return { label: d.label, revenue: d.revenue };
        return best;
    }, null);
    if (bestDay) {
        result.push({
            type: 'info',
            icon: CalendarCheck,
            priority: 40,
            message: `Хамгийн өндөр борлуулалт ${bestDay.label} өдөр (${formatCurrencyFull(bestDay.revenue)}).`,
        });
    }

    // 7. Low average order value → bundle tip
    if (revenue.orderCount > 0 && revenue.avgOrderValue < 50000) {
        result.push({
            type: 'tip',
            icon: Package,
            priority: 42,
            message: `💡 Дундаж захиалга ${formatCurrencyFull(revenue.avgOrderValue)}. Багц (bundle) хямдрал санал болговол дундаж дүнг өсгөж болно.`,
        });
    }

    // 8. Fallback when nothing notable
    if (result.length === 0) {
        result.push({
            type: 'info',
            icon: Lightbulb,
            priority: 10,
            message: 'Борлуулалт хэвийн түвшинд байна. Шинэ бараа эсвэл урамшуулал нэмж борлуулалтаа идэвхжүүлээрэй.',
        });
    }

    return result.sort((a, b) => b.priority - a.priority);
}

const toneVar: Record<InsightType, string> = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    tip: 'var(--brand-violet-500)',
    info: 'var(--brand-indigo)',
};

export function SmartInsights(props: InsightInput) {
    const insights = computeInsights(props);

    return (
        <div className="card-outlined overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                <Lightbulb className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Ухаалаг зөвлөмж</span>
            </div>
            <div className="p-5 space-y-2.5">
                {insights.map((insight, idx) => {
                    const color = toneVar[insight.type];
                    const Icon = insight.icon;
                    return (
                        <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                        >
                            <span
                                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
                            >
                                <Icon className="w-4 h-4" strokeWidth={1.8} />
                            </span>
                            <p className="text-[13px] leading-relaxed text-white/70 tracking-[-0.01em]">{insight.message}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
