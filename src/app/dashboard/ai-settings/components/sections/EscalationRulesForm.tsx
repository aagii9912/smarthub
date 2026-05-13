'use client';

import { labelCls, inputCls } from '../shared-styles';
import { cn } from '@/lib/utils';
import type { EscalationRules } from '@/types/ai';

interface EscalationRulesFormProps {
    rules: EscalationRules;
    onChange: (next: EscalationRules) => void;
}

export function EscalationRulesForm({ rules, onChange }: EscalationRulesFormProps) {
    function update<K extends keyof EscalationRules>(key: K, value: EscalationRules[K]) {
        onChange({ ...rules, [key]: value });
    }

    return (
        <div className="space-y-4">
            <div>
                <label className={labelCls}>Гомдол ирэхэд</label>
                <p className="text-[11.5px] text-white/45 mb-3 leading-relaxed">
                    Хэрэглэгч гомдол илэрхийлсэн тохиолдолд AI юу хийх вэ?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                        [
                            { value: 'log', label: 'Зөвхөн бүртгэх', desc: 'AI үргэлжлүүлэн ярина, гомдлыг бүртгэнэ' },
                            { value: 'handoff', label: 'Хүн рүү шилжүүлэх', desc: 'Шууд оператор руу холбоно' },
                        ] as const
                    ).map((opt) => {
                        const selected = rules.on_complaint === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => update('on_complaint', opt.value)}
                                className={cn(
                                    'p-3 rounded-xl border text-left transition-all',
                                    selected
                                        ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)]'
                                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]',
                                )}
                            >
                                <p className="text-[12.5px] font-semibold text-foreground tracking-[-0.01em]">
                                    {opt.label}
                                </p>
                                <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{opt.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className={labelCls}>Хүн рүү шилжүүлэх утас</label>
                <input
                    type="tel"
                    className={inputCls}
                    placeholder="99119911"
                    value={rules.handoff_phone ?? ''}
                    onChange={(e) => update('handoff_phone', e.target.value || undefined)}
                />
            </div>

            <div>
                <label className={labelCls}>Ажлын цагаас гадуурх мессеж</label>
                <textarea
                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                    placeholder="Ажлын цагаас гадуурх мессеж ирвэл AI юу гэж хариулах вэ?"
                    value={rules.after_hours_message ?? ''}
                    onChange={(e) => update('after_hours_message', e.target.value || undefined)}
                />
            </div>
        </div>
    );
}
