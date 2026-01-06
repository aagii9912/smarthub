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
                    <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-lg text-gray-500">Ачааллаж байна...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Сайн байна уу{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {shop?.name ? `${shop.name} - ` : ''}Өнөөдрийн борлуулалтын тойм
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdate && (
                        <span className="text-xs text-gray-400">
                            Шинэчлэгдсэн: {lastUpdate.toLocaleTimeString('mn-MN')}
                        </span>
                    )}
                    <Button onClick={() => fetchDashboardData(true)} disabled={refreshing} variant="secondary">
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Шинэчлэх
                    </Button>
                    <Link href="/dashboard/products">
                        <Button>
                            <Package className="w-4 h-4 mr-2" />
                            Бүтээгдэхүүн нэмэх
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Setup Alert */}
            {shop && !shop.facebook_page_id && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Facebook className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Facebook Page холбоогүй байна</h3>
                                <p className="text-blue-100">Чатбот ажиллуулахын тулд Facebook Page-ээ холбоно уу</p>
                            </div>
                        </div>
                        <Link href="/setup">
                            <button className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors">
                                Холбох
                            </button>
                        </Link>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Өнөөдрийн захиалга"
                    value={stats.todayOrders.toString()}
                    icon={ShoppingCart}
                    iconColor="from-violet-500 to-indigo-600"
                />
                <StatsCard
                    title="Нийт орлого"
                    value={stats.totalRevenue >= 1000000 
                        ? `₮${(stats.totalRevenue / 1000000).toFixed(1)}M` 
                        : `₮${stats.totalRevenue.toLocaleString()}`}
                    icon={TrendingUp}
                    iconColor="from-emerald-500 to-teal-600"
                />
                <StatsCard
                    title="Нийт харилцагч"
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
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-violet-600" />
                                Сүүлийн захиалгууд
                            </CardTitle>
                            <Link href="/dashboard/orders">
                                <Button variant="ghost" size="sm">
                                    Бүгдийг харах <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            </Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {recentOrders.length > 0 ? recentOrders.slice(0, 5).map((order) => {
                                    const customerName = order.customers?.name || 'Харилцагч';
                                    const productName = order.order_items?.[0]?.products?.name || 'Бүтээгдэхүүн';
                                    return (
                                        <Link 
                                            key={order.id} 
                                            href="/dashboard/orders"
                                            className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors block"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{productName}</p>
                                                    <p className="text-sm text-gray-500">{customerName} • {formatTimeAgo(order.created_at)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <p className="font-semibold text-gray-900">₮{Number(order.total_amount).toLocaleString()}</p>
                                                <OrderStatusBadge status={order.status} />
                                            </div>
                                        </Link>
                                    );
                                }) : (
                                    <div className="px-6 py-12 text-center text-gray-500">
                                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p>Захиалга байхгүй байна</p>
                                        <p className="text-sm mt-1">Messenger-ээр захиалга ирэхэд энд харагдана</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Chats */}
                <div>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-violet-600" />
                                Чат мессежүүд
                            </CardTitle>
                            {recentChats.length > 0 && (
                                <Badge variant="danger">{recentChats.length} шинэ</Badge>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {recentChats.length > 0 ? recentChats.map((chat) => (
                                    <div key={chat.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
                                                <MessageSquare className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium text-gray-900">{chat.customers?.name || 'Харилцагч'}</p>
                                                    <span className="text-xs text-gray-400">{formatTimeAgo(chat.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 truncate">{chat.message}</p>
                                                {chat.intent && (
                                                    <span className="text-xs text-violet-500 bg-violet-50 px-2 py-0.5 rounded mt-1 inline-block">
                                                        {chat.intent}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="px-6 py-12 text-center text-gray-500">
                                        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p>Чат байхгүй байна</p>
                                        <p className="text-sm mt-1">Messenger-ээр ирсэн мессежүүд энд харагдана</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Tips */}
                    <Card className="mt-6">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="font-semibold text-gray-900">Зөвлөмж</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li className="flex items-start gap-2">
                                    <span className="text-violet-500">•</span>
                                    Бүтээгдэхүүнийхээ зураг, дэлгэрэнгүй тайлбар нэмээрэй
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-violet-500">•</span>
                                    Захиалгын статусыг цаг тухайд нь шинэчлээрэй
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-violet-500">•</span>
                                    VIP харилцагчдад тусгай хөнгөлөлт санал болгоорой
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
