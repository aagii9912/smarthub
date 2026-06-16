'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { KPI } from '@/components/ui/KPI';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDashboard } from '@/hooks/useDashboard';
import { useAIStats } from '@/hooks/useAIStats';
import { cn } from '@/lib/utils';
import {
    AVATAR_TONES,
    containerVariants,
    itemVariants,
    formatDelta,
    DashboardHero,
    DashboardError,
    TimeFilter,
} from './shared';
import { LeadSourceCard, FollowUpCard } from './widgets';

/**
 * Lead archetype — for shops whose AI agent has the `lead_capture` capability
 * but neither `sales` nor `booking` (realestate_auto, education). Replaces the
 * orders table with a lead pipeline built on the `customers` table.
 */
export function LeadDashboardView() {
    const { user, shop } = useAuth();
    const { t } = useLanguage();
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');

    const { data, isLoading, isError, refetch, isRefetching } = useDashboard(timeFilter);
    const { data: aiStats } = useAIStats(timeFilter);

    const lead = data?.leads;
    const stats = lead?.stats || { newLeads: 0, qualified: 0, converted: 0, conversionRate: 0 };
    const recent = lead?.recent ?? [];

    const firstName = useMemo(() => {
        const raw = user?.fullName || shop?.name || '';
        return raw.split(' ')[0] || t.header.fallbackTitle;
    }, [user?.fullName, shop?.name, t.header.fallbackTitle]);

    // Funnel: new → qualified → converted, widths relative to newLeads.
    const funnel = useMemo(() => {
        const base = Math.max(stats.newLeads, 1);
        return [
            { label: t.dashboard.kpiNewLeads, value: stats.newLeads, tone: 'var(--brand-indigo)' },
            { label: t.dashboard.kpiQualified, value: stats.qualified, tone: 'var(--brand-violet-500)' },
            { label: t.dashboard.kpiConverted, value: stats.converted, tone: 'var(--status-success)' },
        ].map((s) => ({ ...s, pct: Math.round((s.value / base) * 100) }));
    }, [stats, t.dashboard]);

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

    const badgeFor = (l: { total_orders: number | null; phone: string | null }) => {
        if ((l.total_orders ?? 0) > 0) {
            return { label: t.dashboard.leadBadgeConverted, cls: 'bg-[color-mix(in_oklab,var(--status-success)_18%,transparent)] text-[var(--status-success)]' };
        }
        if (l.phone) {
            return { label: t.dashboard.leadBadgeQualified, cls: 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo)]' };
        }
        return { label: t.dashboard.leadBadgeNew, cls: 'bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)]' };
    };

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-6 max-w-[1400px] mx-auto">
                <DashboardHero
                    eyebrow={t.dashboard.leadEyebrow}
                    title={
                        <>
                            {t.dashboard.greeting}, {firstName} <span aria-hidden>👋</span>
                        </>
                    }
                    subtitle={t.dashboard.leadSubtitle.replace('{count}', String(aiConvCount))}
                    timeFilter={timeFilter}
                    onTimeFilterChange={setTimeFilter}
                    onRefresh={() => refetch()}
                    isRefetching={isRefetching}
                    exportType="customers"
                    ctaHref="/dashboard/customers"
                    ctaLabel={t.dashboard.leadCta}
                />

                {/* ─── KPI row ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
                >
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiNewLeads} value={stats.newLeads.toString()} featured />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiQualified} value={stats.qualified.toString()} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiConverted} value={stats.converted.toString()} />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <KPI label={t.dashboard.kpiLeadConversion} value={stats.newLeads > 0 ? `${stats.conversionRate}%` : '—'} />
                    </motion.div>
                </motion.div>

                {/* ─── Recent leads + Funnel ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <div className="card-outlined overflow-hidden">
                            <div className="px-5 py-4 border-b border-border">
                                <div className="text-[15px] font-semibold text-foreground">{t.dashboard.recentLeadsTitle}</div>
                                <div className="text-[12px] text-muted-foreground mt-0.5">{t.dashboard.recentLeadsSubtitle}</div>
                            </div>
                            {recent.length === 0 ? (
                                <div className="px-5 py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                                        <Users className="h-5 w-5 text-white/40" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="text-foreground font-medium">{t.dashboard.noLeads}</div>
                                        <div className="text-[12px] mt-1">{t.dashboard.noLeadsDesc}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colLead}</th>
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colPhone}</th>
                                                <th className="px-5 py-3 font-medium">{t.dashboard.colStatus}</th>
                                                <th className="px-5 py-3 font-medium text-right">{t.dashboard.colJoined}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {recent.map((l, idx) => {
                                                const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
                                                const badge = badgeFor(l);
                                                return (
                                                    <tr key={l.id} className="hover:bg-white/[0.03] transition-colors">
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <div className="flex items-center gap-2.5">
                                                                <Avatar size="sm" tone={tone} fallback={l.name || '?'} />
                                                                <div className="text-[13px] font-medium text-foreground">
                                                                    {l.name || t.dashboard.customer}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle text-muted-foreground tabular-nums">
                                                            {l.phone || '—'}
                                                        </td>
                                                        <td className="px-5 py-3.5 align-middle">
                                                            <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium', badge.cls)}>
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 align-middle text-right text-[11px] text-white/40">
                                                            {formatDelta(l.created_at)}
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

                    {/* Funnel */}
                    <motion.div variants={itemVariants}>
                        <div className="card-outlined p-5 h-full">
                            <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.leadFunnelTitle}</div>
                            <div className="space-y-4">
                                {funnel.map((s) => (
                                    <div key={s.label}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[12px] text-muted-foreground">{s.label}</span>
                                            <span className="text-[13px] font-semibold text-foreground tabular-nums">{s.value}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${s.pct}%`, backgroundColor: s.tone }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* ─── Source attribution + follow-up queue ─── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
                >
                    <motion.div variants={itemVariants}>
                        <LeadSourceCard data={lead} />
                    </motion.div>
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <FollowUpCard data={lead} />
                    </motion.div>
                </motion.div>
            </div>
        </PullToRefresh>
    );
}
