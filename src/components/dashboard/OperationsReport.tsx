'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { AppointmentsReport, LeadsReport, ReportDailyPoint } from '@/hooks/useReports';
import { CalendarCheck, CalendarClock, UserX, CheckCircle2, Users, PhoneCall, Target, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function StatCard({ icon: Icon, label, value, tone, featured }: { icon: LucideIcon; label: string; value: string | number; tone: string; featured?: boolean }) {
    return (
        <div className={cn('card-outlined p-4', featured && 'card-featured')}>
            <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${tone} 16%, transparent)`, color: tone }}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">{label}</span>
            </div>
            <div className="syn-metric tabular-nums">{value}</div>
        </div>
    );
}

function DailyBars({ data }: { data: ReportDailyPoint[] }) {
    const max = Math.max(1, ...data.map((d) => d.count));
    // Хэт олон өдөр байвал тэмдэглэгээг сийрэгжүүлнэ
    const step = Math.ceil(data.length / 12) || 1;
    return (
        <div className="flex items-end justify-between gap-1 h-[160px]">
            {data.map((d, i) => {
                const h = Math.round((d.count / max) * 100);
                return (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full min-w-0">
                        <span className="text-[9px] text-white/40 tabular-nums">{d.count || ''}</span>
                        <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: '120px' }}>
                            <div
                                className="absolute bottom-0 w-full rounded-t-md transition-all duration-700 ease-out"
                                style={{
                                    height: `${Math.max(h, 2)}%`,
                                    background: 'linear-gradient(to top, var(--brand-indigo) 0%, var(--brand-violet-500) 60%, var(--brand-cyan) 100%)',
                                }}
                            />
                        </div>
                        <span className="text-[9px] text-white/35 truncate">{i % step === 0 ? d.label : ''}</span>
                    </div>
                );
            })}
        </div>
    );
}

function Bar({ label, value, pct, tone }: { label: string; value: number; pct: number; tone: string }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-muted-foreground">{label}</span>
                <span className="text-[13px] font-semibold text-foreground tabular-nums">{value}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: tone }} />
            </div>
        </div>
    );
}

// ─── Booking report (service / beauty / healthcare) ───
export function BookingReport({ data }: { data: AppointmentsReport | undefined }) {
    const { t } = useLanguage();
    const r = data || { total: 0, completed: 0, noShow: 0, cancelled: 0, upcoming: 0, noShowRate: 0, completionRate: 0, daily: [], byStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 } };
    const statusRows = [
        { key: 'pending', label: t.dashboard.apptStatusPending, value: r.byStatus.pending, tone: 'var(--gold)' },
        { key: 'confirmed', label: t.dashboard.apptStatusConfirmed, value: r.byStatus.confirmed, tone: 'var(--brand-indigo)' },
        { key: 'completed', label: t.dashboard.apptStatusCompleted, value: r.byStatus.completed, tone: 'var(--status-success)' },
        { key: 'cancelled', label: t.dashboard.apptStatusCancelled, value: r.byStatus.cancelled, tone: 'var(--status-danger)' },
        { key: 'no_show', label: t.dashboard.apptStatusNoShow, value: r.byStatus.no_show, tone: 'var(--brand-violet-500)' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={CalendarCheck} label={t.dashboard.kpiPeriodAppointments} value={r.total} tone="var(--brand-indigo)" featured />
                <StatCard icon={CheckCircle2} label={t.dashboard.kpiCompleted} value={`${r.completionRate}%`} tone="var(--status-success)" />
                <StatCard icon={UserX} label={t.dashboard.kpiNoShow} value={`${r.noShowRate}%`} tone="var(--brand-violet-500)" />
                <StatCard icon={CalendarClock} label={t.dashboard.kpiUpcoming} value={r.upcoming} tone="var(--brand-cyan)" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 card-outlined p-5">
                    <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.apptChart}</div>
                    {r.daily.length === 0 || r.daily.every((d) => d.count === 0) ? (
                        <div className="h-[160px] flex items-center justify-center text-[12px] text-muted-foreground">{t.dashboard.noSlotData}</div>
                    ) : (
                        <DailyBars data={r.daily} />
                    )}
                </div>
                <div className="card-outlined p-5">
                    <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.statusBreakdownTitle}</div>
                    <div className="space-y-4">
                        {statusRows.map((s) => (
                            <Bar key={s.key} label={s.label} value={s.value} pct={r.total > 0 ? Math.round((s.value / r.total) * 100) : 0} tone={s.tone} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Lead report (realestate_auto / education) ───
export function LeadReport({ data }: { data: LeadsReport | undefined }) {
    const { t } = useLanguage();
    const r = data || { newLeads: 0, qualified: 0, converted: 0, conversionRate: 0, bySource: { messenger: 0, instagram: 0, other: 0 }, daily: [] };
    const srcTotal = r.bySource.messenger + r.bySource.instagram + r.bySource.other;
    const srcPct = (v: number) => (srcTotal > 0 ? Math.round((v / srcTotal) * 100) : 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Users} label={t.dashboard.kpiNewLeads} value={r.newLeads} tone="var(--brand-indigo)" featured />
                <StatCard icon={PhoneCall} label={t.dashboard.kpiQualified} value={r.qualified} tone="var(--status-success)" />
                <StatCard icon={TrendingUp} label={t.dashboard.kpiConverted} value={r.converted} tone="var(--brand-cyan)" />
                <StatCard icon={Target} label={t.dashboard.kpiLeadConversion} value={`${r.conversionRate}%`} tone="var(--gold)" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 card-outlined p-5">
                    <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.recentLeadsTitle}</div>
                    {r.daily.length === 0 || r.daily.every((d) => d.count === 0) ? (
                        <div className="h-[160px] flex items-center justify-center text-[12px] text-muted-foreground">{t.dashboard.noLeads}</div>
                    ) : (
                        <DailyBars data={r.daily} />
                    )}
                </div>
                <div className="card-outlined p-5">
                    <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.leadSourceTitle}</div>
                    {srcTotal === 0 ? (
                        <div className="py-8 text-center text-[12px] text-muted-foreground">{t.dashboard.noLeads}</div>
                    ) : (
                        <div className="space-y-4">
                            <Bar label={t.dashboard.sourceMessenger} value={r.bySource.messenger} pct={srcPct(r.bySource.messenger)} tone="var(--brand-indigo)" />
                            <Bar label={t.dashboard.sourceInstagram} value={r.bySource.instagram} pct={srcPct(r.bySource.instagram)} tone="var(--brand-violet-500)" />
                            <Bar label={t.dashboard.sourceOther} value={r.bySource.other} pct={srcPct(r.bySource.other)} tone="var(--brand-cyan)" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
