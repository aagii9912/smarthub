'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { BestSellersTable } from '@/components/dashboard/BestSellersTable';
import { RevenueStats } from '@/components/dashboard/RevenueStats';
import { SmartInsights } from '@/components/dashboard/SmartInsights';
import { FeatureGate } from '@/components/FeatureGate';
import { useReports } from '@/hooks/useReports';
import {
    RefreshCw,
    Download,
    TrendingUp,
    Trophy,
    BarChart3,
    FileSpreadsheet,
    Package,
    ShoppingCart,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year';

export default function ReportsPage() {
    const [period, setPeriod] = useState<Period>('month');
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');
    const [exporting, setExporting] = useState<string | null>(null);

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
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(null);
        }
    };

    const periodOptions = [
        { value: 'today', label: 'Өнөөдөр' },
        { value: 'week', label: '7 хоног' },
        { value: 'month', label: 'Сар' },
        { value: 'year', label: 'Жил' },
    ];

    if (isLoading) {
        return (
            <div className="space-y-5">
                <div className="h-6 w-48 bg-[#0F0B2E] rounded animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-[#0F0B2E] rounded-lg animate-pulse border border-white/[0.08]" />
                    ))}
                </div>
                <div className="h-80 bg-[#0F0B2E] rounded-lg animate-pulse border border-white/[0.08]" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex items-center justify-end gap-2">
                <button
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className="p-1.5 border border-white/[0.08] rounded-md hover:border-white/[0.15] transition-colors"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${isRefetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Period Filter */}
            <div className="flex gap-1">
                {periodOptions.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setPeriod(option.value as Period)}
                        className={`px-3 py-1.5 rounded-md font-medium text-[12px] transition-all tracking-[-0.01em] ${period === option.value
                            ? 'bg-[#1C1650] text-foreground'
                            : 'text-white/40 hover:bg-[#0F0B2E]'
                            }`}
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
                <div className="lg:col-span-2 bg-[#0F0B2E] rounded-lg border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-white/20" strokeWidth={1.5} />
                            <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Борлуулалтын график</span>
                        </div>
                        <div className="flex gap-0.5">
                            <button
                                onClick={() => setChartType('line')}
                                className={`px-2.5 py-1 text-[11px] rounded-md tracking-[-0.01em] transition-colors ${chartType === 'line'
                                    ? 'bg-[#1C1650] text-foreground font-medium'
                                    : 'text-white/40 hover:text-foreground'
                                    }`}
                            >
                                Line
                            </button>
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-2.5 py-1 text-[11px] rounded-md tracking-[-0.01em] transition-colors ${chartType === 'bar'
                                    ? 'bg-[#1C1650] text-foreground font-medium'
                                    : 'text-white/40 hover:text-foreground'
                                    }`}
                            >
                                Bar
                            </button>
                        </div>
                    </div>
                    <div className="p-5">
                        <SalesChart
                            data={data?.chartData || []}
                            type={chartType}
                            height={350}
                        />
                    </div>
                </div>

                {/* Order Status */}
                <div className="bg-[#0F0B2E] rounded-lg border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.08]">
                        <ShoppingCart className="w-4 h-4 text-white/20" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Захиалгын төлөв</span>
                    </div>
                    <div className="p-5 space-y-3">
                        {data && Object.entries(data.orderStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <span className="text-[13px] text-white/50 tracking-[-0.01em]">
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
            <div className="bg-[#0F0B2E] rounded-lg border border-white/[0.08] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.08]">
                    <Trophy className="w-4 h-4 text-[#4A7CE7]" strokeWidth={1.5} />
                    <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Эрэлттэй бүтээгдэхүүн (Top 10)</span>
                </div>
                <div className="p-5">
                    <BestSellersTable products={data?.bestSellers || []} />
                </div>
            </div>

            {/* Export Section */}
            <FeatureGate feature="excel_export">
                <div className="bg-[#0F0B2E] rounded-lg border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.08]">
                        <FileSpreadsheet className="w-4 h-4 text-white/20" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Excel Экспорт</span>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { type: 'orders' as const, label: 'Захиалгууд', desc: 'Бүх захиалгын жагсаалт', icon: ShoppingCart },
                                { type: 'products' as const, label: 'Бүтээгдэхүүн', desc: 'Бүх барааны жагсаалт', icon: Package },
                                { type: 'sales' as const, label: 'Борлуулалт', desc: 'Сүүлийн 30 хоногийн', icon: TrendingUp },
                            ].map((item) => (
                                <button
                                    key={item.type}
                                    onClick={() => handleExport(item.type)}
                                    disabled={exporting !== null}
                                    className="flex items-center gap-3 p-4 bg-[#0D0928] hover:bg-[#0F0B2E] rounded-md border border-white/[0.04] transition-colors disabled:opacity-50 text-left"
                                >
                                    <item.icon className="w-5 h-5 text-white/20 shrink-0" strokeWidth={1.5} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">{item.label}</p>
                                        <p className="text-[11px] text-white/40">{item.desc}</p>
                                    </div>
                                    <Download className={`w-3.5 h-3.5 text-white/20 shrink-0 ${exporting === item.type ? 'animate-bounce' : ''}`} />
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
        confirmed: 'Баталгаажсан',
        processing: 'Боловсруулж байна',
        shipped: 'Хүргэлтэнд',
        delivered: 'Хүргэгдсэн',
        cancelled: 'Цуцлагдсан',
    };
    return statusMap[status] || status;
}
