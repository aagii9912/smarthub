'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import { ServiceCatalogEditor, type ServiceCatalogItem } from './ServiceCatalogEditor';
import { getBoolean, getNumber, getString, getObjectArray, type Setup, type SetField } from './utils';

interface BeautyPanelProps {
    data: Setup;
    setField: SetField;
}

interface Specialist {
    name: string;
    specialty?: string;
}

function optNum(v: number | undefined): string {
    return typeof v === 'number' ? String(v) : '';
}

export function BeautyPanel({ data, setField }: BeautyPanelProps) {
    const homeService = getBoolean(data, 'services_at_home');
    const walkIn = getBoolean(data, 'walk_in_accepted');
    const specialists = getObjectArray<Specialist>(data, 'specialist_list');
    const [draft, setDraft] = useState<Specialist>({ name: '' });

    function addSpecialist() {
        if (!draft.name.trim()) return;
        setField('specialist_list', [...specialists, draft]);
        setDraft({ name: '' });
    }

    function removeSpecialist(idx: number) {
        setField('specialist_list', specialists.filter((_, i) => i !== idx));
    }

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Ажилтны тоо</label>
                    <input
                        type="number"
                        min={0}
                        className={inputCls}
                        placeholder="2"
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
                        placeholder="45"
                        value={optNum(getNumber(data, 'default_duration_minutes'))}
                        onChange={(e) => setField('default_duration_minutes', e.target.value ? Number(e.target.value) : undefined)}
                    />
                </div>
            </div>

            <div>
                <label className={labelCls}>Салоны хаяг</label>
                <input
                    type="text"
                    className={inputCls}
                    placeholder="ХУД 11-р хороо..."
                    value={getString(data, 'salon_address')}
                    onChange={(e) => setField('salon_address', e.target.value || undefined)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                    setField('services_at_home', homeService === o.value ? undefined : o.value)
                                }
                                className={cn(
                                    'flex-1 px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                    homeService === o.value
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
                    <label className={labelCls}>Урьдчилсан захиалгагүй ирж болох уу?</label>
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
                                onClick={() => setField('walk_in_accepted', walkIn === o.value ? undefined : o.value)}
                                className={cn(
                                    'flex-1 px-4 py-2 rounded-lg border text-[12.5px] font-medium transition-colors',
                                    walkIn === o.value
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

            <ServiceCatalogEditor
                label="Үйлчилгээний жагсаалт"
                items={getObjectArray<ServiceCatalogItem>(data, 'service_menu')}
                onChange={(next) => setField('service_menu', next)}
                namePlaceholder="Үс засалт, маникюр..."
            />

            <div>
                <label className={labelCls}>Мэргэжилтнүүд</label>
                {specialists.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {specialists.map((s, idx) => (
                            <div
                                key={`${s.name}-${idx}`}
                                className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                            >
                                <span className="text-[12.5px] text-foreground tracking-[-0.01em]">{s.name}</span>
                                <span className="text-[11.5px] text-white/55">{s.specialty ?? '—'}</span>
                                <button
                                    type="button"
                                    onClick={() => removeSpecialist(idx)}
                                    className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
                                    aria-label="Устгах"
                                >
                                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <input
                        type="text"
                        className={inputCls}
                        placeholder="Нэр"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                    <input
                        type="text"
                        className={inputCls}
                        placeholder="Мэргэжил (жишээ: үсчин)"
                        value={draft.specialty ?? ''}
                        onChange={(e) => setDraft({ ...draft, specialty: e.target.value || undefined })}
                    />
                    <button
                        type="button"
                        onClick={addSpecialist}
                        disabled={!draft.name.trim()}
                        className={cn(
                            'px-3 py-2.5 rounded-lg border transition-colors',
                            draft.name.trim()
                                ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_12%,transparent)] text-[var(--brand-indigo-400)] hover:bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)]'
                                : 'border-white/[0.06] bg-white/[0.02] text-white/30 cursor-not-allowed',
                        )}
                    >
                        <Plus className="w-4 h-4" strokeWidth={2} />
                    </button>
                </div>
            </div>

            <div>
                <label className={labelCls}>Үйлчилгээний дараах зөвлөгөө</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Жишээ: 24 цаг хүртэл үс норгохгүй..."
                    value={getString(data, 'aftercare_instructions')}
                    onChange={(e) => setField('aftercare_instructions', e.target.value || undefined)}
                />
            </div>
        </div>
    );
}
