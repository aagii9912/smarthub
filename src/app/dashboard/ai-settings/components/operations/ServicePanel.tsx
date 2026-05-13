'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ServiceCatalogEditor, type ServiceCatalogItem } from './ServiceCatalogEditor';
import { getBoolean, getNumber, getString, getObjectArray, type Setup, type SetField } from './utils';

interface ServicePanelProps {
    data: Setup;
    setField: SetField;
}

function optNum(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function ServicePanel({ data, setField }: ServicePanelProps) {
    const bookingMethod = getString(data, 'booking_method');
    const requiresDeposit = getBoolean(data, 'requires_deposit');
    const homeVisit = getBoolean(data, 'home_visit_enabled');

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Ажилтны тоо</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="3"
                        value={optNum(getNumber(data, 'staff_count'))}
                        onChange={(e) => setField('staff_count', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Үйлчилгээний дундаж хугацаа (минут)</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="60"
                        value={optNum(getNumber(data, 'default_duration_minutes'))}
                        onChange={(e) => setField('default_duration_minutes', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
            </div>

            <div>
                <label className={labelCls}>Захиалга авах хэлбэр</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                        [
                            { value: 'manual', label: 'Гараар', desc: 'Мессеж/утсаар авдаг' },
                            { value: 'calendar', label: 'Календар системээр', desc: 'Онлайн систем' },
                        ] as const
                    ).map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setField('booking_method', bookingMethod === o.value ? undefined : o.value)}
                            className={cn(
                                'p-3 rounded-xl border text-left transition-all',
                                bookingMethod === o.value
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)]'
                                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]',
                            )}
                        >
                            <p className="text-[12.5px] font-semibold text-foreground tracking-[-0.01em]">{o.label}</p>
                            <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{o.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className={labelCls}>Ажиллах цаг (нэгэн зэрэг)</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="Ня-Ба: 09:00 - 18:00"
                    value={getString(data, 'business_hours')}
                    onChange={(e) => setField('business_hours', e.target.value || undefined)}
                />
            </div>

            <ServiceCatalogEditor
                label="Үйлчилгээний жагсаалт"
                items={getObjectArray<ServiceCatalogItem>(data, 'service_catalog')}
                onChange={(next) => setField('service_catalog', next)}
            />

            <div>
                <label className={labelCls}>Захиалга цуцлах бодлого</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: 24 цагийн өмнө цуцалбал төлбөргүй"
                    value={getString(data, 'cancellation_policy')}
                    onChange={(e) => setField('cancellation_policy', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Урьдчилан захиалах боломжтой (хоног)</label>
                <input
                    type="number"
                    min={0}
                    max={365}
                    className={inputCls}
                    placeholder="30"
                    value={optNum(getNumber(data, 'advance_booking_days'))}
                    onChange={(e) => setField('advance_booking_days', e.target.value ? Number(e.target.value) : undefined)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Урьдчилгаа төлбөр шаардлагатай?</label>
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
                                    setField('requires_deposit', requiresDeposit === o.value ? undefined : o.value)
                                }
                                className={cn(
                                    'flex-1 px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                    requiresDeposit === o.value
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
                    <label className={labelCls}>Гэрт нь очиж үйлчилдэг?</label>
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
                                    setField('home_visit_enabled', homeVisit === o.value ? undefined : o.value)
                                }
                                className={cn(
                                    'flex-1 px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                    homeVisit === o.value
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
