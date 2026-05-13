'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ChipArrayInput } from './ChipArrayInput';
import { getBoolean, getNumber, getString, getStringArray, type Setup, type SetField } from './utils';

interface EducationPanelProps {
    data: Setup;
    setField: SetField;
}

function optNum(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function EducationPanel({ data, setField }: EducationPanelProps) {
    const cert = getBoolean(data, 'certification_offered');
    const trial = getBoolean(data, 'trial_class_available');

    return (
        <div className="space-y-5">
            <div>
                <label className={labelCls}>Сургалтын төрлүүд</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="Хэлний сургалт, програмчлал, бизнес..."
                    value={getString(data, 'course_types')}
                    onChange={(e) => setField('course_types', e.target.value || undefined)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Анги дүүргэлтийн дээд хязгаар</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="25"
                        value={optNum(getNumber(data, 'student_capacity'))}
                        onChange={(e) => setField('student_capacity', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Ажиллах цаг</label>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder="Да-Ба: 09:00 - 21:00"
                        value={getString(data, 'business_hours')}
                        onChange={(e) => setField('business_hours', e.target.value || undefined)}
                    />
                </div>
            </div>

            <ChipArrayInput
                label="Түвшнүүд"
                items={getStringArray(data, 'levels_offered')}
                onChange={(next) => setField('levels_offered', next)}
                placeholder="Анхан шат, дунд шат, гүн ахисан..."
            />

            <ChipArrayInput
                label="Хичээллэх хэлбэр"
                items={getStringArray(data, 'class_format')}
                onChange={(next) => setField('class_format', next)}
                placeholder="online, offline, hybrid"
            />

            <div>
                <label className={labelCls}>Элсэлтийн огноо</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="Сар бүрийн 1-нд эхэлнэ, эсвэл тогтмол гэх мэт"
                    value={getString(data, 'intake_dates')}
                    onChange={(e) => setField('intake_dates', e.target.value || undefined)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Сертификат олгодог?</label>
                    <div className="flex gap-2">
                        {(
                            [
                                { value: true, label: 'Тийм' },
                                { value: false, label: 'Үгүй' },
                            ] as const
                        ).map((o) => (
                            <button
                                key={String(o.value)}
                                type="button"
                                onClick={() => setField('certification_offered', cert === o.value ? undefined : o.value)}
                                className={cn(
                                    'flex-1 px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                    cert === o.value
                                        ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-foreground'
                                        : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white',
                                )}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Туршилтын хичээл боломжтой?</label>
                    <div className="flex gap-2">
                        {(
                            [
                                { value: true, label: 'Тийм' },
                                { value: false, label: 'Үгүй' },
                            ] as const
                        ).map((o) => (
                            <button
                                key={String(o.value)}
                                type="button"
                                onClick={() => setField('trial_class_available', trial === o.value ? undefined : o.value)}
                                className={cn(
                                    'flex-1 px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                    trial === o.value
                                        ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-foreground'
                                        : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white',
                                )}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
