'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { BestSellersTable } from '@/components/dashboard/BestSellersTable';
import { RevenueStats } from '@/components/dashboard/RevenueStats';
import { SmartInsights } from '@/components/dashboard/SmartInsights';
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
            <div className="space-y-6">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
                <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        Тайлан & Статистик
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Бизнесийн дэлгэрэнгүй тайлан, анализ
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        variant="secondary"
                        size="sm"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                        Шинэчлэх
                    </Button>
                </div>
            </div>

            {/* Period Filter */}
            <div className="flex flex-wrap gap-2">
                {periodOptions.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => setPeriod(option.value as Period)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${period === option.value
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Борлуулалтын график
                        </CardTitle>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setChartType('line')}
                                className={`px-3 py-1 text-xs rounded-md ${chartType === 'line' ? 'bg-primary text-white' : 'bg-gray-100'
                                    }`}
                            >
                                Line
                            </button>
                            <button
                                onClick={() => setChartType('bar')}
                                className={`px-3 py-1 text-xs rounded-md ${chartType === 'bar' ? 'bg-primary text-white' : 'bg-gray-100'
                                    }`}
                            >
                                Bar
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SalesChart
                            data={data?.chartData || []}
                            type={chartType}
                            height={350}
                        />
                    </CardContent>
                </Card>

                {/* Order Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            Захиалгын төлөв
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data && Object.entries(data.orderStatus).map(([status, count]) => (
                                <div key={status} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 capitalize">
                                        {translateStatus(status)}
                                    </span>
                                    <span className={`
                    px-2 py-0.5 rounded-full text-xs font-medium
                    ${status === 'delivered' ? 'bg-green-100 text-green-700' : ''}
                    ${status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                    ${status === 'processing' || status === 'confirmed' ? 'bg-blue-100 text-blue-700' : ''}
                    ${status === 'shipped' ? 'bg-purple-100 text-purple-700' : ''}
                  `}>
                                        {count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Best Sellers */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Эрэлттэй бүтээгдэхүүн (Top 10)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <BestSellersTable products={data?.bestSellers || []} />
                </CardContent>
            </Card>

            {/* Export Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Excel Экспорт
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                            onClick={() => handleExport('orders')}
                            disabled={exporting !== null}
                            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-gray-900">Захиалгууд</p>
                                <p className="text-xs text-gray-500">Бүх захиалгын жагсаалт</p>
                            </div>
                            <Download className={`w-4 h-4 ml-auto text-gray-400 ${exporting === 'orders' ? 'animate-bounce' : ''}`} />
                        </button>

                        <button
                            onClick={() => handleExport('products')}
                            disabled={exporting !== null}
                            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-gray-900">Бүтээгдэхүүн</p>
                                <p className="text-xs text-gray-500">Бүх барааны жагсаалт</p>
                            </div>
                            <Download className={`w-4 h-4 ml-auto text-gray-400 ${exporting === 'products' ? 'animate-bounce' : ''}`} />
                        </button>

                        <button
                            onClick={() => handleExport('sales')}
                            disabled={exporting !== null}
                            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-gray-900">Борлуулалт</p>
                                <p className="text-xs text-gray-500">Сүүлийн 30 хоногийн</p>
                            </div>
                            <Download className={`w-4 h-4 ml-auto text-gray-400 ${exporting === 'sales' ? 'animate-bounce' : ''}`} />
                        </button>
                    </div>
                </CardContent>
            </Card>
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
