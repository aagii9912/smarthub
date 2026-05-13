'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ChipArrayInput } from './ChipArrayInput';
import { getBoolean, getString, getStringArray, type Setup, type SetField } from './utils';

interface RetailPanelProps {
    data: Setup;
    setField: SetField;
}

export function RetailPanel({ data, setField }: RetailPanelProps) {
    const inventory = getString(data, 'inventory_method');
    const taxRegistered = getBoolean(data, 'tax_registered');
    const origin = getString(data, 'brand_origin');

    return (
        <div className="space-y-5">
            <div>
                <label className={labelCls}>Бараа бүртгэх арга</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                        [
                            { value: 'manual', label: 'Гараар', desc: 'Жагсаалт, тэмдэглэлээр бүртгэдэг' },
                            { value: 'barcode', label: 'Баркод/POS', desc: 'Систем дээр автоматаар' },
                        ] as const
                    ).map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setField('inventory_method', inventory === o.value ? undefined : o.value)}
                            className={cn(
                                'p-3 rounded-xl border text-left transition-all',
                                inventory === o.value
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)]'
                                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]',
                            )}
                        >
                            <p className="text-[12.5px] font-semibold text-foreground tracking-[-0.01em]">
                                {o.label}
                            </p>
                            <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{o.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className={labelCls}>Агуулахын хаяг</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="СБД 1-р хороо..."
                    value={getString(data, 'warehouse_address')}
                    onChange={(e) => setField('warehouse_address', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>НӨАТ-д бүртгэлтэй юу?</label>
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
                            onClick={() => setField('tax_registered', taxRegistered === o.value ? undefined : o.value)}
                            className={cn(
                                'px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                taxRegistered === o.value
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-foreground'
                                    : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:text-white',
                            )}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            <ChipArrayInput
                label="Барааны ангилал"
                items={getStringArray(data, 'product_categories')}
                onChange={(next) => setField('product_categories', next)}
                placeholder="Хувцас, гутал, аксессуар..."
                helpText="AI хэрэглэгчид санал болгохдоо эдгээр ангилалаар бүлэглэнэ."
            />

            <div>
                <label className={labelCls}>Барааны гарал үүсэл</label>
                <div className="flex gap-2 flex-wrap">
                    {(
                        [
                            { value: 'local', label: 'Дотоодын' },
                            { value: 'imported', label: 'Импортын' },
                            { value: 'mixed', label: 'Хоёулаа' },
                        ] as const
                    ).map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setField('brand_origin', origin === o.value ? undefined : o.value)}
                            className={cn(
                                'px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                origin === o.value
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
                <label className={labelCls}>Баталгаат хугацааны бодлого</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: Электроник барааны хувьд 6 сарын баталгаа"
                    value={getString(data, 'warranty_policy')}
                    onChange={(e) => setField('warranty_policy', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Урамшууллын систем</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: 100,000₮-ийн худалдан авалт бүрт 1 тамга"
                    value={getString(data, 'loyalty_program')}
                    onChange={(e) => setField('loyalty_program', e.target.value || undefined)}
                />
            </div>
        </div>
    );
}
