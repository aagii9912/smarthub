'use client';
import { logger } from '@/lib/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { BestSellersTable } from '@/components/dashboard/BestSellersTable';
import { RevenueStats } from '@/components/dashboard/RevenueStats';
import { SmartInsights } from '@/components/dashboard/SmartInsights';
import { FeatureGate } from '@/components/FeatureGate';
import { useReports } from '@/hooks/useReports';
import { useAIStats } from '@/hooks/useAIStats';
import { cn } from '@/lib/utils';
import {
    RefreshCw,
    Download,
    TrendingUp,
    Trophy,
    FileSpreadsheet,
    Package,
    ShoppingCart,
    Sparkles,
    MessageSquare,
    Cpu,
    Phone,
    Users,
    Target,
    BarChart3,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year';
type ReportTab = 'sales' | 'ai';

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

// Simple bar chart component for AI daily messages
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
                                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
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

export default function ReportsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage();

    const initialTab: ReportTab = searchParams?.get('tab') === 'ai' ? 'ai' : 'sales';
    const [activeTab, setActiveTab] = useState<ReportTab>(initialTab);
    const [period, setPeriod] = useState<Period>('month');
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');
    const [exporting, setExporting] = useState<string | null>(null);
    const [aiRefreshing, setAiRefreshing] = useState(false);

    // Sync tab with URL for deep links
    useEffect(() => {
        const tabParam = searchParams?.get('tab');
        const normalized: ReportTab = tabParam === 'ai' ? 'ai' : 'sales';
        if (normalized !== activeTab) {
            setActiveTab(normalized);
        }
    }, [searchParams, activeTab]);

    const changeTab = (next: ReportTab) => {
        setActiveTab(next);
        const params = new URLSearchParams(searchParams?.toString() || '');
        if (next === 'ai') {
            params.set('tab', 'ai');
        } else {
            params.delete('tab');
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    // For AI tab, period is limited to today/week/month (hook supports these)
    const aiPeriod: 'today' | 'week' | 'month' = period === 'year' ? 'month' : period;

    const { data: salesData, isLoading: salesLoading, refetch: refetchSales, isRefetching: salesRefetching } = useReports(period);
    const { data: aiData, isLoading: aiLoading, refetch: refetchAI } = useAIStats(aiPeriod);

    const handleExport = async (type: 'orders' | 'products' | 'sales') => {
        setExporting(type);
        try {
            const res = await fetch(`/api/dashboard/export/excel?type=${type}`);
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_export.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: unknown) {
            logger.error('Export error:', { error: error });
        } finally {
            setExporting(null);
        }
    };

    const handleRefresh = async () => {
        if (activeTab === 'ai') {
            setAiRefreshing(true);
            try {
                await refetchAI();
            } finally {
                setAiRefreshing(false);
            }
        } else {
            refetchSales();
        }
    };

    const periodOptions: { value: Period; label: string }[] =
        activeTab === 'ai'
            ? [
                  { value: 'today', label: t.dashboard.today },
                  { value: 'week', label: t.dashboard.week },
                  { value: 'month', label: t.dashboard.month },
              ]
            : [
                  { value: 'today', label: t.dashboard.today },
                  { value: 'week', label: t.dashboard.week },
                  { value: 'month', label: t.dashboard.month },
                  { value: 'year', label: 'Year' },
              ];

    const tabs: { id: ReportTab; label: string; icon: typeof BarChart3 }[] = [
        { id: 'sales', label: 'Борлуулалт', icon: BarChart3 },
        { id: 'ai', label: 'AI тайлан', icon: Sparkles },
    ];

    const isLoadingCurrent = activeTab === 'sales' ? salesLoading : aiLoading;
    const isRefreshing = activeTab === 'sales' ? salesRefetching : aiRefreshing;

    const maxDaily = Math.max(...(aiData?.dailyMessages || []).map((d) => d.count), 1);

    const aiStatCards: {
        icon: typeof MessageSquare;
        label: string;
        value: string | number;
        tone: IntentTone;
        featured?: boolean;
    }[] = [
        {
            icon: MessageSquare,
            label: 'Нийт мессеж',
            value: aiData?.totalMessages || 0,
            tone: 'violet',
            featured: true,
        },
        { icon: Users, label: 'Харилцагч', value: aiData?.totalConversations || 0, tone: 'indigo' },
        { icon: Phone, label: 'Утас цуглуулсан', value: aiData?.contactsCollected || 0, tone: 'emerald' },
        {
            icon: Target,
            label: 'Conversion',
            value: `${aiData?.conversionRate || 0}%`,
            tone: 'amber',
        },
    ];

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="Нэгдсэн тайлан"
                title={t.reports.title}
                subtitle="Борлуулалт болон AI агентын гүйцэтгэлийг нэг дор харуулна."
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
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                        </Button>
                    </>
                }
            />

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1 w-fit">
                {tabs.map((tab) => {
                    const active = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => changeTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-medium tracking-[-0.01em] transition-all',
                                active
                                    ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-foreground shadow-[inset_0_0_0_1px_var(--border-accent)]'
                                    : 'text-white/50 hover:text-white'
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

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

            {/* Loading skeleton */}
            {isLoadingCurrent && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-28 card-outlined animate-pulse" />
                        ))}
                    </div>
                    <div className="h-80 card-outlined animate-pulse" />
                </div>
            )}

            {/* ─────────── Sales Tab ─────────── */}
            {!isLoadingCurrent && activeTab === 'sales' && (
                <>
                    {/* Revenue Stats */}
                    {salesData && (
                        <RevenueStats
                            total={salesData.revenue.total}
                            orderCount={salesData.revenue.orderCount}
                            avgOrderValue={salesData.revenue.avgOrderValue}
                            growth={salesData.revenue.growth}
                            newCustomers={salesData.customers.new}
                            vipCustomers={salesData.customers.vip}
                        />
                    )}

                    {/* Smart Insights */}
                    {salesData && (
                        <SmartInsights
                            bestSellers={salesData.bestSellers}
                            revenue={salesData.revenue}
                            period={period}
                        />
                    )}

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Sales Chart */}
                        <div className="lg:col-span-2 card-outlined overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                    <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                        {t.reports.title}
                                    </span>
                                </div>
                                <div className="flex gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
                                    <button
                                        onClick={() => setChartType('line')}
                                        className={cn(
                                            'px-3 py-1 text-[11px] rounded-md tracking-[-0.01em] transition-colors',
                                            chartType === 'line'
                                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-foreground font-medium'
                                                : 'text-white/45 hover:text-foreground'
                                        )}
                                    >
                                        Line
                                    </button>
                                    <button
                                        onClick={() => setChartType('bar')}
                                        className={cn(
                                            'px-3 py-1 text-[11px] rounded-md tracking-[-0.01em] transition-colors',
                                            chartType === 'bar'
                                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-foreground font-medium'
                                                : 'text-white/45 hover:text-foreground'
                                        )}
                                    >
                                        Bar
                                    </button>
                                </div>
                            </div>
                            <div className="p-5">
                                <SalesChart data={salesData?.chartData || []} type={chartType} height={350} />
                            </div>
                        </div>

                        {/* Order Status */}
                        <div className="card-outlined overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                                <ShoppingCart className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                    {t.reports.orders}
                                </span>
                            </div>
                            <div className="p-5 space-y-3">
                                {salesData &&
                                    Object.entries(salesData.orderStatus).map(([status, count]) => (
                                        <div key={status} className="flex items-center justify-between">
                                            <span className="text-[13px] text-white/55 tracking-[-0.01em]">
                                                {translateStatus(status)}
                                            </span>
                                            <span className="text-[13px] font-semibold text-foreground tabular-nums">
                                                {count as number}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* Best Sellers */}
                    <div className="card-outlined overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                            <Trophy className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                            <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                {t.reports.products} (Top 10)
                            </span>
                        </div>
                        <div className="p-5">
                            <BestSellersTable products={salesData?.bestSellers || []} />
                        </div>
                    </div>

                    {/* Export Section */}
                    <FeatureGate feature="excel_export">
                        <div className="card-outlined overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                                <FileSpreadsheet className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                    Excel {t.ui.export}
                                </span>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { type: 'orders' as const, label: t.reports.orders, icon: ShoppingCart },
                                        { type: 'products' as const, label: t.reports.products, icon: Package },
                                        { type: 'sales' as const, label: t.reports.revenue, icon: TrendingUp },
                                    ].map((item) => (
                                        <button
                                            key={item.type}
                                            onClick={() => handleExport(item.type)}
                                            disabled={exporting !== null}
                                            className="flex items-center gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-all disabled:opacity-50 text-left group"
                                        >
                                            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo-400)] shrink-0 transition-colors group-hover:bg-[color-mix(in_oklab,var(--brand-indigo)_28%,transparent)]">
                                                <item.icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">
                                                    {item.label}
                                                </p>
                                                <p className="text-[11px] text-white/40">Excel файлаар татаж авах</p>
                                            </div>
                                            <Download
                                                className={cn(
                                                    'w-4 h-4 text-white/30 shrink-0',
                                                    exporting === item.type && 'animate-bounce'
                                                )}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </FeatureGate>
                </>
            )}

            {/* ─────────── AI Tab ─────────── */}
            {!isLoadingCurrent && activeTab === 'ai' && (
                <>
                    {/* AI Summary Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {aiStatCards.map((stat, i) => {
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

                    {/* AI Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 card-outlined overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                                <BarChart3 className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                    Өдрийн мессеж
                                </span>
                            </div>
                            <div className="p-5">
                                <MiniBarChart data={aiData?.dailyMessages || []} maxValue={maxDaily} />
                            </div>
                        </div>

                        <div className="card-outlined overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                                <Target className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                                    Intent тархалт
                                </span>
                            </div>
                            <div className="p-5">
                                <IntentBreakdown data={aiData?.intentBreakdown || {}} />
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
                                    {(aiData?.topCustomers || []).map((customer, i) => (
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
                                    ))}
                                    {(!aiData?.topCustomers || aiData.topCustomers.length === 0) && (
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

                    {/* Credit Usage */}
                    {aiData?.creditUsage &&
                        (() => {
                            const pct = aiData.creditUsage.percent;
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
                                                <p className="text-[11px] text-white/45 mb-1 tracking-[-0.01em]">
                                                    Ашигласан
                                                </p>
                                                <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                                                    {aiData.creditUsage.used.toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-white/45 mb-1 tracking-[-0.01em]">
                                                    Лимит
                                                </p>
                                                <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                                                    {aiData.creditUsage.limit.toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-white/45 mb-1 tracking-[-0.01em]">Үлдсэн</p>
                                                <p
                                                    className="text-[20px] font-semibold tabular-nums tracking-[-0.02em]"
                                                    style={{ color: usageColor }}
                                                >
                                                    {aiData.creditUsage.remaining.toLocaleString()}
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
                                            {aiData.creditUsage.resetAt &&
                                                ` • Дахин тоолно: ${new Date(
                                                    aiData.creditUsage.resetAt
                                                ).toLocaleDateString('mn-MN')}`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                </>
            )}
        </div>
    );
}

function translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
        pending: 'Хүлээгдэж буй',
        confirmed: 'Төлбөр төлөгдсөн',
        processing: 'Бэлтгэж буй',
        shipped: 'Хүргэлтэнд',
        delivered: 'Хүргэгдсэн',
        cancelled: 'Цуцлагдсан',
    };
    return statusMap[status] || status;
}
