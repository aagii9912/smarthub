'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
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
    Calendar,
    ChevronDown,
    Sparkles,
    Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const timeFilterOptions = [
    { value: 'today' as const, label: 'Өнөөдөр' },
    { value: 'week' as const, label: '7 хоног' },
    { value: 'month' as const, label: 'Сар' },
];

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

    const currentFilterLabel = timeFilterOptions.find((o) => o.value === timeFilter)?.label || 'Өнөөдөр';

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-6 max-w-[1400px] mx-auto">
                {/* ─── Toolbar ─── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[12px] font-semibold text-emerald-600 text-emerald-400">Идэвхтэй</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Dropdown
                            align="right"
                            trigger={
                                <button className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/50 bg-[#0F0B2E] backdrop-blur-sm border border-white/[0.08] rounded-xl hover:border-[#4A7CE7]/30 transition-all duration-200">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {currentFilterLabel}
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            }
                        >
                            {timeFilterOptions.map((option) => (
                                <DropdownItem
                                    key={option.value}
                                    onClick={() => setTimeFilter(option.value)}
                                    className={timeFilter === option.value ? 'bg-blue-500/10 text-blue-600 text-blue-400 font-semibold' : ''}
                                >
                                    {option.label}
                                </DropdownItem>
                            ))}
                        </Dropdown>

                        <button
                            onClick={() => refetch()}
                            disabled={isRefetching}
                            className="p-2 bg-[#0F0B2E] backdrop-blur-sm border border-white/[0.08] rounded-xl hover:border-[#4A7CE7]/30 transition-all duration-200"
                            title="Шинэчлэх"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5 text-white/40', isRefetching && 'animate-spin')} />
                        </button>
                    </div>
                </div>

                {/* ─── Stats Grid ─── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <StatsCard title="Өнөөдөр" value={stats.todayOrders.toString()} icon={ShoppingCart} iconColor="gold" />
                    <StatsCard
                        title="Орлого"
                        value={
                            stats.totalRevenue >= 1000000
                                ? `₮${(stats.totalRevenue / 1000000).toFixed(1)}M`
                                : `₮${stats.totalRevenue.toLocaleString()}`
                        }
                        icon={TrendingUp}
                        iconColor="blue"
                    />
                    <StatsCard title="Харилцагч" value={stats.totalCustomers.toString()} icon={Users} iconColor="purple" />
                    <StatsCard title="Хүлээгдэж буй" value={stats.pendingOrders.toString()} icon={Clock} iconColor="warning" />
                </div>

                {/* ─── Bento Grid ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
                    {/* Recent Orders — spans 2 cols */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl bg-[#0F0B2E] backdrop-blur-sm border border-white/[0.08] overflow-hidden transition-all duration-300 hover:border-[#4A7CE7]/20">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <span className="text-[14px] font-bold text-foreground tracking-[-0.02em]">Сүүлийн захиалгууд</span>
                                    </div>
                                </div>
                                <Link href="/dashboard/orders">
                                    <span className="text-[12px] text-white/40 hover:text-blue-500 transition-colors flex items-center gap-1.5 font-medium">
                                        Бүгдийг <ArrowRight className="w-3.5 h-3.5" />
                                    </span>
                                </Link>
                            </div>
                            <div className="divide-y divide-white/[0.06]">
                                {recentOrders.length > 0 ? (
                                    recentOrders.slice(0, 5).map((order: any) => {
                                        const customerName = order.customers?.name || 'Харилцагч';
                                        const productName = order.order_items?.[0]?.products?.name || 'Бүтээгдэхүүн';
                                        return (
                                            <Link
                                                key={order.id}
                                                href="/dashboard/orders"
                                                className="px-5 py-3.5 flex items-center justify-between hover:bg-[#0D0928] transition-colors"
                                            >
                                                <div className="flex items-center gap-3.5 overflow-hidden">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] from-white/[0.08] to-white/[0.04] flex items-center justify-center shrink-0">
                                                        <Package className="w-4 h-4 text-white/25" strokeWidth={1.5} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-[13px] text-foreground truncate tracking-[-0.01em]">{productName}</p>
                                                        <p className="text-[11px] text-white/40 truncate mt-0.5">
                                                            {customerName} • {formatTimeAgo(order.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 pl-3">
                                                    <p className="font-bold text-[13px] text-foreground tabular-nums tracking-[-0.02em]">
                                                        ₮{Number(order.total_amount).toLocaleString()}
                                                    </p>
                                                    <OrderStatusBadge status={order.status} />
                                                </div>
                                            </Link>
                                        );
                                    })
                                ) : (
                                    <EmptyState
                                        icon={<ShoppingCart className="h-6 w-6" />}
                                        title="Захиалга байхгүй"
                                        description="Захиалга ирсэн тохиолдолд энд харагдана"
                                    />
                                )}
                            </div>
                        </div>
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
