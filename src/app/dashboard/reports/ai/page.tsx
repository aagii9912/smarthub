'use client';

import { useState } from 'react';
import { useAIStats } from '@/hooks/useAIStats';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    RefreshCw,
    MessageSquare,
    Cpu,
    Phone,
    Mail,
    TrendingUp,
    Users,
    Target,
    BarChart3,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month';

// Simple bar chart component
function MiniBarChart({ data, maxValue }: { data: Array<{ date: string; count: number }>; maxValue: number }) {
    if (data.length === 0) {
        return <div className="text-[12px] text-white/20 text-center py-8">Мэдээлэл байхгүй</div>;
    }

    return (
        <div className="flex items-end gap-1 h-32">
            {data.map((item, i) => {
                const height = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
                const day = new Date(item.date).toLocaleDateString('mn-MN', { weekday: 'short' });
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[9px] text-white/30 tabular-nums">{item.count}</span>
                        <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: '100px' }}>
                            <div
                                className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-violet-600 to-cyan-400 transition-all duration-700 ease-out"
                                style={{ height: `${Math.max(height, 2)}%` }}
                            />
                        </div>
                        <span className="text-[9px] text-white/20">{day}</span>
                    </div>
                );
            })}
        </div>
    );
}

// Intent donut/list component
function IntentBreakdown({ data }: { data: Record<string, number> }) {
    const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);

    if (entries.length === 0) {
        return <div className="text-[12px] text-white/20 text-center py-4">Мэдээлэл байхгүй</div>;
    }

    const intentLabels: Record<string, { label: string; color: string }> = {
        GREETING: { label: 'Мэндчилгээ', color: 'bg-emerald-500' },
        PRODUCT_INQUIRY: { label: 'Бараа сонирхсон', color: 'bg-violet-500' },
        ORDER: { label: 'Захиалга', color: 'bg-blue-500' },
        COMPLAINT: { label: 'Гомдол', color: 'bg-red-500' },
        SUPPORT: { label: 'Тусламж', color: 'bg-amber-500' },
        IMAGE_ANALYSIS: { label: 'Зураг', color: 'bg-cyan-500' },
        BATCHED: { label: 'Нэгтгэсэн', color: 'bg-indigo-500' },
        POSTBACK: { label: 'Товч дарсан', color: 'bg-pink-500' },
        UNKNOWN: { label: 'Бусад', color: 'bg-white/20' },
    };

    return (
        <div className="space-y-2.5">
            {entries.slice(0, 6).map(([intent, count]) => {
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const config = intentLabels[intent] || { label: intent, color: 'bg-white/20' };
                return (
                    <div key={intent}>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${config.color}`} />
                                <span className="text-[12px] text-white/50">{config.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-white/30 tabular-nums">{count}</span>
                                <span className="text-[11px] font-semibold text-foreground tabular-nums w-8 text-right">
                                    {percent}%
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                                className={`h-full rounded-full ${config.color} transition-all duration-700`}
                                style={{ width: `${percent}%` }}
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
    const { data, isLoading, refetch } = useAIStats(period);
    const { t } = useLanguage();

    const periodOptions = [
        { value: 'today' as const, label: t.dashboard.today },
        { value: 'week' as const, label: t.dashboard.week },
        { value: 'month' as const, label: t.dashboard.month },
    ];

    if (isLoading) {
        return (
            <div className="space-y-5">
                <div className="h-6 w-48 bg-[#0F0B2E] rounded animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-28 bg-[#0F0B2E] rounded-lg animate-pulse border border-white/[0.08]" />
                    ))}
                </div>
                <div className="h-80 bg-[#0F0B2E] rounded-lg animate-pulse border border-white/[0.08]" />
            </div>
        );
    }

    const maxDaily = Math.max(...(data?.dailyMessages || []).map(d => d.count), 1);

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-foreground tracking-[-0.02em]">
                    AI Тайлан
                </h1>
                <button
                    onClick={() => refetch()}
                    className="p-1.5 border border-white/[0.08] rounded-md hover:border-white/[0.15] transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5 text-white/40" />
                </button>
            </div>

            {/* Period Filter */}
            <div className="flex gap-1">
                {periodOptions.map(option => (
                    <button
                        key={option.value}
                        onClick={() => setPeriod(option.value)}
                        className={`px-3 py-1.5 rounded-md font-medium text-[12px] transition-all tracking-[-0.01em] ${
                            period === option.value
                                ? 'bg-[#1C1650] text-foreground'
                                : 'text-white/40 hover:bg-[#0F0B2E]'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: MessageSquare, label: 'Нийт мессеж', value: data?.totalMessages || 0, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                    { icon: Users, label: 'Харилцагч', value: data?.totalConversations || 0, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: Phone, label: 'Утас цуглуулсан', value: data?.contactsCollected || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { icon: Target, label: 'Conversion', value: `${data?.conversionRate || 0}%`, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#0F0B2E] rounded-xl border border-white/[0.08] p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                            <stat.icon className={`w-5 h-5 ${stat.color}`} strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-[18px] font-bold text-foreground tabular-nums tracking-[-0.02em]">
                                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                            </p>
                            <p className="text-[11px] text-white/30">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Daily Messages Chart */}
                <div className="lg:col-span-2 bg-[#0F0B2E] rounded-xl border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.08]">
                        <BarChart3 className="w-4 h-4 text-white/20" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Өдрийн мессеж</span>
                    </div>
                    <div className="p-5">
                        <MiniBarChart data={data?.dailyMessages || []} maxValue={maxDaily} />
                    </div>
                </div>

                {/* Intent Breakdown */}
                <div className="bg-[#0F0B2E] rounded-xl border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.08]">
                        <Target className="w-4 h-4 text-white/20" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Intent тархалт</span>
                    </div>
                    <div className="p-5">
                        <IntentBreakdown data={data?.intentBreakdown || {}} />
                    </div>
                </div>
            </div>

            {/* Top Customers */}
            <div className="bg-[#0F0B2E] rounded-xl border border-white/[0.08] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.08]">
                    <Users className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                    <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Идэвхтэй харилцагчид (Top 10)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.06]">
                                <th className="text-left px-5 py-2.5 text-[11px] text-white/30 font-medium">Нэр</th>
                                <th className="text-left px-5 py-2.5 text-[11px] text-white/30 font-medium">Мессеж</th>
                                <th className="text-left px-5 py-2.5 text-[11px] text-white/30 font-medium">Утас</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {(data?.topCustomers || []).map((customer, i) => (
                                <tr key={customer.id} className="hover:bg-[#0D0928] transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center text-[11px] font-bold text-white/40">
                                                {i + 1}
                                            </div>
                                            <span className="text-[13px] text-foreground font-medium">{customer.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="text-[13px] text-foreground font-semibold tabular-nums">{customer.messageCount}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        {customer.phone ? (
                                            <span className="text-[12px] text-emerald-400 font-medium">{customer.phone}</span>
                                        ) : (
                                            <span className="text-[12px] text-white/20">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!data?.topCustomers || data.topCustomers.length === 0) && (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center text-[13px] text-white/20">
                                        Харилцагч байхгүй
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Token Usage Detail */}
            {data?.tokenUsage && (
                <div className="bg-[#0F0B2E] rounded-xl border border-white/[0.08] p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Cpu className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Token хэрэглээ</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-[11px] text-white/30 mb-1">Ашигласан</p>
                            <p className="text-[18px] font-bold text-foreground tabular-nums">
                                {(data.tokenUsage.total / 1_000_000).toFixed(2)}M
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-white/30 mb-1">Лимит</p>
                            <p className="text-[18px] font-bold text-foreground tabular-nums">
                                {(data.tokenUsage.limit / 1_000_000).toFixed(1)}M
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-white/30 mb-1">Үлдсэн</p>
                            <p className="text-[18px] font-bold text-emerald-400 tabular-nums">
                                {(data.tokenUsage.remaining / 1_000_000).toFixed(2)}M
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                data.tokenUsage.percent >= 90 ? 'bg-gradient-to-r from-red-500 to-rose-600'
                                : data.tokenUsage.percent >= 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                : 'bg-gradient-to-r from-emerald-400 to-cyan-500'
                            }`}
                            style={{ width: `${Math.min(data.tokenUsage.percent, 100)}%` }}
                        />
                    </div>
                    <p className="text-[11px] text-white/20 mt-2 tabular-nums">
                        {data.tokenUsage.percent}% ашигласан
                        {data.tokenUsage.resetAt && ` • Дахин тоолно: ${new Date(data.tokenUsage.resetAt).toLocaleDateString('mn-MN')}`}
                    </p>
                </div>
            )}
        </div>
    );
}
