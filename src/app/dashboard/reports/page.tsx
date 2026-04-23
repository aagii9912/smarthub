'use client';
import { logger } from '@/lib/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { BestSellersTable } from '@/components/dashboard/BestSellersTable';
import { RevenueStats } from '@/components/dashboard/RevenueStats';
import { SmartInsights } from '@/components/dashboard/SmartInsights';
import { FeatureGate } from '@/components/FeatureGate';
import { useReports } from '@/hooks/useReports';
import { cn } from '@/lib/utils';
import {
    RefreshCw,
    Download,
    TrendingUp,
    Trophy,
    FileSpreadsheet,
    Package,
    ShoppingCart,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year';

export default function ReportsPage() {
    const [period, setPeriod] = useState<Period>('month');
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');
    const [exporting, setExporting] = useState<string | null>(null);
    const { t } = useLanguage();

    const { data, isLoading, refetch, isRefetching } = useReports(period);

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

    const periodOptions: { value: Period; label: string }[] = [
        { value: 'today', label: t.dashboard.today },
        { value: 'week', label: t.dashboard.week },
        { value: 'month', label: t.dashboard.month },
        { value: 'year', label: 'Year' },
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

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="Борлуулалтын тайлан"
                title={t.reports.title}
                subtitle="Ажиллаж буй дэлгүүрийн гүйцэтгэл, орлого, захиалгуудыг энд танилцуулж байна."
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
                            onClick={() => refetch()}
                            disabled={isRefetching}
                        >
                            <RefreshCw className={cn('h-4 w-4', isRefetching && 'animate-spin')} />
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

            {/* Revenue Stats */}
            {data && (
                <RevenueStats
                    total={data.revenue.total}
                    orderCount={data.revenue.orderCount}
                    avgOrderValue={data.revenue.avgOrderValue}
                    growth={data.revenue.growth}
                    newCustomers={data.customers.new}
                    vipCustomers={data.customers.vip}
                />
            )}

            {/* Smart Insights */}
            {data && (
                <SmartInsights
                    bestSellers={data.bestSellers}
                    revenue={data.revenue}
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
                            <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">{t.reports.title}</span>
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
                        <SalesChart data={data?.chartData || []} type={chartType} height={350} />
                    </div>
                </div>

                {/* Order Status */}
                <div className="card-outlined overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                        <ShoppingCart className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">{t.reports.orders}</span>
                    </div>
                    <div className="p-5 space-y-3">
                        {data && Object.entries(data.orderStatus).map(([status, count]) => (
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
                    <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">{t.reports.products} (Top 10)</span>
                </div>
                <div className="p-5">
                    <BestSellersTable products={data?.bestSellers || []} />
                </div>
            </div>

            {/* Export Section */}
            <FeatureGate feature="excel_export">
                <div className="card-outlined overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                        <FileSpreadsheet className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Excel {t.ui.export}</span>
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
                                        <p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">{item.label}</p>
                                        <p className="text-[11px] text-white/40">Excel файлаар татаж авах</p>
                                    </div>
                                    <Download className={cn('w-4 h-4 text-white/30 shrink-0', exporting === item.type && 'animate-bounce')} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </FeatureGate>
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
