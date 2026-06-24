'use client';

import { useMemo, useState } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppointments, useUpdateAppointment } from '@/hooks/useAppointments';
import { useStaff } from '@/hooks/useStaff';
import { APPOINTMENT_STATUSES, type AppointmentStatus, type PaymentStatus } from '@/lib/validations/appointment';

const STATUS_MN: Record<AppointmentStatus, string> = {
    pending: 'Хүлээгдэж буй',
    confirmed: 'Баталгаажсан',
    completed: 'Дууссан',
    cancelled: 'Цуцалсан',
    no_show: 'Ирээгүй',
};

const STATUS_TONE: Record<string, string> = {
    pending: 'bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)]',
    confirmed: 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo)]',
    completed: 'bg-[color-mix(in_oklab,var(--status-success)_18%,transparent)] text-[var(--status-success)]',
    cancelled: 'bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] text-[var(--status-danger)]',
    no_show: 'bg-white/[0.06] text-white/50',
};

const PAYMENT_MN: Record<PaymentStatus, string> = { paid: 'Төлсөн', unpaid: 'Төлөөгүй', partial: 'Хагас' };

type StatusFilter = 'all' | AppointmentStatus;

function rel(r: { name: string | null } | { name: string | null }[] | null) {
    if (!r) return null;
    return Array.isArray(r) ? r[0] ?? null : r;
}

export default function AppointmentsPage() {
    const [tab, setTab] = useState<StatusFilter>('all');
    const { data: rows = [], isLoading } = useAppointments(tab === 'all' ? undefined : { status: tab });
    const { data: staffList = [] } = useStaff();
    const update = useUpdateAppointment();

    const staffById = useMemo(() => {
        const m: Record<string, { name: string; color: string }> = {};
        staffList.forEach((s) => (m[s.id] = { name: s.name, color: s.color }));
        return m;
    }, [staffList]);

    if (isLoading) return <DashboardSkeleton />;

    const paidCount = rows.filter((r) => r.payment_status === 'paid').length;

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <PageHero
                eyebrow="Цаг захиалга"
                title="Цаг захиалга"
                subtitle={
                    <>
                        <span className="text-foreground font-medium tabular-nums">{rows.length}</span> захиалга ·{' '}
                        <span className="text-[var(--status-success)] font-medium tabular-nums">{paidCount}</span> төлсөн
                    </>
                }
            />

            <Tabs value={tab} onValueChange={(v) => setTab(v as StatusFilter)}>
                <TabsList>
                    <TabsTrigger value="all">Бүгд</TabsTrigger>
                    {APPOINTMENT_STATUSES.map((s) => (
                        <TabsTrigger key={s} value={s}>{STATUS_MN[s]}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <div className="card-outlined overflow-hidden">
                {rows.length === 0 ? (
                    <div className="px-5 py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                            <CalendarClock className="h-5 w-5 text-white/40" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="text-foreground font-medium">Цаг захиалга алга</div>
                            <div className="text-[12px] mt-1">Шинэ цаг захиалга ирвэл энд харагдана</div>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                                    <th className="px-5 py-3 font-medium">Цаг</th>
                                    <th className="px-5 py-3 font-medium">Харилцагч</th>
                                    <th className="px-5 py-3 font-medium">Үйлчилгээ</th>
                                    <th className="px-5 py-3 font-medium">Ажилтан</th>
                                    <th className="px-5 py-3 font-medium text-right">Үнэ</th>
                                    <th className="px-5 py-3 font-medium">Төлбөр</th>
                                    <th className="px-5 py-3 font-medium">Төлөв</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {rows.map((a) => {
                                    const cust = rel(a.customers);
                                    const prod = rel(a.products);
                                    const st = a.staff_id ? staffById[a.staff_id] : undefined;
                                    const d = new Date(a.scheduled_at);
                                    return (
                                        <tr key={a.id} className="hover:bg-white/[0.03] transition-colors">
                                            <td className="px-5 py-3.5 align-middle">
                                                <div className="text-[13px] font-medium text-foreground tabular-nums">
                                                    {d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="text-[11px] text-white/40">{d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })} · {a.duration_minutes}м</div>
                                            </td>
                                            <td className="px-5 py-3.5 align-middle">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar size="sm" tone="violet" fallback={cust?.name || '?'} />
                                                    <span className="text-[13px] font-medium text-foreground">{cust?.name || 'Харилцагч'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 align-middle text-muted-foreground">{prod?.name || '—'}</td>
                                            <td className="px-5 py-3.5 align-middle">
                                                {st ? (
                                                    <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground">
                                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                                                        {st.name}
                                                    </span>
                                                ) : <span className="text-white/30">—</span>}
                                            </td>
                                            <td className="px-5 py-3.5 align-middle text-right tabular-nums text-foreground">
                                                {a.price != null ? `₮${Number(a.price).toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 align-middle">
                                                <Dropdown
                                                    trigger={
                                                        <button className={cn(
                                                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium',
                                                            a.payment_status === 'paid'
                                                                ? 'bg-[color-mix(in_oklab,var(--status-success)_18%,transparent)] text-[var(--status-success)]'
                                                                : a.payment_status === 'partial'
                                                                    ? 'bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)]'
                                                                    : 'bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] text-[var(--status-danger)]',
                                                        )}>
                                                            {PAYMENT_MN[a.payment_status]} <ChevronDown className="h-3 w-3" />
                                                        </button>
                                                    }
                                                >
                                                    {(['paid', 'unpaid', 'partial'] as PaymentStatus[]).map((p) => (
                                                        <DropdownItem key={p} onClick={() => update.mutate({ id: a.id, payment_status: p })}>
                                                            {PAYMENT_MN[p]}
                                                        </DropdownItem>
                                                    ))}
                                                </Dropdown>
                                            </td>
                                            <td className="px-5 py-3.5 align-middle">
                                                <Dropdown
                                                    trigger={
                                                        <button className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium', STATUS_TONE[a.status])}>
                                                            {STATUS_MN[a.status]} <ChevronDown className="h-3 w-3" />
                                                        </button>
                                                    }
                                                >
                                                    {APPOINTMENT_STATUSES.map((s) => (
                                                        <DropdownItem key={s} onClick={() => update.mutate({ id: a.id, status: s })}>
                                                            {STATUS_MN[s]}
                                                        </DropdownItem>
                                                    ))}
                                                </Dropdown>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
