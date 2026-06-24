'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { KPI } from '@/components/ui/KPI';
import { CalendarClock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboard } from '@/hooks/useDashboard';
import { useAIStats } from '@/hooks/useAIStats';
import { cn } from '@/lib/utils';
import {
    AVATAR_TONES,
    containerVariants,
    itemVariants,
    formatUpcoming,
    DashboardHero,
    DashboardError,
    TimeFilter,
} from './shared';
import { PeakHoursCard, WeekdayLoadCard, SecondarySections, DayScheduleCard, ServiceTypeSummaryCard } from './widgets';
import { useStaff } from '@/hooks/useStaff';

const STATUS_TONE: Record<string, string> = {
    pending: 'bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)]',
    confirmed: 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo)]',
    completed: 'bg-[color-mix(in_oklab,var(--status-success)_18%,transparent)] text-[var(--status-success)]',
    cancelled: 'bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] text-[var(--status-danger)]',
    no_show: 'bg-white/[0.06] text-white/50',
};

function pickRelated(rel: { name: string | null } | { name: string | null }[] | null): { name: string | null } | null {
    if (!rel) return null;
    return Array.isArray(rel) ? rel[0] ?? null : rel;
}

/**
 * Booking archetype — for shops whose AI agent has the `booking` capability
 * but not `sales` (service, beauty, healthcare). Surfaces upcoming
 * appointments, no-show rate and per-status breakdown instead of orders.
 */
export function BookingDashboardView() {
    const { user, shop } = useAuth();
    const { t } = useLanguage();
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

    const { data, isLoading, isError, refetch, isRefetching } = useDashboard(timeFilter);
    const { data: aiStats } = useAIStats(timeFilter);
    const { data: staffList = [] } = useStaff();

    const staffById = useMemo(() => {
        const map: Record<string, { name: string; color: string }> = {};
        staffList.forEach((s) => (map[s.id] = { name: s.name, color: s.color }));
        return map;
    }, [staffList]);

    const appt = data?.appointments;
    const stats = appt?.stats || { periodCount: 0, upcomingCount: 0, completedCount: 0, noShowRate: 0 };
    const series = appt?.series ?? [];
    const breakdown = appt?.statusBreakdown || { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
    const upcoming = appt?.upcoming ?? [];

    const firstName = useMemo(() => {
        const raw = user?.fullName || shop?.name || '';
        return raw.split(' ')[0] || t.header.fallbackTitle;
    }, [user?.fullName, shop?.name, t.header.fallbackTitle]);

    const statusRows = useMemo(
        () => [
            { key: 'pending', label: t.dashboard.apptStatusPending, value: breakdown.pending },
            { key: 'confirmed', label: t.dashboard.apptStatusConfirmed, value: breakdown.confirmed },
            { key: 'completed', label: t.dashboard.apptStatusCompleted, value: breakdown.completed },
            { key: 'cancelled', label: t.dashboard.apptStatusCancelled, value: breakdown.cancelled },
            { key: 'no_show', label: t.dashboard.apptStatusNoShow, value: breakdown.no_show },
        ],
        [breakdown, t.dashboard]
    );

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (isError) {
        return <DashboardError onRetry={() => refetch()} isRetrying={isRefetching} />;
    }

    const handleRefresh = async () => {
        await refetch();
    };

    const aiConvCount = aiStats?.totalConversations ?? data?.activeConversations.length ?? 0;
    const statusLabel = (s: string) =>
        statusRows.find((r) => r.key === s)?.label ?? s;

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-6 max-w-[1400px] mx-auto">
                <DashboardHero
                    eyebrow={t.dashboard.bookingEyebrow}
                    title={
                        <>
                            {t.dashboard.greeting}, {firstName} <span aria-hidden>👋</span>
                        </>
                    }
                    subtitle={t.dashboard.bookingSubtitle.replace('{count}', String(aiConvCount))}
                    timeFilter={timeFilter}
                    onTimeFilterChange={setTimeFilter}
                    onRefresh={() => refetch()}
                    isRefetching={isRefetching}
                    exportType="customers"
                    ctaHref="/dashboard/products"
                    ctaLabel={t.dashboard.bookingCta}
                />

                {/* ─── KPI row ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                >
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiPeriodAppointments} value={stats.periodCount.toString()} spark={series} featured />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiUpcoming} value={stats.upcomingCount.toString()} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiCompleted} value={stats.completedCount.toString()} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiNoShow} value={stats.periodCount > 0 ? `${stats.noShowRate}%` : '—'} />
                    </motion.div>
                </motion.div>

                {/* ─── Тухайн өдрийн календар + үйлчилгээний төрлөөр нэгтгэх ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <DayScheduleCard data={appt} staffById={staffById} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <ServiceTypeSummaryCard data={appt} />
                    </motion.div>
                </motion.div>

                {/* ─── Upcoming appointments + Status breakdown ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <div className="card-outlined overflow-hidden">
                            <div className="px-5 py-4 border-b border-border">
                                <div className="text-[15px] font-semibold text-foreground">{t.dashboard.upcomingTitle}</div>
                                <div className="text-[12px] text-muted-foreground mt-0.5">{t.dashboard.upcomingSubtitle}</div>
                            </div>
                            {upcoming.length === 0 ? (
                                <div className="px-5 py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                                        <CalendarClock className="h-5 w-5 text-white/40" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="text-foreground font-medium">{t.dashboard.noAppointments}</div>
                                        <div className="text-[12px] mt-1">{t.dashboard.noAppointmentsDesc}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colCustomer}</th>
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colService}</th>
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colStatus}</th>
                                                <th className="px-5 py-3 font-medium text-right">{t.dashboard.colTime}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {upcoming.map((a, idx) => {
                                                const cust = pickRelated(a.customers);
                                                const prod = pickRelated(a.products);
                                                const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
                                                return (
                                                    <tr key={a.id} className="hover:bg-white/[0.03] transition-colors">
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <div className="flex items-center gap-2.5">
                                                                <Avatar size="sm" tone={tone} fallback={cust?.name || '?'} />
                                                                <div className="text-[13px] font-medium text-foreground">
                                                                    {cust?.name || t.dashboard.customer}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle text-muted-foreground">
                                                            {prod?.name || '—'}
                                                            <span className="text-white/30 ml-1">· {a.duration_minutes}{t.dashboard.minutesShort}</span>
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium', STATUS_TONE[a.status] || STATUS_TONE.pending)}>
                                                                {statusLabel(a.status)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle text-right">
                                                            <div className="text-[13px] font-medium text-foreground tabular-nums">
                                                                {new Date(a.scheduled_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <div className="text-[11px] text-white/40 mt-0.5">{formatUpcoming(a.scheduled_at)}</div>
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

                    {/* Status breakdown */}
                    <motion.div variants={itemVariants}>
                        <div className="card-outlined p-5 h-full">
                            <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.statusBreakdownTitle}</div>
                            <div className="space-y-3">
                                {statusRows.map((row) => (
                                    <div key={row.key} className="flex items-center justify-between">
                                        <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium', STATUS_TONE[row.key])}>
                                            {row.label}
                                        </span>
                                        <span className="text-[14px] font-semibold text-foreground tabular-nums">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* ─── Peak hours + weekday load ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <PeakHoursCard data={appt} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <WeekdayLoadCard data={appt} />
                    </motion.div>
                </motion.div>

                {/* ─── Hybrid: secondary capability blocks ─── */}
                <SecondarySections data={data} primary="booking" />
            </div>
        </PullToRefresh>
    );
}
