'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import type { SeasonalPromotion } from '@/types/ai';

interface SeasonalPromotionsListProps {
    promotions: SeasonalPromotion[];
    onChange: (next: SeasonalPromotion[]) => void;
}

function toDateInput(iso?: string | null): string {
    if (!iso) return '';
    return iso.slice(0, 10);
}

function fromDateInput(date: string, endOfDay: boolean = false): string | null {
    if (!date) return null;
    return endOfDay ? `${date}T23:59:59.000Z` : `${date}T00:00:00.000Z`;
}

export function SeasonalPromotionsList({ promotions, onChange }: SeasonalPromotionsListProps) {
    const [draft, setDraft] = useState<SeasonalPromotion>({ name: '', description: '' });

    function add() {
        if (!draft.name.trim() || !draft.description.trim()) return;
        onChange([...promotions, draft]);
        setDraft({ name: '', description: '' });
    }

    function remove(idx: number) {
        onChange(promotions.filter((_, i) => i !== idx));
    }

    return (
        <div className="space-y-4">
            <p className="text-[11.5px] text-white/45 leading-relaxed">
                Цаг хугацаатай акц нэмнэ. AI зөвхөн идэвхтэй хугацаанд нь дурдана, дууссаны дараа автоматаар хасагдана.
            </p>

            {promotions.length > 0 && (
                <div className="space-y-2">
                    {promotions.map((p, idx) => (
                        <div
                            key={`${p.name}-${idx}`}
                            className="flex items-start justify-between gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                                    {p.name}
                                </p>
                                <p className="text-[11.5px] text-white/55 mt-0.5 leading-snug">{p.description}</p>
                                {(p.starts_at || p.ends_at) && (
                                    <p className="text-[10.5px] text-white/30 mt-1 uppercase tracking-[0.08em]">
                                        {toDateInput(p.starts_at) || '—'} → {toDateInput(p.ends_at) || '—'}
                                    </p>
                                )}
                            </div>
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

            <div className="p-3 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Акцын нэр</label>
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="Зуны хямдрал"
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Тайлбар</label>
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="Бүх барааны үнэ 20%-аар буурсан"
                            value={draft.description}
                            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Эхлэх огноо</label>
                        <input
                            type="date"
                            className={inputCls}
                            value={toDateInput(draft.starts_at)}
                            onChange={(e) => setDraft({ ...draft, starts_at: fromDateInput(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Дуусах огноо</label>
                        <input
                            type="date"
                            className={inputCls}
                            value={toDateInput(draft.ends_at)}
                            onChange={(e) => setDraft({ ...draft, ends_at: fromDateInput(e.target.value, true) })}
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={add}
                    disabled={!draft.name.trim() || !draft.description.trim()}
                    className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors',
                        draft.name.trim() && draft.description.trim()
                            ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_12%,transparent)] text-[var(--brand-indigo-400)] hover:bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)]'
                            : 'border-white/[0.06] bg-white/[0.02] text-white/30 cursor-not-allowed',
                    )}
                >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Акц нэмэх
                </button>
            </div>
        </div>
    );
}
