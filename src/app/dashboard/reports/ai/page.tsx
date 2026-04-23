'use client';

import { useState } from 'react';
import { useAIStats } from '@/hooks/useAIStats';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { cn } from '@/lib/utils';
import {
    RefreshCw,
    MessageSquare,
    Cpu,
    Phone,
    Users,
    Target,
    BarChart3,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month';

type IntentTone = 'indigo' | 'violet' | 'cyan' | 'emerald' | 'rose' | 'amber' | 'gold' | 'neutral';

const INTENT_CONFIG: Record<string, { label: string; tone: IntentTone }> = {
    GREETING: { label: 'Мэндчилгээ', tone: 'emerald' },
    PRODUCT_INQUIRY: { label: 'Бараа сонирхсон', tone: 'violet' },
    ORDER: { label: 'Захиалга', tone: 'indigo' },
    COMPLAINT: { label: 'Гомдол', tone: 'rose' },
    SUPPORT: { label: 'Тусламж', tone: 'amber' },
    IMAGE_ANALYSIS: { label: 'Зураг', tone: 'cyan' },
    BATCHED: { label: 'Нэгтгэсэн', tone: 'indigo' },
    POSTBACK: { label: 'Товч дарсан', tone: 'gold' },
    UNKNOWN: { label: 'Бусад', tone: 'neutral' },
};

function toneVar(tone: IntentTone): string {
    switch (tone) {
        case 'indigo':
            return 'var(--brand-indigo)';
        case 'violet':
            return 'var(--brand-violet-500)';
        case 'cyan':
            return 'var(--brand-cyan)';
        case 'emerald':
            return 'var(--success)';
        case 'rose':
            return 'var(--destructive)';
        case 'amber':
            return 'var(--warning)';
        case 'gold':
            return 'var(--gold)';
        case 'neutral':
        default:
            return 'rgba(255,255,255,0.45)';
    }
}

// Simple bar chart component
function MiniBarChart({ data, maxValue }: { data: Array<{ date: string; count: number }>; maxValue: number }) {
    if (data.length === 0) {
        return <div className="text-[12px] text-white/30 text-center py-8">Мэдээлэл байхгүй</div>;
    }

    return (
        <div className="flex items-end gap-1 h-36">
            {data.map((item, i) => {
                const height = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
                const day = new Date(item.date).toLocaleDateString('mn-MN', { weekday: 'short' });
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[10px] text-white/40 tabular-nums">{item.count}</span>
                        <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: '110px' }}>
                            <div
                                className="absolute bottom-0 w-full rounded-t-md transition-all duration-700 ease-out"
                                style={{
                                    height: `${Math.max(height, 2)}%`,
                                    background:
                                        'linear-gradient(to top, var(--brand-indigo) 0%, var(--brand-violet-500) 60%, var(--brand-cyan) 100%)',
                                }}
                            />
                        </div>
                        <span className="text-[10px] text-white/35">{day}</span>
                    </div>
                );
            })}
        </div>
    );
}

