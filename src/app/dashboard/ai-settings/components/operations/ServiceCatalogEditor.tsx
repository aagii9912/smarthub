'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelCls, inputCls } from '../shared-styles';

export interface ServiceCatalogItem {
    name: string;
    duration?: number;
    price?: number;
}

interface ServiceCatalogEditorProps {
    items: ServiceCatalogItem[];
    onChange: (next: ServiceCatalogItem[]) => void;
    label?: string;
    namePlaceholder?: string;
}

export function ServiceCatalogEditor({
    items,
    onChange,
    label = 'Үйлчилгээний жагсаалт',
    namePlaceholder = 'Үйлчилгээний нэр',
}: ServiceCatalogEditorProps) {
    const [draft, setDraft] = useState<ServiceCatalogItem>({ name: '' });

    function add() {
        if (!draft.name.trim()) return;
        onChange([...items, draft]);
        setDraft({ name: '' });
    }

    function remove(idx: number) {
        onChange(items.filter((_, i) => i !== idx));
    }

    return (
        <div>
            <label className={labelCls}>{label}</label>

            {items.length > 0 && (
                <div className="space-y-2 mb-3">
                    {items.map((it, idx) => (
                        <div
                            key={`${it.name}-${idx}`}
                            className="grid grid-cols-[1fr_120px_120px_auto] items-center gap-2 p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                        >
                            <span className="text-[12.5px] text-foreground tracking-[-0.01em]">{it.name}</span>
                            <span className="text-[11.5px] text-white/55">
                                {typeof it.duration === 'number' ? `${it.duration} мин` : '—'}
                            </span>
                            <span className="text-[11.5px] text-white/55">
                                {typeof it.price === 'number' ? `${it.price.toLocaleString()}₮` : '—'}
                            </span>
                            <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
                                aria-label="Устгах"
                            >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-[1fr_120px_120px_auto] items-end gap-2">
                <input
                    type="text"
                    className={inputCls}
                    placeholder={namePlaceholder}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <input
                    type="number"
                    min={0}
                    max={1440}
                    className={inputCls}
                    placeholder="Мин"
                    value={draft.duration ?? ''}
                    onChange={(e) =>
                        setDraft({
                            ...draft,
                            duration: e.target.value ? Number(e.target.value) : undefined,
                        })
                    }
                />
                <input
                    type="number"
                    min={0}
                    className={inputCls}
                    placeholder="Үнэ"
                    value={draft.price ?? ''}
                    onChange={(e) =>
                        setDraft({
                            ...draft,
                            price: e.target.value ? Number(e.target.value) : undefined,
                        })
                    }
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={!draft.name.trim()}
                    className={cn(
                        'px-3 py-2.5 rounded-lg border transition-colors',
                        draft.name.trim()
                            ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_12%,transparent)] text-[var(--brand-indigo-400)] hover:bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)]'
                            : 'border-white/[0.06] bg-white/[0.02] text-white/30 cursor-not-allowed',
                    )}
                    aria-label="Нэмэх"
                >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}
