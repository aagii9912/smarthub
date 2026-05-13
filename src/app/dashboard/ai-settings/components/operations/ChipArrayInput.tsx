'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { labelCls, inputCls } from '../shared-styles';

interface ChipArrayInputProps {
    label: string;
    items: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    helpText?: string;
}

export function ChipArrayInput({ label, items, onChange, placeholder, helpText }: ChipArrayInputProps) {
    const [draft, setDraft] = useState('');

    function add() {
        const t = draft.trim();
        if (!t || items.includes(t)) {
            setDraft('');
            return;
        }
        onChange([...items, t]);
        setDraft('');
    }

    function remove(idx: number) {
        onChange(items.filter((_, i) => i !== idx));
    }

    return (
        <div>
            <label className={labelCls}>{label}</label>
            {helpText && (
                <p className="text-[11.5px] text-white/45 mb-2 leading-relaxed">{helpText}</p>
            )}

            <div className="flex gap-2 mb-3">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder={placeholder}
                    className={inputCls}
                />
                <button
                    type="button"
                    onClick={add}
                    className="px-3 py-2.5 rounded-lg border border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_12%,transparent)] text-[var(--brand-indigo-400)] hover:bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] transition-colors"
                    aria-label="Нэмэх"
                >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                </button>
            </div>

            {items.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {items.map((t, idx) => (
                        <span
                            key={`${t}-${idx}`}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px]',
                                'border border-white/[0.08] bg-white/[0.03] text-white/80',
                            )}
                        >
                            {t}
                            <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="text-white/45 hover:text-white transition-colors"
                                aria-label={`${t}-г устгах`}
                            >
                                <X className="w-3 h-3" strokeWidth={2} />
                            </button>
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-[11.5px] text-white/30 italic">Хоосон.</p>
            )}
        </div>
    );
}