// Intent list component
function IntentBreakdown({ data }: { data: Record<string, number> }) {
    const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);

    if (entries.length === 0) {
        return <div className="text-[12px] text-white/30 text-center py-4">Мэдээлэл байхгүй</div>;
    }

    return (
        <div className="space-y-3">
            {entries.slice(0, 6).map(([intent, count]) => {
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const config = INTENT_CONFIG[intent] || { label: intent, tone: 'neutral' as IntentTone };
                const color = toneVar(config.tone);
                return (
                    <div key={intent}>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: color }}
                                />
                                <span className="text-[12px] text-white/65 tracking-[-0.01em]">{config.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-white/40 tabular-nums">{count}</span>
                                <span className="text-[11px] font-semibold text-foreground tabular-nums w-8 text-right">
                                    {percent}%
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${percent}%`, background: color }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function AIReportPage() {
    const [period, setPeriod] = useState<Period>('month');
    const [refreshing, setRefreshing] = useState(false);
    const { data, isLoading, refetch } = useAIStats(period);
    const { t } = useLanguage();

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    };

    const periodOptions: { value: Period; label: string }[] = [
        { value: 'today', label: t.dashboard.today },
        { value: 'week', label: t.dashboard.week },
        { value: 'month', label: t.dashboard.month },
    ];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 card-outlined animate-pulse" />
                    ))}
                </div>
                <div className="h-80 card-outlined animate-pulse" />
            </div>
        );
    }

    const maxDaily = Math.max(...(data?.dailyMessages || []).map((d: { date: string; count: number }) => d.count), 1);

    const statCards: {
        icon: typeof MessageSquare;
        label: string;
        value: string | number;
        tone: IntentTone;
        featured?: boolean;
    }[] = [
        {
            icon: MessageSquare,
            label: 'Нийт мессеж',
            value: data?.totalMessages || 0,
            tone: 'violet',
            featured: true,
        },
        { icon: Users, label: 'Харилцагч', value: data?.totalConversations || 0, tone: 'indigo' },
        { icon: Phone, label: 'Утас цуглуулсан', value: data?.contactsCollected || 0, tone: 'emerald' },
        {
            icon: Target,
            label: 'Conversion',
            value: `${data?.conversionRate || 0}%`,
            tone: 'amber',
        },
    ];

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="AI гүйцэтгэл"
                title="AI Тайлан"
                subtitle="AI агент таны харилцагчдад хэрхэн үйлчилж, ямар үр дүн өгч байгааг нэг дор харуулна."
                actions={
                    <>
                        <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1">
                            {periodOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setPeriod(option.value)}
                                    className={cn(
                                        'px-3.5 py-1.5 rounded-full text-[12px] font-medium tracking-[-0.01em] transition-all',
                                        period === option.value
                                            ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-foreground shadow-[inset_0_0_0_1px_var(--border-accent)]'
                                            : 'text-white/50 hover:text-white'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Refresh"
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                        </Button>
                    </>
                }
            />

            {/* Mobile period toggle */}
            <div className="flex md:hidden items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1 w-fit">
                {periodOptions.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setPeriod(option.value)}
                        className={cn(
                            'px-3.5 py-1.5 rounded-full text-[12px] font-medium tracking-[-0.01em] transition-all',
                            period === option.value
                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-foreground'
                                : 'text-white/50'
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map((stat, i) => {
                    const color = toneVar(stat.tone);
                    return (
                        <div
                            key={i}
                            className={cn(
                                'p-4 flex items-center gap-3 overflow-hidden',
                                stat.featured ? 'card-featured' : 'card-outlined'
                            )}
                        >
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: `color-mix(in oklab, ${color} 18%, transparent)`,
                                    color,
                                }}
                            >
                                <stat.icon className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                                </p>
                                <p className="text-[11px] text-white/45 tracking-[-0.01em]">{stat.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Daily Messages Chart */}
                <div className="lg:col-span-2 card-outlined overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                        <BarChart3 className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Өдрийн мессеж</span>
                    </div>
                    <div className="p-5">
                        <MiniBarChart data={data?.dailyMessages || []} maxValue={maxDaily} />
                    </div>
                </div>

                {/* Intent Breakdown */}
                <div className="card-outlined overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                        <Target className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Intent тархалт</span>
                    </div>
                    <div className="p-5">
                        <IntentBreakdown data={data?.intentBreakdown || {}} />
                    </div>
                </div>
            </div>

            {/* Top Customers */}
            <div className="card-outlined overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                    <Users className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                        Идэвхтэй харилцагчид (Top 10)
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                                <th className="text-left px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-white/40 font-medium">
                                    Нэр
                                </th>
                                <th className="text-left px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-white/40 font-medium">
                                    Мессеж
                                </th>
                                <th className="text-left px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-white/40 font-medium">
                                    Утас
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {(data?.topCustomers || []).map(
                                (
                                    customer: { id: string; name: string; messageCount: number; phone?: string | null },
                                    i: number
                                ) => (
                                    <tr key={customer.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div
                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                                                    style={{
                                                        background:
                                                            'linear-gradient(135deg, color-mix(in oklab, var(--brand-indigo) 28%, transparent), color-mix(in oklab, var(--brand-violet-500) 26%, transparent))',
                                                        color: 'var(--brand-indigo-400)',
                                                    }}
                                                >
                                                    {i + 1}
                                                </div>
                                                <span className="text-[13px] text-foreground font-medium tracking-[-0.01em]">
                                                    {customer.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-[13px] text-foreground font-semibold tabular-nums">
                                                {customer.messageCount}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {customer.phone ? (
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums"
                                                    style={{
                                                        background:
                                                            'color-mix(in oklab, var(--success) 16%, transparent)',
                                                        color: 'var(--success)',
                                                    }}
                                                >
                                                    <Phone className="w-3 h-3" strokeWidth={2} />
                                                    {customer.phone}
                                                </span>
                                            ) : (
                                                <span className="text-[12px] text-white/25">—</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            )}
                            {(!data?.topCustomers || data.topCustomers.length === 0) && (
                                <tr>
                                    <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-white/30">
                                        Харилцагч байхгүй
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Credit Usage Detail */}
            {data?.creditUsage && (() => {
                const pct = data.creditUsage.percent;
                const usageTone: IntentTone = pct >= 90 ? 'rose' : pct >= 70 ? 'amber' : 'emerald';
                const usageColor = toneVar(usageTone);
                return (
                    <div className="card-outlined overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                            <Cpu className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                            <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                AI Credit хэрэглээ
                            </span>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[11px] text-white/45 mb-1 tracking-[-0.01em]">Ашигласан</p>
                                    <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                                        {data.creditUsage.used.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-white/45 mb-1 tracking-[-0.01em]">Лимит</p>
                                    <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                                        {data.creditUsage.limit.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-white/45 mb-1 tracking-[-0.01em]">Үлдсэн</p>
                                    <p
                                        className="text-[20px] font-semibold tabular-nums tracking-[-0.02em]"
                                        style={{ color: usageColor }}
                                    >
                                        {data.creditUsage.remaining.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${Math.min(pct, 100)}%`,
                                        background: `linear-gradient(90deg, ${usageColor}, color-mix(in oklab, ${usageColor} 70%, white 0%))`,
                                    }}
                                />
                            </div>
                            <p className="text-[11px] text-white/40 mt-3 tabular-nums tracking-[-0.01em]">
                                {pct}% ашигласан • 1 credit ≈ 1000 token
                                {data.creditUsage.resetAt &&
                                    ` • Дахин тоолно: ${new Date(data.creditUsage.resetAt).toLocaleDateString('mn-MN')}`}
                            </p>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
