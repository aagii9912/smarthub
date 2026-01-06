'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, OrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    ShoppingCart,
    Users,
    TrendingUp,
    Package,
    Clock,
    ArrowRight,
    MessageSquare,
} from 'lucide-react';

function formatTimeAgo(date: string) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} мин өмнө`;
    if (diffHours < 24) return `${diffHours} цаг өмнө`;
    return `${diffDays} өдрийн өмнө`;
}

export default function DashboardPage() {
    const [stats, setStats] = useState({
        todayOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        totalCustomers: 0,
    });
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [recentChats, setRecentChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                const res = await fetch('/api/dashboard/stats');
                const data = await res.json();
                setStats(data.stats);
                setRecentOrders(data.recentOrders);
                setRecentChats(data.recentChats);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-96">
            <div className="text-lg text-gray-500">Ачааллаж байна...</div>
        </div>;
    }
    return (
        <div className="space-y-6">
            {/* Page Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Сайн байна уу! 👋</h1>
                    <p className="text-gray-500 mt-1">Өнөөдрийн борлуулалтын тойм</p>
                </div>
                <Button>
                    <Package className="w-4 h-4 mr-2" />
                    Бүтээгдэхүүн нэмэх
                </Button>
            </div>

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
                    value={`₮${(stats.totalRevenue / 1000000).toFixed(1)}M`}
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
                            <CardTitle>Сүүлийн захиалгууд</CardTitle>
                            <Button variant="ghost" size="sm">
                                Бүгдийг харах <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {recentOrders.length > 0 ? recentOrders.map((order) => {
                                    const customerName = order.customers?.name || 'Харилцагч';
                                    const productName = order.order_items?.[0]?.products?.name || 'Бүтээгдэхүүн';
                                    return (
                                        <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
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
                                        </div>
                                    );
                                }) : (
                                    <div className="px-6 py-8 text-center text-gray-500">
                                        Захиалга байхгүй байна
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
                            <CardTitle>Чат мессежүүд</CardTitle>
                            {recentChats.length > 0 && (
                                <Badge variant="danger">{recentChats.length} шинэ</Badge>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {recentChats.length > 0 ? recentChats.map((chat) => (
                                    <div key={chat.id} className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
                                                <MessageSquare className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium text-gray-900">{chat.customers?.name || 'Харилцагч'}</p>
                                                    <span className="text-xs text-gray-400">{formatTimeAgo(chat.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 truncate">{chat.message}</p>
                                            </div>
                                            <div className="w-2 h-2 mt-2 bg-violet-500 rounded-full"></div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="px-6 py-8 text-center text-gray-500">
                                        Чат байхгүй байна
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

