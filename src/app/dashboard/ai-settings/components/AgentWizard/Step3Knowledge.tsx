'use client';

import { useState } from 'react';
import { Plus, Trash2, BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface FAQEntry {
    id?: string;
    question: string;
    answer: string;
}

interface Step3Props {
    faqs: FAQEntry[];
    onFaqsChange: (faqs: FAQEntry[]) => void;
    suggestedFaqs: { question: string; answer: string }[];
    description: string;
    onDescriptionChange: (s: string) => void;
}

export function Step3Knowledge({
    faqs,
    onFaqsChange,
    suggestedFaqs,
    description,
    onDescriptionChange,
}: Step3Props) {
    const [newQ, setNewQ] = useState('');
    const [newA, setNewA] = useState('');

    const addFaq = () => {
        const q = newQ.trim();
        const a = newA.trim();
        if (!q || !a) return;
        onFaqsChange([...faqs, { question: q, answer: a }]);
        setNewQ('');
        setNewA('');
    };

    const removeFaq = (idx: number) => {
        onFaqsChange(faqs.filter((_, i) => i !== idx));
    };

    const importSuggested = (s: { question: string; answer: string }) => {
        if (faqs.some((f) => f.question === s.question)) return;
        onFaqsChange([...faqs, s]);
    };

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                    AI юу мэдэх ёстой вэ?
                </h2>
                <p className="text-[13px] text-white/55 mt-1.5">
                    Бизнесийн товч тайлбар, түгээмэл асуултын хариулт. AI энэ мэдээллийг хэрэглэн хэрэглэгчид зөв хариу өгнө.
                </p>
            </div>

            {/* Description */}
            <section>
                <label className="block text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-2">
                    Бизнесийн тайлбар
                </label>
                <textarea
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder='Жишээ: "Манай дэлгүүр нь өндөр чанарын импорт цүнх, гутал борлуулж 5 жил болсон..."'
                    rows={3}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo,#4A7CE7)] resize-none"
                    maxLength={500}
                />
                <p className="text-[11px] text-white/40 mt-2">{description.length} / 500</p>
            </section>

            {/* Suggested FAQs */}
            {suggestedFaqs.length > 0 && (
                <section>
                    <h3 className="flex items-center gap-2 text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                        <Sparkles className="h-3 w-3" />
                        Санал болгож буй FAQ
                    </h3>
                    <div className="space-y-2">
                        {suggestedFaqs.map((s, idx) => {
                            const imported = faqs.some((f) => f.question === s.question);
                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                                        imported
                                            ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                                            : 'border-white/[0.06] bg-white/[0.02]',
                                    )}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] font-semibold text-foreground tracking-tight">{s.question}</p>
                                        <p className="text-[11.5px] text-white/55 mt-1 line-clamp-2">{s.answer}</p>
                                    </div>
                                    <Button
                                        size="xs"
                                        variant={imported ? 'ghost' : 'secondary'}
                                        onClick={() => importSuggested(s)}
                                        disabled={imported}
                                    >
                                        {imported ? '✓ Нэмсэн' : 'Нэмэх'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Existing FAQs */}
            <section>
                <h3 className="flex items-center gap-2 text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                    <BookOpen className="h-3 w-3" />
                    Таны FAQ ({faqs.length})
                </h3>
                {faqs.length === 0 ? (
                    <p className="text-[12px] text-white/40 mb-3">
                        Одоогоор FAQ нэмэгдээгүй байна. Дээрх жишээнээс эсвэл доороос нэмж болно.
                    </p>
                ) : (
                    <div className="space-y-2 mb-4">
                        {faqs.map((f, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-semibold text-foreground tracking-tight">{f.question}</p>
                                    <p className="text-[11.5px] text-white/55 mt-1">{f.answer}</p>
                                </div>
                                <button
                                    onClick={() => removeFaq(idx)}
                                    className="rounded p-1 text-white/40 hover:text-rose-400 hover:bg-rose-500/10"
                                    aria-label="Устгах"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add new */}
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                    <input
                        value={newQ}
                        onChange={(e) => setNewQ(e.target.value)}
                        placeholder="Асуулт"
                        className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12.5px] text-foreground placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo,#4A7CE7)]"
                    />
                    <textarea
                        value={newA}
                        onChange={(e) => setNewA(e.target.value)}
                        placeholder="Хариулт"
                        rows={2}
                        className="w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12.5px] text-foreground placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo,#4A7CE7)] resize-none"
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                        onClick={addFaq}
                        disabled={!newQ.trim() || !newA.trim()}
                    >
                        Нэмэх
                    </Button>
                </div>
            </section>
        </div>
    );
}
