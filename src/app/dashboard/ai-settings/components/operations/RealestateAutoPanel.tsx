'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ChipArrayInput } from './ChipArrayInput';
import { getNumber, getString, getStringArray, type Setup, type SetField } from './utils';

interface RealestateAutoPanelProps {
    data: Setup;
    setField: SetField;
}

function optNum(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function RealestateAutoPanel({ data, setField }: RealestateAutoPanelProps) {
    const category = getString(data, 'category');

    return (
        <div className="space-y-5">
            <div>
                <label className={labelCls}>Чиглэл</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(
                        [
                            { value: 'realestate', label: 'Үл хөдлөх' },
                            { value: 'auto', label: 'Авто' },
                            { value: 'both', label: 'Хоёулаа' },
                        ] as const
                    ).map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            onClick={() => setField('category', category === o.value ? undefined : o.value)}
                            className={cn(
                                'p-3 rounded-xl border text-left transition-all',
                                category === o.value
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)]'
                                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]',
                            )}
                        >
                            <p className="text-[12.5px] font-semibold text-foreground tracking-[-0.01em]">
                                {o.label}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Менежерийн тоо</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="3"
                        value={optNum(getNumber(data, 'agent_count'))}
                        onChange={(e) => setField('agent_count', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Үйлчилгээний бүс</label>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder="УБ, Дархан..."
                        value={getString(data, 'service_areas')}
                        onChange={(e) => setField('service_areas', e.target.value || undefined)}
                    />
                </div>
            </div>

            <ChipArrayInput
                label="Зарын төрлүүд"
                items={getStringArray(data, 'listing_types')}
                onChange={(next) => setField('listing_types', next)}
                placeholder="sale, rent, lease..."
            />

            <div>
                <label className={labelCls}>Санхүүгийн түнш</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="Хаан банк, Голомт банк..."
                    value={getString(data, 'financing_partners')}
                    onChange={(e) => setField('financing_partners', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Үзлэгийн бодлого</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: Урьдчилан цаг авч очно. Шуурхай үзлэг 24 цагт..."
                    value={getString(data, 'inspection_policy')}
                    onChange={(e) => setField('inspection_policy', e.target.value || undefined)}
                />
            </div>

            <ChipArrayInput
                label="Lead шалгах асуултууд"
                items={getStringArray(data, 'lead_qualification_questions')}
                onChange={(next) => setField('lead_qualification_questions', next)}
                placeholder="Жишээ: Танай төсөв хэдэн төгрөг вэ?"
                helpText="AI хэрэглэгчээс эдгээр асуултыг заавал асууж lead-г менежерт шилжүүлнэ."
            />
        </div>
    );
}
