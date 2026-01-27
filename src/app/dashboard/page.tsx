'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { OrderStatusBadge } from '@/components/ui/Badge';
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
    Calendar,
    ChevronDown,
} from 'lucide-react';

export default function DashboardPage() {
    const { user, shop, loading: authLoading } = useAuth();
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');
    const [showTimeFilter, setShowTimeFilter] = useState(false);

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
                {/* Compact Action Toolbar */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-end gap-2 mb-2"
                >
                    {/* Time Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTimeFilter(!showTimeFilter)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                            style={{
                                background: 'rgba(24, 24, 27, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                        >
                            <Calendar className="w-4 h-4" />
                            {timeFilter === 'today' ? 'Өнөөдөр' : timeFilter === 'week' ? '7 хоног' : 'Сар'}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showTimeFilter ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showTimeFilter && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowTimeFilter(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-32 rounded-xl shadow-xl z-20 overflow-hidden"
                                        style={{
                                            background: 'rgba(24, 24, 27, 0.95)',
                                            backdropFilter: 'blur(20px)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                        }}
                                    >
                                        {[
                                            { value: 'today', label: 'Өнөөдөр' },
                                            { value: 'week', label: '7 хоног' },
                                            { value: 'month', label: 'Сар' },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setTimeFilter(option.value as 'today' | 'week' | 'month');
                                                    setShowTimeFilter(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${timeFilter === option.value
                                                        ? 'text-indigo-400 bg-indigo-500/10'
                                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Refresh Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                        style={{
                            background: 'rgba(24, 24, 27, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                        title="Шинэчлэх"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
                    </motion.button>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <StatsCard
                        title="Өнөөдөр"
                        value={stats.todayOrders.toString()}
                        icon={ShoppingCart}
                        iconColor="from-indigo-500 to-purple-500"
                        delay={0}
                    />
                    <StatsCard
                        title="Орлого"
                        value={stats.totalRevenue >= 1000000
                            ? `₮${(stats.totalRevenue / 1000000).toFixed(1)}M`
                            : `₮${stats.totalRevenue.toLocaleString()}`}
                        icon={TrendingUp}
                        iconColor="from-emerald-500 to-teal-500"
                        delay={0.1}
                    />
                    <StatsCard
                        title="Харилцагч"
                        value={stats.totalCustomers.toString()}
                        icon={Users}
                        iconColor="from-blue-500 to-cyan-500"
                        delay={0.2}
                    />
                    <StatsCard
                        title="Хүлээгдэж буй"
                        value={stats.pendingOrders.toString()}
                        icon={Clock}
                        iconColor="from-amber-500 to-orange-500"
                        delay={0.3}
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Orders */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        className="lg:col-span-2"
                    >
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                                background: 'rgba(24, 24, 27, 0.6)',
                                backdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                        >
                            <div className="flex items-center justify-between p-4 md:p-5 border-b border-zinc-800/50">
                                <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold text-white">
                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                                    Сүүлийн захиалгууд
                                </h3>
                                <Link href="/dashboard/orders">
                                    <motion.button
                                        whileHover={{ x: 4 }}
                                        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-indigo-400 transition-colors"
                                    >
                                        Бүгдийг <ArrowRight className="w-4 h-4" />
                                    </motion.button>
                                </Link>
                            </div>
                            <div className="divide-y divide-zinc-800/50">
                                {recentOrders.length > 0 ? recentOrders.slice(0, 5).map((order: any, index: number) => {
                                    const customerName = order.customers?.name || 'Харилцагч';
                                    const productName = order.order_items?.[0]?.products?.name || 'Бүтээгдэхүүн';
                                    return (
                                        <motion.div
                                            key={order.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + index * 0.05 }}
                                        >
                                            <Link
                                                href="/dashboard/orders"
                                                className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors block"
                                            >
                                                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                        <Package className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm md:text-base text-white truncate">{productName}</p>
                                                        <p className="text-xs text-zinc-500 truncate">{customerName} • {formatTimeAgo(order.created_at)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 pl-2">
                                                    <p className="font-semibold text-sm md:text-base text-white">₮{Number(order.total_amount).toLocaleString()}</p>
                                                    <OrderStatusBadge status={order.status} />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                }) : (
                                    <div className="px-6 py-12 text-center text-zinc-500">
                                        <ShoppingCart className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-zinc-700" />
                                        <p>Захиалга байхгүй</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Center */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        <ActionCenter
                            conversations={activeConversations}
                            lowStockProducts={lowStockProducts}
                            pendingOrders={recentOrders.filter((o: any) => o.status === 'pending')}
                            unansweredCount={unansweredCount}
                        />
                    </motion.div>
                </div>
            </div>
        </PullToRefresh>
    );
}
