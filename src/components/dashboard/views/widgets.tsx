'use client';

import { ChartBar } from '@/components/ui/ChartBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatDelta } from './shared';
import type { AppointmentsBlock, CartFunnelBlock, LeadsBlock } from '@/hooks/useDashboard';
import { Clock3, PhoneCall } from 'lucide-react';

/** A labelled horizontal progress bar used by the funnel-style widgets. */
function Bar({ label, value, pct, tone }: { label: string; value: number | string; pct: number; tone: string }) {
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

// ─── Commerce: cart funnel ───
export function CartFunnelCard({ data }: { data: CartFunnelBlock | undefined }) {
    const { t } = useLanguage();
    const funnel = data || { active: 0, converted: 0, abandoned: 0, conversionRate: 0 };
    const total = funnel.active + funnel.converted + funnel.abandoned;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    return (
        <div className="card-outlined p-5 h-full">
            <div className="flex items-center justify-between mb-4">
                <div className="text-[15px] font-semibold text-foreground">{t.dashboard.cartFunnelTitle}</div>
                <div className="text-[12px] text-muted-foreground">
                    {t.dashboard.cartConversionRate}: <span className="text-foreground font-semibold">{total > 0 ? `${funnel.conversionRate}%` : '—'}</span>
                </div>
            </div>
            {total === 0 ? (
                <div className="h-[120px] flex items-center justify-center text-[12px] text-muted-foreground">
                    {t.dashboard.noCartData}
                </div>
            ) : (
                <div className="space-y-4">
                    <Bar label={t.dashboard.cartActive} value={funnel.active} pct={pct(funnel.active)} tone="var(--brand-indigo)" />
                    <Bar label={t.dashboard.cartConverted} value={funnel.converted} pct={pct(funnel.converted)} tone="var(--status-success)" />
                    <Bar label={t.dashboard.cartAbandoned} value={funnel.abandoned} pct={pct(funnel.abandoned)} tone="var(--status-danger)" />
                </div>
            )}
        </div>
    );
}

// ─── Booking: peak hours + weekday load ───
export function PeakHoursCard({ data }: { data: AppointmentsBlock | undefined }) {
    const { t } = useLanguage();
    const byHour = data?.byHour ?? [];
    const peakHour = data?.stats.peakHour ?? null;
    const hasData = byHour.some((v) => v > 0);

    return (
        <div className="card-outlined p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-[15px] font-semibold text-foreground">{t.dashboard.peakHoursTitle}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{t.dashboard.peakHoursSubtitle}</div>
                </div>
                {peakHour != null && hasData && (
                    <div className="text-[11px] text-muted-foreground">
                        {t.dashboard.peakHourLabel}: <span className="text-foreground font-semibold tabular-nums">{String(peakHour).padStart(2, '0')}:00</span>
                    </div>
                )}
            </div>
            {!hasData ? (
                <div className="h-[140px] flex items-center justify-center text-[12px] text-muted-foreground">{t.dashboard.noSlotData}</div>
            ) : (
                <>
                    <ChartBar data={byHour} height={140} />
                    <div className="flex justify-between mt-2.5 text-[10px] font-mono text-white/40">
                        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                    </div>
                </>
            )}
        </div>
    );
}

export function WeekdayLoadCard({ data }: { data: AppointmentsBlock | undefined }) {
    const { t } = useLanguage();
    const byWeekday = data?.byWeekday ?? [];
    const max = Math.max(1, ...byWeekday);
    const labels = t.dashboard.weekdaysShort;

    return (
        <div className="card-outlined p-5 h-full">
            <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.weekdayTitle}</div>
            <div className="flex items-end justify-between gap-2 h-[140px]">
                {labels.map((label, i) => {
                    const v = byWeekday[i] ?? 0;
                    const h = Math.round((v / max) * 100);
                    return (
                        <div key={label} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                            <span className="text-[11px] font-semibold text-foreground tabular-nums">{v || ''}</span>
                            <div
                                className="w-full rounded-md bg-[color-mix(in_oklab,var(--brand-indigo)_55%,transparent)] transition-all duration-500"
                                style={{ height: `${Math.max(4, h)}%` }}
                            />
                            <span className="text-[10px] text-white/40">{label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Lead: source attribution + follow-up queue ───
export function LeadSourceCard({ data }: { data: LeadsBlock | undefined }) {
    const { t } = useLanguage();
    const src = data?.bySource || { messenger: 0, instagram: 0, other: 0 };
    const total = src.messenger + src.instagram + src.other;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    return (
        <div className="card-outlined p-5 h-full">
            <div className="text-[15px] font-semibold text-foreground mb-4">{t.dashboard.leadSourceTitle}</div>
            {total === 0 ? (
                <div className="h-[120px] flex items-center justify-center text-[12px] text-muted-foreground">{t.dashboard.noLeads}</div>
            ) : (
                <div className="space-y-4">
                    <Bar label={t.dashboard.sourceMessenger} value={src.messenger} pct={pct(src.messenger)} tone="var(--brand-indigo)" />
                    <Bar label={t.dashboard.sourceInstagram} value={src.instagram} pct={pct(src.instagram)} tone="var(--brand-violet-500)" />
                    <Bar label={t.dashboard.sourceOther} value={src.other} pct={pct(src.other)} tone="var(--brand-cyan)" />
                </div>
            )}
        </div>
    );
}

export function FollowUpCard({ data }: { data: LeadsBlock | undefined }) {
    const { t } = useLanguage();
    const followUp = data?.followUp || { count: 0, items: [] };

    return (
        <div className="card-outlined p-5 h-full">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-[15px] font-semibold text-foreground">{t.dashboard.followUpTitle}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{t.dashboard.followUpSubtitle}</div>
                </div>
                {followUp.count > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-lg text-[12px] font-semibold bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)] tabular-nums">
                        {followUp.count}
                    </span>
                )}
            </div>
            {followUp.items.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-muted-foreground">{t.dashboard.noFollowUp}</div>
            ) : (
                <div className="space-y-3">
                    {followUp.items.map((l) => (
                        <div key={l.id} className="flex items-center gap-3">
                            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', 'bg-[color-mix(in_oklab,var(--gold)_15%,transparent)] text-[var(--gold)]')}>
                                <PhoneCall className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-medium text-foreground truncate">{l.name || t.dashboard.customer}</div>
                                <div className="text-[11px] text-muted-foreground tabular-nums">{l.phone || '—'}</div>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-white/40 shrink-0">
                                <Clock3 className="h-3 w-3" />
                                {l.last_contact_at ? formatDelta(l.last_contact_at) : '—'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
