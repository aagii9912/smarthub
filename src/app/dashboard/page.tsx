'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/hooks/useDashboard';
import { formatTimeAgo } from '@/lib/utils/date';
import {
    ShoppingCart,
    Users,
    TrendingUp,
    Package,
    Clock,
    ArrowRight,
    RefreshCw,
    Facebook,
    Calendar,
    ChevronDown,
} from 'lucide-react';

export default function DashboardPage() {
    const { user, shop, loading: authLoading } = useAuth();
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');

    const { data, isLoading, refetch, isRefetching } = useDashboard(timeFilter);

    const stats = data?.stats || { todayOrders: 0, pendingOrders: 0, totalRevenue: 0, totalCustomers: 0 };
    const recentOrders = data?.recentOrders || [];
    const activeConversations = data?.activeConversations || [];
    const lowStockProducts = data?.lowStockProducts || [];
    const unansweredCount = data?.unansweredCount || 0;

    if (isLoading || authLoading) {
        return <DashboardSkeleton />;
    }

    const handleRefresh = async () => {
        await refetch();
    };

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-4 md:space-y-6">
                {/* Page Title */}
                {/* Page Title */}
                {/* Compact Action Toolbar */}
                <div className="flex items-center justify-end gap-2 mb-2">
                    {/* Time Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => document.getElementById('time-filter-dropdown')?.classList.toggle('hidden')}
                            onBlur={() => setTimeout(() => document.getElementById('time-filter-dropdown')?.classList.add('hidden'), 200)}
                            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {timeFilter === 'today' ? 'Өнөөдөр' : timeFilter === 'week' ? '7 хоног' : 'Сар'}
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>
                        <div id="time-filter-dropdown" className="hidden absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-10 overflow-hidden">
                            {[
                                { value: 'today', label: 'Өнөөдөр' },
                                { value: 'week', label: '7 хоног' },
                                { value: 'month', label: 'Сар' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setTimeFilter(option.value as 'today' | 'week' | 'month')}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${timeFilter === option.value ? 'text-primary font-medium bg-primary/5' : 'text-gray-700'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Refresh Button */}
                    <Button
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 bg-white border border-gray-200"
                        title="Шинэчлэх"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefetching ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <StatsCard
                        title="Өнөөдөр"
                        value={stats.todayOrders.toString()}
                        icon={ShoppingCart}
                        iconColor="bg-[#65c51a]"
                    />
                    <StatsCard
                        title="Орлого"
                        value={stats.totalRevenue >= 1000000
                            ? `₮${(stats.totalRevenue / 1000000).toFixed(1)}M`
                            : `₮${stats.totalRevenue.toLocaleString()}`}
                        icon={TrendingUp}
                        iconColor="bg-[#65c51a]"
                    />
                    <StatsCard
                        title="Харилцагч"
                        value={stats.totalCustomers.toString()}
                        icon={Users}
                        iconColor="bg-[#65c51a]"
                    />
                    <StatsCard
                        title="Хүлээгдэж буй"
                        value={stats.pendingOrders.toString()}
                        icon={Clock}
                        iconColor="bg-[#f59e0b]"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Orders */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between py-3 md:py-4">
                                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                    Сүүлийн захиалгууд
                                </CardTitle>
                                <Link href="/dashboard/orders">
                                    <Button variant="ghost" size="sm" className="h-8 text-xs md:text-sm">
                                        Бүгдийг <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-1" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {recentOrders.length > 0 ? recentOrders.slice(0, 5).map((order: any) => {
                                        const customerName = order.customers?.name || 'Харилцагч';
                                        const productName = order.order_items?.[0]?.products?.name || 'Бүтээгдэхүүн';
                                        return (
                                            <Link
                                                key={order.id}
                                                href="/dashboard/orders"
                                                className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors block"
                                            >
                                                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                                                        <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm md:text-base text-[#111111] truncate">{productName}</p>
                                                        <p className="text-xs text-[#6c757d] truncate">{customerName} • {formatTimeAgo(order.created_at)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 pl-2">
                                                    <p className="font-semibold text-sm md:text-base text-[#111111]">₮{Number(order.total_amount).toLocaleString()}</p>
                                                    <OrderStatusBadge status={order.status} />
                                                </div>
                                            </Link>
                                        );
                                    }) : (
                                        <div className="px-6 py-12 text-center text-muted-foreground">
                                            <ShoppingCart className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-muted-foreground/50" />
                                            <p>Захиалга байхгүй</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Center */}
                    <div>
                        <ActionCenter
                            conversations={activeConversations}
                            lowStockProducts={lowStockProducts}
                            pendingOrders={recentOrders.filter((o: any) => o.status === 'pending')}
                            unansweredCount={unansweredCount}
                        />
                    </div>
                </div>
            </div>
        </PullToRefresh>
    );
}
