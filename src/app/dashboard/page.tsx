'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { ActionCenter } from '@/components/dashboard/ActionCenter';
import { AIStatsCard } from '@/components/dashboard/AIStatsCard';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { PageHero } from '@/components/ui/PageHero';
import { KPI } from '@/components/ui/KPI';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboard } from '@/hooks/useDashboard';
import { useAIStats } from '@/hooks/useAIStats';
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
import { cn } from '@/lib/utils';

const timeFilterOptions = [
    { value: 'today' as const, labelKey: 'today' as const },
    { value: 'week' as const, labelKey: 'week' as const },
    { value: 'month' as const, labelKey: 'month' as const },
];

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function DashboardPage() {
    const { user, shop, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');

    const { data, isLoading, refetch, isRefetching } = useDashboard(timeFilter);
    const { data: aiStats } = useAIStats(timeFilter);

    const stats = data?.stats || { todayOrders: 0, pendingOrders: 0, totalRevenue: 0, totalCustomers: 0 };
    interface RecentOrder {
        id: string;
        status: string;
        total_amount: number | string;
        created_at: string;
        customers?: { name?: string } | { name?: string }[] | null;
        order_items?: Array<{ products?: { name?: string } | { name?: string }[] | null }>;
    }
    const recentOrders: RecentOrder[] = data?.recentOrders || [];
    const activeConversations = data?.activeConversations || [];
    const lowStockProducts = data?.lowStockProducts || [];
    const unansweredCount = data?.unansweredCount || 0;

    if (isLoading || authLoading) {
        return <DashboardSkeleton />;
    }

    const handleRefresh = async () => {
        await refetch();
    };

    const currentFilterLabel = t.dashboard[timeFilterOptions.find((o) => o.value === timeFilter)?.labelKey || 'today'];

    const revenueDisplay =
        stats.totalRevenue >= 1000000
            ? `₮${(stats.totalRevenue / 1000000).toFixed(1)}M`
            : `₮${stats.totalRevenue.toLocaleString()}`;

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-6 max-w-[1400px] mx-auto">
                {/* ─── Page Hero ─── */}
                <PageHero
                    eyebrow={t.dashboard.active}
                    eyebrowTone="emerald"
                    live
                    title={shop?.name || t.header.fallbackTitle}
                    subtitle={`${new Date().toLocaleDateString('mn-MN', { weekday: 'long', month: 'short', day: 'numeric' })}`}
                    actions={
                        <>
                            <Dropdown
                                align="right"
                                trigger={
                                    <button className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/60 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {currentFilterLabel}
                                        <ChevronDown className="h-3 w-3" />
                                    </button>
                                }
                            >
                                {timeFilterOptions.map((option) => (
                                    <DropdownItem
                                        key={option.value}
                                        onClick={() => setTimeFilter(option.value)}
                                        className={timeFilter === option.value ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-[var(--brand-indigo)] font-semibold' : ''}
                                    >
                                        {t.dashboard[option.labelKey]}
                                    </DropdownItem>
                                ))}
                            </Dropdown>
                            <button
                                onClick={() => refetch()}
                                disabled={isRefetching}
                                className="p-2 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200"
                                title={t.dashboard.refresh}
                            >
                                <RefreshCw className={cn('h-3.5 w-3.5 text-white/50', isRefetching && 'animate-spin')} />
                            </button>
                        </>
                    }
                />

                {/* ─── KPI Grid ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                >
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.todayOrders}
                            value={stats.todayOrders.toString()}
                            icon={<ShoppingCart className="h-4 w-4" strokeWidth={1.5} />}
                            featured
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.revenue}
                            value={revenueDisplay}
                            icon={<TrendingUp className="h-4 w-4" strokeWidth={1.5} />}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.customers}
                            value={stats.totalCustomers.toString()}
                            icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.pending}
                            value={stats.pendingOrders.toString()}
                            icon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
                        />
                    </motion.div>
                </motion.div>

                {/* ─── AI Stats ─── */}
                {aiStats && (
                    <motion.div variants={itemVariants} initial="hidden" animate="show">
                        <AIStatsCard
                            totalConversations={aiStats.totalConversations}
                            totalMessages={aiStats.totalMessages}
                            creditUsage={aiStats.creditUsage}
                            contactsCollected={aiStats.contactsCollected}
                            planType={aiStats.plan.type}
                        />
                    </motion.div>
                )}

                {/* ─── Bento Grid ─── */}
                <motion.div 
                    variants={containerVariants} 
                    initial="hidden" 
                    animate="show" 
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    {/* Recent Orders — spans 2 cols */}
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <div className="card-outlined overflow-hidden transition-all duration-300 hover:border-[var(--brand-indigo)]/30">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-[color-mix(in_oklab,var(--brand-violet-500)_14%,transparent)] flex items-center justify-center">
                                        <Package className="h-4 w-4 text-[var(--brand-violet-500)]" strokeWidth={1.5} />
                                    </div>
                                    <span className="text-[14px] font-bold text-foreground tracking-[-0.02em]">
                                        {t.dashboard.recentOrders}
                                    </span>
                                </div>
                                <Link href="/dashboard/orders">
                                    <span className="text-[12px] text-white/50 hover:text-[var(--brand-indigo)] transition-colors flex items-center gap-1.5 font-medium">
                                        {t.dashboard.viewAll} <ArrowRight className="h-3.5 w-3.5" />
                                    </span>
                                </Link>
                            </div>
                            <div className="divide-y divide-white/[0.06]">
                                {recentOrders.length > 0 ? (
                                    recentOrders.slice(0, 5).map((order) => {
                                        const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers;
                                        const firstItem = order.order_items?.[0];
                                        const prod = Array.isArray(firstItem?.products) ? firstItem?.products[0] : firstItem?.products;
                                        const customerName = cust?.name || t.dashboard.customer;
                                        const productName = prod?.name || t.dashboard.product;
                                        return (
                                            <Link
                                                key={order.id}
                                                href="/dashboard/orders"
                                                className="px-5 py-3.5 flex items-center justify-between hover:bg-muted transition-colors"
                                            >
                                                <div className="flex items-center gap-3.5 overflow-hidden">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] flex items-center justify-center shrink-0">
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
                                        title={t.dashboard.noOrders}
                                        description={t.dashboard.noOrdersDesc}
                                    />
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Center */}
                    <motion.div variants={itemVariants}>
                        <ActionCenter
                            conversations={activeConversations}
                            lowStockProducts={lowStockProducts}
                            pendingOrders={recentOrders.filter((o) => o.status === 'pending').map((o) => {
                                const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers;
                                return {
                                    ...o,
                                    total_amount: Number(o.total_amount),
                                    customers: cust && cust.name ? { name: cust.name } : null,
                                };
                            })}
                            unansweredCount={unansweredCount}
                        />
                    </motion.div>
                </motion.div>
            </div>
        </PullToRefresh>
    );
}
