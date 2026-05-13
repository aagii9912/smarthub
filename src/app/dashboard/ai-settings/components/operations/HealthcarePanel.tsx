'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ChipArrayInput } from './ChipArrayInput';
import { getBoolean, getNumber, getString, getStringArray, type Setup, type SetField } from './utils';

interface HealthcarePanelProps {
    data: Setup;
    setField: SetField;
}

function optNum(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function HealthcarePanel({ data, setField }: HealthcarePanelProps) {
    const appointmentRequired = getBoolean(data, 'appointment_required');

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Эмчийн тоо</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="5"
                        value={optNum(getNumber(data, 'doctor_count'))}
                        onChange={(e) => setField('doctor_count', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Ажиллах цаг</label>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder="Да-Ба: 09:00 - 18:00"
                        value={getString(data, 'business_hours')}
                        onChange={(e) => setField('business_hours', e.target.value || undefined)}
                    />
                </div>
            </div>

            <div>
                <label className={labelCls}>Үндсэн чиглэлүүд</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="Шүд, дотрын, хүүхэд..."
                    value={getString(data, 'specialties')}
                    onChange={(e) => setField('specialties', e.target.value || undefined)}
                />
            </div>

            <ChipArrayInput
                label="Хүлээн авдаг даатгал"
                items={getStringArray(data, 'insurance_accepted')}
                onChange={(next) => setField('insurance_accepted', next)}
                placeholder="ЭМД, Гэрэгэ..."
            />

            <div>
                <label className={labelCls}>Урьдчилсан цаг авах шаардлагатай?</label>
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
                            onClick={() =>
                                setField('appointment_required', appointmentRequired === o.value ? undefined : o.value)
                            }
                            className={cn(
                                'px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                appointmentRequired === o.value
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
                <label className={labelCls}>Яаралтай тохиолдол - юу хийх вэ?</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: 103 дугаар руу залгана. Манай эмнэлэг 24/7 биш..."
                    value={getString(data, 'emergency_handling')}
                    onChange={(e) => setField('emergency_handling', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={cn(labelCls, 'flex items-center gap-1.5')}>
                    <span className="text-amber-400">⚠️</span> Заавал хэлэх мэдэгдэл (Triage Disclaimer)
                </label>
                <p className="text-[11px] text-white/55 mb-2 leading-relaxed">
                    AI үргэлж энэ мэдэгдлийг хэлэх ёстой. Хуулийн шаардлагатай эмнэлгүүд заавал бөглөнө.
                </p>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[80px]')}
                    placeholder="Жишээ: Би AI туслагч, мэргэжлийн эмнэлгийн зөвлөгөө өгөх боломжгүй. Эрүүл мэндийн асуудлаа эмчид хандаарай."
                    value={getString(data, 'triage_disclaimer')}
                    onChange={(e) => setField('triage_disclaimer', e.target.value || undefined)}
                />
            </div>
        </div>
    );
}
