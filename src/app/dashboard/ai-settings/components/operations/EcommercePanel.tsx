'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ChipArrayInput } from './ChipArrayInput';
import { getBoolean, getNumber, getString, getStringArray, type Setup, type SetField } from './utils';

interface EcommercePanelProps {
    data: Setup;
    setField: SetField;
}

function optNum(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function EcommercePanel({ data, setField }: EcommercePanelProps) {
    const tracking = getBoolean(data, 'inventory_tracking');

    return (
        <div className="space-y-5">
            <div>
                <label className={labelCls}>Хүргэлтийн бүс</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="УБ, орон нутаг..."
                    value={getString(data, 'shipping_zones')}
                    onChange={(e) => setField('shipping_zones', e.target.value || undefined)}
                />
            </div>

            <ChipArrayInput
                label="Төлбөрийн арга"
                items={getStringArray(data, 'payment_methods')}
                onChange={(next) => setField('payment_methods', next)}
                placeholder="qpay, cod, bank_transfer..."
            />

            <div>
                <label className={labelCls}>Үлдэгдэл хянах уу?</label>
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
                            onClick={() => setField('inventory_tracking', tracking === o.value ? undefined : o.value)}
                            className={cn(
                                'px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                tracking === o.value
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-foreground'
                                    : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white',
                            )}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Захиалга боловсруулах хугацаа (цаг)</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="24"
                        value={optNum(getNumber(data, 'dispatch_sla_hours'))}
                        onChange={(e) => setField('dispatch_sla_hours', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Буцаах хугацаа (хоног)</label>
                    <input
                        type="number"
                        min={0}
                        max={365}
                        className={inputCls}
                        placeholder="7"
                        value={optNum(getNumber(data, 'return_window_days'))}
                        onChange={(e) => setField('return_window_days', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
            </div>

            <div>
                <label className={labelCls}>Размерийн хүснэгтийн линк</label>
                <input
                    type="url"
                    className={inputCls}
                    placeholder="https://..."
                    value={getString(data, 'size_chart_url')}
                    onChange={(e) => setField('size_chart_url', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Брэндийн түүх</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[80px]')}
                    placeholder="Танай дэлгүүр хэзээ үүссэн, юунд онцлогтой..."
                    value={getString(data, 'brand_story')}
                    onChange={(e) => setField('brand_story', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Урьдчилсан захиалгын бодлого</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: 50% урьдчилгаа, бараа ирэхэд үлдсэн нь"
                    value={getString(data, 'pre_order_policy')}
                    onChange={(e) => setField('pre_order_policy', e.target.value || undefined)}
                />
            </div>
        </div>
    );
}
