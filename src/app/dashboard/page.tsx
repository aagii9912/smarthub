'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton, StatsCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';

export default function DashboardPage() {
    const { user, shop, loading: authLoading } = useAuth();

    const [stats, setStats] = useState({
        todayOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        totalCustomers: 0,
    });
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [activeConversations, setActiveConversations] = useState<any[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
    const [unansweredCount, setUnansweredCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');

    const fetchDashboardData = useCallback(async (showRefresh = false, period = timeFilter) => {
        if (showRefresh) setRefreshing(true);

        try {
            const res = await fetch(`/api/dashboard/stats?period=${period}`);
            const data = await res.json();
            setStats(data.stats);
            setRecentOrders(data.recentOrders);
            setActiveConversations(data.activeConversations || []);
            setLowStockProducts(data.lowStockProducts || []);
            setUnansweredCount(data.unansweredCount || 0);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [timeFilter]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (loading) setLoading(false);
        }, 10000);

        if (!authLoading) {
            fetchDashboardData();
            const interval = setInterval(() => fetchDashboardData(), 15000);
            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }

        return () => clearTimeout(timeout);
    }, [authLoading, fetchDashboardData]);

    if (loading || authLoading) {
        return <DashboardSkeleton />;
    }

    const handleRefresh = async () => {
        await fetchDashboardData(true);
    };

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-4 md:space-y-6">
                {/* Page Title */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-[#111111]">
                            Сайн байна уу{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}! 👋
                        </h1>
                        <p className="text-sm text-[#6c757d] mt-1">
                            {shop?.name ? `${shop.name} - ` : ''}Өнөөдрийн борлуулалтын тойм
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button onClick={() => fetchDashboardData(true)} disabled={refreshing} variant="secondary" size="sm" className="h-9">
                            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Шинэчлэх</span>
                        </Button>
                        <Link href="/dashboard/products">
                            <Button size="sm" className="h-9">
                                <Package className="w-3.5 h-3.5 mr-2" />
                                <span className="hidden sm:inline">Бүтээгдэхүүн нэмэх</span>
                                <span className="sm:hidden">Нэмэх</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Setup Alert */}
                {shop && !shop.facebook_page_id && (
                    <div className="bg-[#65c51a] rounded-xl p-4 md:p-5 text-white shadow-md">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Facebook className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base md:text-lg">Facebook Page холбоогүй</h3>
                                    <p className="text-sm text-white/80">Чатбот ажиллуулахын тулд холбоно уу</p>
                                </div>
                            </div>
                            <Link href="/setup" className="w-full sm:w-auto">
                                <button className="w-full sm:w-auto px-6 py-2.5 bg-white text-[#111111] font-semibold rounded-lg hover:bg-gray-100 transition-colors text-sm">
                                    Холбох
                                </button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Time Filter Tabs */}
                <div className="flex gap-2">
                    {[
                        { value: 'today', label: 'Өнөөдөр' },
                        { value: 'week', label: '7 хоног' },
                        { value: 'month', label: 'Сар' },
                    ].map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                setTimeFilter(option.value as 'today' | 'week' | 'month');
                                fetchDashboardData(true, option.value as 'today' | 'week' | 'month');
                            }}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${timeFilter === option.value
                                    ? 'bg-[#65c51a] text-white'
                                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
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
                                    {recentOrders.length > 0 ? recentOrders.slice(0, 5).map((order) => {
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
