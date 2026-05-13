'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ChipArrayInput } from './ChipArrayInput';
import { getBoolean, getNumber, getString, getStringArray, type Setup, type SetField } from './utils';

interface RestaurantPanelProps {
    data: Setup;
    setField: SetField;
}

function optInputNumber(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function RestaurantPanel({ data, setField }: RestaurantPanelProps) {
    const deliveryEnabled = getBoolean(data, 'delivery_enabled');

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Ширээний тоо</label>
                    <input
                        type="number"
                        min={0}
                        max={500}
                        className={inputCls}
                        placeholder="20"
                        value={optInputNumber(getNumber(data, 'table_count'))}
                        onChange={(e) => setField('table_count', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Дундаж бэлдэх хугацаа (минут)</label>
                    <input
                        type="number"
                        min={0}
                        max={240}
                        className={inputCls}
                        placeholder="15"
                        value={optInputNumber(getNumber(data, 'avg_prep_minutes'))}
                        onChange={(e) => setField('avg_prep_minutes', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
            </div>

            <div>
                <label className={labelCls}>Хүргэлтийн үйлчилгээ үзүүлэх үү?</label>
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
                                setField('delivery_enabled', deliveryEnabled === o.value ? undefined : o.value)
                            }
                            className={cn(
                                'px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                deliveryEnabled === o.value
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-foreground'
                                    : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white',
                            )}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {deliveryEnabled && (
                <div>
                    <label className={labelCls}>Хүргэлтийн бүс / дүүрэг</label>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder="СБД, ЧД, БГД..."
                        value={getString(data, 'delivery_zones')}
                        onChange={(e) => setField('delivery_zones', e.target.value || undefined)}
                    />
                </div>
            )}

            <ChipArrayInput
                label="Цэсний ангилал"
                items={getStringArray(data, 'menu_categories')}
                onChange={(next) => setField('menu_categories', next)}
                placeholder="Үндсэн хоол, шөл, амттан..."
                helpText="AI цэсийг бүлэглэж танилцуулна."
            />

            <ChipArrayInput
                label="Тусгай хоолны сонголт"
                items={getStringArray(data, 'dietary_options')}
                onChange={(next) => setField('dietary_options', next)}
                placeholder="vegan, halal, gluten-free..."
                helpText="Хэрэглэгч асуувал AI эдгээр сонголтуудыг танилцуулна."
            />

            <div>
                <label className={labelCls}>Ачаалал ихтэй цаг</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="12:00-14:00, 18:30-21:00"
                    value={getString(data, 'peak_hours')}
                    onChange={(e) => setField('peak_hours', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Ширээ захиалгын бодлого</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="Захиалга авдаг / зөвхөн ирсэн дарааллаар"
                    value={getString(data, 'reservation_policy')}
                    onChange={(e) => setField('reservation_policy', e.target.value || undefined)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Хүргэлтийн доод дүн (₮)</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="25000"
                        value={optInputNumber(getNumber(data, 'min_order_value'))}
                        onChange={(e) => setField('min_order_value', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Үйлчилгээний хураамж (%)</label>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        className={inputCls}
                        placeholder="10"
                        value={optInputNumber(getNumber(data, 'service_fee_percent'))}
                        onChange={(e) => setField('service_fee_percent', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
            </div>
        </div>
    );
}
