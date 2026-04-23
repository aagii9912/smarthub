'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { PageHero } from '@/components/ui/PageHero';
import { KPI } from '@/components/ui/KPI';
import { Sparkles as SparkIcon } from 'lucide-react';
import { ChartBar } from '@/components/ui/ChartBar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboard } from '@/hooks/useDashboard';
import { useAIStats } from '@/hooks/useAIStats';
import {
    Calendar,
    ChevronDown,
    ChevronRight,
    Download,
    Plus,
    RefreshCw,
    ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const timeFilterOptions = [
    { value: 'today' as const, labelKey: 'today' as const },
    { value: 'week' as const, labelKey: 'week' as const },
    { value: 'month' as const, labelKey: 'month' as const },
];

const AVATAR_TONES = ['violet', 'emerald', 'cyan', 'rose', 'amber', 'indigo'] as const;
type AvatarTone = (typeof AVATAR_TONES)[number];

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
};

/** Running cumulative helper for the answered-rate sparkline. */
function cumulative(values: number[]): number[] {
    let acc = 0;
    return values.map((v) => (acc += v));
}

type OrderFilter = 'all' | 'pending' | 'paid';

export default function DashboardPage() {
    const { user, shop, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');
    const [orderTab, setOrderTab] = useState<OrderFilter>('all');

    const { data, isLoading, refetch, isRefetching } = useDashboard(timeFilter);
    const { data: aiStats } = useAIStats(timeFilter);

    const stats = data?.stats || { todayOrders: 0, pendingOrders: 0, totalRevenue: 0, totalCustomers: 0 };
    const trend = data?.trend;
    const series = data?.series;
    const recentOrders = data?.recentOrders || [];
    const activeConversations = data?.activeConversations || [];
    const lowStockProducts = data?.lowStockProducts || [];

    const firstName = useMemo(() => {
        const raw = user?.fullName || shop?.name || '';
        return raw.split(' ')[0] || t.header.fallbackTitle;
    }, [user?.fullName, shop?.name, t.header.fallbackTitle]);

    const revenueDisplay = useMemo(() => {
        if (stats.totalRevenue >= 1_000_000) return `₮${(stats.totalRevenue / 1_000_000).toFixed(1)}M`;
        if (stats.totalRevenue >= 1_000) return `₮${(stats.totalRevenue / 1_000).toFixed(0)}K`;
        return `₮${stats.totalRevenue.toLocaleString()}`;
    }, [stats.totalRevenue]);

    const avgOrder = useMemo(() => {
        if (!stats.todayOrders) return 0;
        return Math.round(stats.totalRevenue / stats.todayOrders);
    }, [stats.totalRevenue, stats.todayOrders]);

    const avgOrderDisplay = avgOrder >= 1000 ? `₮${(avgOrder / 1000).toFixed(0)}K` : `₮${avgOrder.toLocaleString()}`;

    // Sparklines from real data
    const ordersSpark = series?.orders ?? [];
    const revenueSpark = series?.revenue ?? [];
    const aiMessagesSpark = useMemo(
        () => (aiStats?.dailyMessages ?? []).map((d) => d.count),
        [aiStats?.dailyMessages]
    );
    const aiAnsweredSpark = useMemo(() => cumulative(aiMessagesSpark), [aiMessagesSpark]);

    // Per-bucket avg-order sparkline (revenue / orders, zero when no orders)
    const avgOrderSpark = useMemo(() => {
        if (!series) return [];
        return series.orders.map((o, i) => (o > 0 ? series.revenue[i] / o : 0));
    }, [series]);

    // Real conversion rate from AI stats (messages → orders)
    const conversionRate = aiStats?.conversionRate;

    // Trend → KPI props (up/down/null-hide)
    const ordersTrendDir: 'up' | 'down' | undefined =
        trend?.orders == null ? undefined : trend.orders >= 0 ? 'up' : 'down';
    const revenueTrendDir: 'up' | 'down' | undefined =
        trend?.revenue == null ? undefined : trend.revenue >= 0 ? 'up' : 'down';

    const formatTrend = (v: number | null | undefined) =>
        v == null ? undefined : `${v >= 0 ? '+' : ''}${v}% ${t.dashboard.trendVsYesterday}`;

    // Hourly / period buckets from real API series (24 slots for 'today', 7 for week, 30 for month)
    const hourly = useMemo(() => series?.orders ?? [], [series?.orders]);

    const filteredOrders = useMemo(() => {
        if (orderTab === 'all') return recentOrders;
        return recentOrders.filter((o) => o.status === orderTab);
    }, [recentOrders, orderTab]);

    const tabCounts = useMemo(
        () => ({
            all: recentOrders.length,
            pending: recentOrders.filter((o) => o.status === 'pending').length,
            paid: recentOrders.filter((o) => o.status === 'paid' || o.status === 'confirmed').length,
        }),
        [recentOrders]
    );

    const activity = useMemo(() => {
        type ActivityItem = { tone: AvatarTone; label: string; what: string; when: string };
        const items: ActivityItem[] = [];
        activeConversations.slice(0, 3).forEach((c, i) => {
            items.push({
                tone: AVATAR_TONES[i % AVATAR_TONES.length],
                label: t.dashboard.activityAIAgent,
                what: `${c.customerName} · ${c.lastMessage.slice(0, 48)}`,
                when: formatDelta(c.lastMessageAt),
            });
        });
        recentOrders.slice(0, 2).forEach((o, i) => {
            const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers;
            items.push({
                tone: AVATAR_TONES[(i + 3) % AVATAR_TONES.length],
                label: t.dashboard.activityNewOrder,
                what: `${cust?.name || t.dashboard.customer} · ₮${Number(o.total_amount).toLocaleString()}`,
                when: formatDelta(o.created_at),
            });
        });
        lowStockProducts.slice(0, 2).forEach((p) => {
            items.push({
                tone: 'rose',
                label: t.dashboard.activityLowStock,
                what: `${p.name} — үлдсэн ${p.stock}`,
                when: p.updated_at ? formatDelta(p.updated_at) : '—',
            });
        });
        return items.slice(0, 6);
    }, [activeConversations, recentOrders, lowStockProducts, t.dashboard]);

    if (isLoading || authLoading) {
        return <DashboardSkeleton />;
    }

    const handleRefresh = async () => {
        await refetch();
    };

    const currentFilterLabel = t.dashboard[timeFilterOptions.find((o) => o.value === timeFilter)?.labelKey || 'today'];
    const aiConvCount = aiStats?.totalConversations ?? activeConversations.length;

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-6 max-w-[1400px] mx-auto">
                {/* ─── Greeting Hero ─── */}
                <PageHero
                    eyebrow={t.dashboard.liveEyebrow}
                    eyebrowTone="emerald"
                    live
                    title={
                        <>
                            {t.dashboard.greeting}, {firstName} <span aria-hidden>👋</span>
                        </>
                    }
                    subtitle={t.dashboard.greetingSubtitle.replace('{count}', String(aiConvCount))}
                    actions={
                        <>
                            <Dropdown
                                align="right"
                                trigger={
                                    <button className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/70 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200">
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
                                className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/70 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200"
                                title={t.dashboard.refresh}
                            >
                                <Download className="h-3.5 w-3.5" />
                                {t.dashboard.export}
                                <RefreshCw className={cn('h-3.5 w-3.5 text-white/40', isRefetching && 'animate-spin')} />
                            </button>
                            <Link
                                href="/dashboard/orders?new=1"
                                className="pill-cta text-[13px] py-2.5 px-5"
                            >
                                <Plus className="h-4 w-4" />
                                {t.dashboard.newOrder}
                            </Link>
                        </>
                    }
                />

                {/* ─── KPI row ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                >
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.kpiTodayOrders}
                            value={stats.todayOrders.toString()}
                            trend={ordersTrendDir}
                            trendValue={formatTrend(trend?.orders)}
                            spark={ordersSpark}
                            featured
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.kpiRevenue}
                            value={revenueDisplay}
                            trend={revenueTrendDir}
                            trendValue={formatTrend(trend?.revenue)}
                            spark={revenueSpark}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.kpiAIAnswered}
                            value={aiStats?.totalMessages ? aiStats.totalMessages.toLocaleString() : '—'}
                            spark={aiAnsweredSpark}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI
                            label={t.dashboard.kpiAvgOrder}
                            value={avgOrder > 0 ? avgOrderDisplay : '—'}
                            spark={avgOrderSpark}
                        />
                    </motion.div>
                </motion.div>

                {/* ─── Main grid: Live orders + Activity ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    {/* Live orders */}
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <div className="card-outlined overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 border-b border-border">
                                <div>
                                    <div className="text-[15px] font-semibold text-foreground">
                                        {t.dashboard.liveOrders}
                                    </div>
                                    <div className="text-[12px] text-muted-foreground mt-0.5">
                                        {t.dashboard.liveOrdersSubtitle}
                                    </div>
                                </div>
                                <div className="md:ml-auto">
                                    <Tabs value={orderTab} onValueChange={(v) => setOrderTab(v as OrderFilter)}>
                                        <TabsList>
                                            <TabsTrigger value="all" count={tabCounts.all}>{t.dashboard.tabAll}</TabsTrigger>
                                            <TabsTrigger value="pending" count={tabCounts.pending}>{t.dashboard.tabPending}</TabsTrigger>
                                            <TabsTrigger value="paid" count={tabCounts.paid}>{t.dashboard.tabPaid}</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>
                            {filteredOrders.length === 0 ? (
                                <div className="px-5 py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                                        <ShoppingCart className="h-5 w-5 text-white/40" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="text-foreground font-medium">{t.dashboard.noOrders}</div>
                                        <div className="text-[12px] mt-1">{t.dashboard.noOrdersDesc}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colOrder}</th>
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colCustomer}</th>
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colStatus}</th>
                                                <th className="px-5 py-3 font-medium text-right">{t.dashboard.colAmount}</th>
                                                <th className="w-10" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {filteredOrders.slice(0, 6).map((o, idx) => {
                                                const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers;
                                                const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
                                                const shortId = `#SN-${String(o.id).slice(-4).toUpperCase()}`;
                                                return (
                                                    <tr
                                                        key={o.id}
                                                        className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                                                    >
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <div className="flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
                                                                <span>{shortId}</span>
                                                                <SparkIcon className="h-3 w-3 text-[var(--brand-violet-500)]" />
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <div className="flex items-center gap-2.5">
                                                                <Avatar size="sm" tone={tone} fallback={cust?.name || '?'} />
                                                                <div>
                                                                    <div className="text-[13px] font-medium text-foreground">
                                                                        {cust?.name || t.dashboard.customer}
                                                                    </div>
                                                                    <div className="text-[11px] text-white/40 mt-0.5">
                                                                        {formatDelta(o.created_at)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <OrderStatusBadge status={o.status} />
                                                        </td>
                                                        <td className="px-5 py-3 align-middle text-right font-semibold tabular-nums text-foreground">
                                                            ₮{Number(o.total_amount).toLocaleString()}
                                                        </td>
                                                        <td className="px-5 py-3 align-middle text-right">
                                                            <ChevronRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Activity stream */}
                    <motion.div variants={itemVariants}>
                        <div className="card-outlined p-5 h-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[15px] font-semibold text-foreground">{t.dashboard.activity}</div>
                                <div className="text-[11px] text-muted-foreground">{t.dashboard.lastHour}</div>
                            </div>
                            {activity.length === 0 ? (
                                <div className="text-[12px] text-muted-foreground py-8 text-center">
                                    {t.dashboard.noOrdersDesc}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activity.map((a, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <span
                                                className={cn(
                                                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold',
                                                    toneBadgeClass(a.tone)
                                                )}
                                            >
                                                {a.label[0]}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[12px] font-semibold text-foreground">
                                                    {a.label}
                                                </div>
                                                <div className="text-[12px] text-muted-foreground truncate mt-0.5">
                                                    {a.what}
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-white/30 shrink-0">{a.when}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>

                {/* ─── Hourly + AI performance ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5"
                >
                    <motion.div variants={itemVariants}>
                        <div className="card-outlined p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[15px] font-semibold text-foreground">
                                    {t.dashboard.hourlyOrders}
                                </div>
                                <div className="text-[11px] text-muted-foreground">{t.dashboard.hourlyRange}</div>
                            </div>
                            {hourly.length === 0 || hourly.every((v) => v === 0) ? (
                                <div className="h-[140px] flex items-center justify-center text-[12px] text-muted-foreground">
                                    {t.dashboard.noOrdersDesc}
                                </div>
                            ) : (
                                <>
                                    <ChartBar data={hourly} height={140} />
                                    <div className="flex justify-between mt-2.5 text-[10px] font-mono text-white/40">
                                        {timeFilter === 'today' ? (
                                            <>
                                                <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                                            </>
                                        ) : timeFilter === 'week' ? (
                                            <>
                                                <span>Д</span><span>М</span><span>Л</span><span>П</span><span>Б</span><span>Б</span><span>Н</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>1</span><span>8</span><span>15</span><span>22</span><span>30</span>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <div className="card-featured p-5 h-full">
                            <div className="flex items-center gap-2 mb-4 text-[15px] font-semibold text-foreground">
                                <SparkIcon className="h-4 w-4 text-[var(--brand-violet-500)]" />
                                {t.dashboard.aiAgentProgress}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                                        {t.dashboard.answered}
                                    </div>
                                    <div className="syn-metric mt-1.5">
                                        {aiStats?.totalMessages ?? 0}
                                    </div>
                                    <div className="text-[11px] text-white/50 mt-0.5">{t.dashboard.messages}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold">
                                        {t.dashboard.conversion}
                                    </div>
                                    <div className="syn-metric mt-1.5">
                                        {typeof conversionRate === 'number' && conversionRate > 0
                                            ? `${conversionRate}%`
                                            : '—'}
                                    </div>
                                    <div className="text-[11px] text-white/50 mt-0.5">
                                        {aiStats?.contactsCollected
                                            ? `${aiStats.contactsCollected} холбоо барих`
                                            : t.dashboard.messages}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-3.5 bg-white/[0.02] border border-border rounded-xl">
                                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mb-2">
                                    {t.dashboard.avgResponse}
                                </div>
                                <div className="tabular-nums text-[20px] font-semibold text-foreground">
                                    —
                                    <span className="text-[12px] font-medium text-muted-foreground ml-1">
                                        {t.dashboard.seconds}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </PullToRefresh>
    );
}

function toneBadgeClass(tone: AvatarTone): string {
    switch (tone) {
        case 'indigo':
            return 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo)]';
        case 'violet':
            return 'bg-[color-mix(in_oklab,var(--brand-violet-500)_18%,transparent)] text-[var(--brand-violet-500)]';
        case 'emerald':
            return 'bg-[color-mix(in_oklab,var(--status-success)_18%,transparent)] text-[var(--status-success)]';
        case 'amber':
            return 'bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)]';
        case 'rose':
            return 'bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] text-[var(--status-danger)]';
        case 'cyan':
            return 'bg-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] text-[var(--brand-cyan)]';
    }
}

function formatDelta(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.max(1, Math.round(diff / 60000));
    if (mins < 60) return `${mins}м`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}ц`;
    return `${Math.round(hrs / 24)}ө`;
}
