'use client';

import { useMemo, useState } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Plus, Pencil, Trash2, Users, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, type Staff } from '@/hooks/useStaff';
import { WEEKDAY_KEYS, type WeekdayKey, type WorkingHours } from '@/lib/validations/staff';

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
    mon: 'Даваа', tue: 'Мягмар', wed: 'Лхагва', thu: 'Пүрэв', fri: 'Баасан', sat: 'Бямба', sun: 'Ням',
};

const COLOR_SWATCHES = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

interface FormState {
    name: string;
    specialty: string;
    phone: string;
    color: string;
    is_active: boolean;
    working_hours: NonNullable<WorkingHours>;
}

const emptyForm = (): FormState => ({
    name: '',
    specialty: '',
    phone: '',
    color: COLOR_SWATCHES[0],
    is_active: true,
    working_hours: {},
});

export default function StaffPage() {
    const { data: staff = [], isLoading } = useStaff();
    const createStaff = useCreateStaff();
    const updateStaff = useUpdateStaff();
    const deleteStaff = useDeleteStaff();

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Staff | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());

    const activeCount = useMemo(() => staff.filter((s) => s.is_active).length, [staff]);

    const openNew = () => {
        setEditing(null);
        setForm(emptyForm());
        setOpen(true);
    };

    const openEdit = (s: Staff) => {
        setEditing(s);
        setForm({
            name: s.name,
            specialty: s.specialty ?? '',
            phone: s.phone ?? '',
            color: s.color || COLOR_SWATCHES[0],
            is_active: s.is_active,
            working_hours: (s.working_hours as NonNullable<WorkingHours>) ?? {},
        });
        setOpen(true);
    };

    const setDay = (day: WeekdayKey, patch: { open?: string; close?: string; closed?: boolean }) => {
        setForm((f) => ({
            ...f,
            working_hours: { ...f.working_hours, [day]: { ...f.working_hours[day], ...patch } },
        }));
    };

    const save = async () => {
        const payload = {
            name: form.name.trim(),
            specialty: form.specialty.trim() || null,
            phone: form.phone.trim() || null,
            color: form.color,
            is_active: form.is_active,
            working_hours: form.working_hours,
        };
        if (!payload.name) return;
        if (editing) {
            await updateStaff.mutateAsync({ id: editing.id, ...payload });
        } else {
            await createStaff.mutateAsync(payload);
        }
        setOpen(false);
    };

    const remove = async (s: Staff) => {
        if (!confirm(`"${s.name}"-г устгах уу? Өмнөх цаг захиалгууд хадгалагдана.`)) return;
        await deleteStaff.mutateAsync(s.id);
    };

    if (isLoading) return <DashboardSkeleton />;

    const saving = createStaff.isPending || updateStaff.isPending;

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <PageHero
                eyebrow="Багийн ажилтнууд"
                title="Ажилтан"
                subtitle={
                    <>
                        <span className="text-foreground font-medium tabular-nums">{staff.length}</span> ажилтан ·{' '}
                        <span className="text-[var(--status-success)] font-medium tabular-nums">{activeCount}</span> идэвхтэй
                    </>
                }
                actions={
                    <button onClick={openNew} className="pill-cta text-[13px] py-2.5 px-5">
                        <Plus className="h-4 w-4" />
                        Ажилтан нэмэх
                    </button>
                }
            />

            {staff.length === 0 ? (
                <div className="card-outlined p-12 text-center flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                        <Users className="h-5 w-5 text-white/40" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="text-foreground font-medium">Ажилтан бүртгээгүй байна</div>
                        <div className="text-[12px] text-muted-foreground mt-1">Мэргэжилтнүүдээ нэмж, цаг захиалгад хуваарилаарай.</div>
                    </div>
                    <button onClick={openNew} className="pill-cta text-[13px] py-2 px-4 mt-1">
                        <Plus className="h-4 w-4" /> Ажилтан нэмэх
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {staff.map((s) => (
                        <div key={s.id} className={cn('card-outlined p-4 flex flex-col gap-3', !s.is_active && 'opacity-60')}>
                            <div className="flex items-start gap-3">
                                <span className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center text-[13px] font-semibold text-white" style={{ backgroundColor: s.color }}>
                                    {s.name.slice(0, 1).toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[14px] font-semibold text-foreground truncate">{s.name}</div>
                                    <div className="text-[12px] text-muted-foreground truncate">{s.specialty || '—'}</div>
                                </div>
                                {!s.is_active && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50">Идэвхгүй</span>
                                )}
                            </div>
                            {s.phone && (
                                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground tabular-nums">
                                    <Phone className="h-3 w-3" /> {s.phone}
                                </div>
                            )}
                            <div className="flex items-center gap-2 mt-auto pt-1">
                                <Button variant="outline" size="sm" onClick={() => openEdit(s)} className="flex-1">
                                    <Pencil className="h-3.5 w-3.5" /> Засах
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => remove(s)} aria-label="Устгах">
                                    <Trash2 className="h-3.5 w-3.5 text-[var(--status-danger)]" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={open} onOpenChange={setOpen}>
                <ModalContent size="lg" title={editing ? 'Ажилтан засах' : 'Шинэ ажилтан'}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="staff-name">Нэр *</Label>
                            <Input id="staff-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: Болормаа" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="staff-spec">Мэргэжил</Label>
                                <Input id="staff-spec" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Үс засагч, гоо сайханч…" />
                            </div>
                            <div>
                                <Label htmlFor="staff-phone">Утас</Label>
                                <Input id="staff-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="99xxxxxx" />
                            </div>
                        </div>

                        <div>
                            <Label>Өнгө (календарт)</Label>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                                {COLOR_SWATCHES.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setForm({ ...form, color: c })}
                                        className={cn('h-7 w-7 rounded-lg transition-transform', form.color === c && 'ring-2 ring-white ring-offset-2 ring-offset-[#09090b] scale-110')}
                                        style={{ backgroundColor: c }}
                                        aria-label={c}
                                    />
                                ))}
                            </div>
                        </div>

                        <Toggle enabled={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Идэвхтэй" description="Идэвхгүй ажилтан цаг захиалгад харагдахгүй" />

                        <div>
                            <Label>Долоо хоногийн хуваарь</Label>
                            <div className="mt-1.5 space-y-1.5">
                                {WEEKDAY_KEYS.map((day) => {
                                    const d = form.working_hours[day] || {};
                                    const closed = !!d.closed;
                                    return (
                                        <div key={day} className="flex items-center gap-3 py-1">
                                            <span className="w-14 text-[12px] text-muted-foreground shrink-0">{WEEKDAY_LABELS[day]}</span>
                                            <button
                                                type="button"
                                                onClick={() => setDay(day, { closed: !closed })}
                                                className={cn(
                                                    'text-[11px] px-2 py-1 rounded-md shrink-0 transition-colors',
                                                    closed ? 'bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] text-[var(--status-danger)]' : 'bg-white/[0.05] text-white/50',
                                                )}
                                            >
                                                {closed ? 'Амарна' : 'Ажиллана'}
                                            </button>
                                            {!closed && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="time"
                                                        value={d.open || ''}
                                                        onChange={(e) => setDay(day, { open: e.target.value })}
                                                        className="bg-card border border-border rounded-lg px-2 py-1 text-[12px] text-foreground"
                                                    />
                                                    <span className="text-white/30">–</span>
                                                    <input
                                                        type="time"
                                                        value={d.close || ''}
                                                        onChange={(e) => setDay(day, { close: e.target.value })}
                                                        className="bg-card border border-border rounded-lg px-2 py-1 text-[12px] text-foreground"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)}>Болих</Button>
                        <Button onClick={save} disabled={!form.name.trim() || saving}>
                            {saving ? 'Хадгалж байна…' : editing ? 'Хадгалах' : 'Нэмэх'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
