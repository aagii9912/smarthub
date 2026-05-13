'use client';

import { cn } from '@/lib/utils';
import { labelCls } from '../shared-styles';
import type { BrandVoice } from '@/types/ai';

const VOICE_OPTIONS: { value: BrandVoice; label: string; desc: string }[] = [
    { value: 'formal', label: 'Албан ёсны', desc: 'Хэмжсэн, мэргэжлийн' },
    { value: 'casual', label: 'Дотно', desc: 'Дотно, халуун дулаан' },
    { value: 'playful', label: 'Хөгжилтэй', desc: 'Хошин, emoji-той' },
    { value: 'luxurious', label: 'Тансаг', desc: 'Дэгжин, хүндэтгэлтэй' },
    { value: 'technical', label: 'Техникийн', desc: 'Нарийн, тодорхой' },
];

interface BrandVoiceFormProps {
    value?: BrandVoice;
    onChange: (next: BrandVoice | undefined) => void;
}

export function BrandVoiceForm({ value, onChange }: BrandVoiceFormProps) {
    return (
        <div>
            <label className={labelCls}>Брэнд хоолой (Brand Voice)</label>
            <p className="text-[11.5px] text-white/45 mb-3 leading-relaxed">
                Зан төлөвийн дээр нэмж брэндийн хэлбэрийг тогтооно. Сонгоогүй бол зөвхөн зан төлвийг ашиглана.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {VOICE_OPTIONS.map((opt) => {
                    const selected = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(selected ? undefined : opt.value)}
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
    );
}
