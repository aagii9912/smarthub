'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import type { Weekday, WeeklyHours, DayHours } from '@/types/ai';

const WEEKDAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_LABELS: Record<Weekday, string> = {
    mon: 'Даваа',
    tue: 'Мягмар',
    wed: 'Лхагва',
    thu: 'Пүрэв',
    fri: 'Баасан',
    sat: 'Бямба',
    sun: 'Ням',
};

interface BusinessHoursPickerProps {
    hours: WeeklyHours;
    onChange: (next: WeeklyHours) => void;
}

export function BusinessHoursPicker({ hours, onChange }: BusinessHoursPickerProps) {
    function updateDay(day: Weekday, next: DayHours) {
        const cleaned: DayHours = {};
        if (next.closed) {
            cleaned.closed = true;
        } else {
            if (next.open) cleaned.open = next.open;
            if (next.close) cleaned.close = next.close;
        }
        const out: WeeklyHours = { ...hours, [day]: cleaned };
        if (Object.keys(cleaned).length === 0) {
            delete out[day];
        }
        onChange(out);
    }

    function applyToAll(source: Weekday) {
        const slot = hours[source];
        if (!slot) return;
        const next: WeeklyHours = {};
        for (const day of WEEKDAY_ORDER) {
            next[day] = { ...slot };
        }
        onChange(next);
    }

    return (
        <div>
            <label className={labelCls}>Ажиллах цагийн хуваарь (бүх өдрөөр)</label>
            <p className="text-[11.5px] text-white/45 mb-3 leading-relaxed">
                Долоо хоногийн өдөр бүрд тусдаа цаг оруулна. "Амралт" сонгосон өдөрт цаг харуулахгүй.
            </p>

            <div className="space-y-2">
                {WEEKDAY_ORDER.map((day) => {
                    const slot = hours[day] ?? {};
                    const closed = !!slot.closed;
                    return (
                        <div
                            key={day}
                            className="grid grid-cols-[80px_1fr_1fr_auto_auto] items-center gap-2 p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                        >
                            <span className="text-[12.5px] font-medium text-foreground tracking-[-0.01em]">
                                {WEEKDAY_LABELS[day]}
                            </span>
                            <input
                                type="time"
                                disabled={closed}
                                value={slot.open ?? ''}
                                onChange={(e) => updateDay(day, { ...slot, open: e.target.value })}
                                className={cn(inputCls, closed && 'opacity-40')}
                            />
                            <input
                                type="time"
                                disabled={closed}
                                value={slot.close ?? ''}
                                onChange={(e) => updateDay(day, { ...slot, close: e.target.value })}
                                className={cn(inputCls, closed && 'opacity-40')}
                            />
                            <label
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors text-[11.5px]',
                                    closed
                                        ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-foreground'
                                        : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={closed}
                                    onChange={(e) => updateDay(day, { closed: e.target.checked })}
                                    className="sr-only"
                                />
                                Амралт
                            </label>
                            <button
                                type="button"
                                onClick={() => applyToAll(day)}
                                disabled={closed || (!slot.open && !slot.close)}
                                className={cn(
                                    'text-[11px] px-2 py-1 rounded transition-colors',
                                    'text-white/45 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed',
                                )}
                                title="Энэ өдрийн цагийг бүх өдөрт хуулах"
                            >
                                Бүгдэд
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
