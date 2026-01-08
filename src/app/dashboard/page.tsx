'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, OrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { formatTimeAgo } from '@/lib/utils/date';
import {
    ShoppingCart,
    Users,
    TrendingUp,
    Package,
    Clock,
    ArrowRight,
    MessageSquare,
    RefreshCw,
    Facebook,
    Sparkles,
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
    const [recentChats, setRecentChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchDashboardData = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);

        try {
            const res = await fetch('/api/dashboard/stats');
            const data = await res.json();
            setStats(data.stats);
            setRecentOrders(data.recentOrders);
            setRecentChats(data.recentChats);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

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
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-lg text-muted-foreground">Ачааллаж байна...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Page Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">
                        Сайн байна уу{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}! 👋
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
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
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 md:p-6 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Facebook className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">Facebook Page холбоогүй</h3>
                                <p className="text-sm text-blue-100">Чатбот ажиллуулахын тулд холбоно уу</p>
                            </div>
                        </div>
                        <Link href="/setup" className="w-full sm:w-auto">
                            <button className="w-full sm:w-auto px-6 py-2.5 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-sm">
                                Холбох
                            </button>
                        </Link>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatsCard
                    title="Өнөөдөр"
                    value={stats.todayOrders.toString()}
                    icon={ShoppingCart}
                    iconColor="from-violet-500 to-indigo-600"
                />
                <StatsCard
                    title="Орлого"
                    value={stats.totalRevenue >= 1000000
                        ? `₮${(stats.totalRevenue / 1000000).toFixed(1)}M`
                        : `₮${stats.totalRevenue.toLocaleString()}`}
                    icon={TrendingUp}
                    iconColor="from-emerald-500 to-teal-600"
                />
                <StatsCard
                    title="Харилцагч"
                    value={stats.totalCustomers.toString()}
                    icon={Users}
                    iconColor="from-amber-500 to-orange-600"
                />
                <StatsCard
                    title="Хүлээгдэж буй"
                    value={stats.pendingOrders.toString()}
                    icon={Clock}
                    iconColor="from-rose-500 to-pink-600"
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
                                                    <p className="font-medium text-sm md:text-base text-foreground truncate">{productName}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{customerName} • {formatTimeAgo(order.created_at)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 pl-2">
                                                <p className="font-semibold text-sm md:text-base text-foreground">₮{Number(order.total_amount).toLocaleString()}</p>
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

                {/* Recent Chats */}
                <div>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between py-3 md:py-4">
                            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                                <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                Чат
                            </CardTitle>
                            {recentChats.length > 0 && (
                                <Badge variant="danger" className="text-[10px] md:text-xs">{recentChats.length} шинэ</Badge>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {recentChats.length > 0 ? recentChats.map((chat) => {
                                    const customerName = chat.customers?.name || 'Харилцагч';
                                    const isReplied = chat.role === 'assistant';

                                    // Intent to human-readable label
                                    const getIntentLabel = (intent: string) => {
                                        const labels: Record<string, { text: string; icon: string; color: string }> = {
                                            'ORDER_CREATE': { text: 'Захиалга', icon: '🛒', color: 'bg-green-50 text-green-600 border-green-100' },
                                            'PRODUCT_INQUIRY': { text: 'Бүтээгдэхүүн', icon: '📦', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                                            'PRICE_INQUIRY': { text: 'Үнэ', icon: '💰', color: 'bg-amber-50 text-amber-600 border-amber-100' },
                                            'GREETING': { text: 'Мэндчилгээ', icon: '👋', color: 'bg-purple-50 text-purple-600 border-purple-100' },
                                            'GENERAL_CHAT': { text: 'Асуулт', icon: '💬', color: 'bg-secondary text-muted-foreground border-border' },
                                        };
                                        return labels[intent] || { text: intent, icon: '💬', color: 'bg-secondary text-muted-foreground border-border' };
                                    };

                                    const intentInfo = chat.intent ? getIntentLabel(chat.intent) : null;

                                    return (
                                        <Link
                                            key={chat.id}
                                            href={`/dashboard/customers`}
                                            className="px-4 md:px-6 py-3 md:py-4 hover:bg-secondary/20 transition-colors block cursor-pointer"
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Avatar */}
                                                <div className="relative flex-shrink-0">
                                                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center bg-secondary text-foreground font-medium text-xs md:text-sm border border-border">
                                                        {customerName.charAt(0).toUpperCase()}
                                                    </div>
                                                    {/* Status dot */}
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-background ${isReplied ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm text-foreground truncate max-w-[100px]">{customerName}</p>
                                                            {!isReplied && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                                                                    ШИНЭ
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] md:text-xs text-muted-foreground flex-shrink-0">{formatTimeAgo(chat.created_at)}</span>
                                                    </div>
                                                    <p className="text-xs md:text-sm text-muted-foreground truncate mt-0.5">{chat.message}</p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        {intentInfo && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${intentInfo.color} flex items-center gap-1`}>
                                                                {intentInfo.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                }) : (
                                    <div className="px-6 py-12 text-center text-muted-foreground">
                                        <MessageSquare className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-muted-foreground/50" />
                                        <p>Чат байхгүй</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
