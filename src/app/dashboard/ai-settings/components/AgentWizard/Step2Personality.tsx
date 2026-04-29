'use client';

import { Smile, Briefcase, Zap, Cloud, PartyPopper, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIEmotion } from '@/types/ai';

const EMOTION_OPTIONS: { value: AIEmotion; label: string; description: string; icon: React.ComponentType<{ className?: string }>; accent: string }[] = [
    { value: 'friendly', label: 'Найрсаг', description: 'Дотно, эелдэг, найз шиг ярьдаг', icon: Smile, accent: 'bg-emerald-100 text-emerald-700' },
    { value: 'professional', label: 'Мэргэжлийн', description: 'Хатуу, тодорхой, итгэлтэй', icon: Briefcase, accent: 'bg-blue-100 text-blue-700' },
    { value: 'enthusiastic', label: 'Урам зоригтой', description: 'Сэтгэл хөдлөлтэй, идэвхтэй', icon: Zap, accent: 'bg-amber-100 text-amber-700' },
    { value: 'calm', label: 'Тайван', description: 'Итгэл төрүүлэх, удаан хариу', icon: Cloud, accent: 'bg-slate-100 text-slate-700' },
    { value: 'playful', label: 'Тоглоомтой', description: 'Хошин шогтой, хөгжилтэй', icon: PartyPopper, accent: 'bg-pink-100 text-pink-700' },
];

interface Step2Props {
    agentName: string;
    onAgentNameChange: (name: string) => void;
    emotion: AIEmotion;
    onEmotionChange: (e: AIEmotion) => void;
    instructions: string;
    onInstructionsChange: (s: string) => void;
}

export function Step2Personality({
    agentName,
    onAgentNameChange,
    emotion,
    onEmotionChange,
    instructions,
    onInstructionsChange,
}: Step2Props) {
    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                    AI таны нэр, зан төлөв
                </h2>
                <p className="text-[13px] text-white/55 mt-1.5">
                    Хэрэглэгч таны AI agent-той ярилцахад ямар сэтгэгдэл төрүүлмээр байна?
                </p>
            </div>

            {/* Agent name */}
            <section>
                <label className="block text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-2">
                    AI-ийн нэр
                </label>
                <input
                    value={agentName}
                    onChange={(e) => onAgentNameChange(e.target.value.slice(0, 80))}
                    placeholder='Жишээ: "Сүхээ", "Алимаа", "Зөвлөгч"'
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13.5px] text-foreground placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo,#4A7CE7)]"
                    maxLength={80}
                />
                <p className="text-[11px] text-white/40 mt-2">
                    AI өөрийгөө танилцуулахдаа энэ нэрийг ашиглана.
                </p>
            </section>

            {/* Emotion */}
            <section>
                <label className="block text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                    Зан төлөв
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {EMOTION_OPTIONS.map((opt) => {
                        const isActive = emotion === opt.value;
                        const Icon = opt.icon;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => onEmotionChange(opt.value)}
                                className={cn(
                                    'relative flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all',
                                    isActive
                                        ? 'border-[var(--brand-indigo,#4A7CE7)] bg-[var(--brand-indigo,#4A7CE7)]/[0.08]'
                                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]',
                                )}
                            >
                                <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md', opt.accent)}>
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-semibold text-foreground tracking-tight">
                                        {opt.label}
                                    </span>
                                    <span className="block text-[11px] text-white/45 mt-0.5">
                                        {opt.description}
                                    </span>
                                </span>
                                {isActive && (
                                    <Check className="h-4 w-4 shrink-0 text-[var(--brand-indigo,#4A7CE7)]" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Custom instructions */}
            <section>
                <label className="block text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-2">
                    Нэмэлт заавар (заавал биш)
                </label>
                <textarea
                    value={instructions}
                    onChange={(e) => onInstructionsChange(e.target.value)}
                    placeholder="Бизнес тань өөр AI-ууудаас ялгарч буй онцлогийг бичнэ үү. Жишээ нь: 'Бид Mongolian брэндийн ноосон бараа эзэгнэдэг. Чанарыг онцлох.'"
                    rows={4}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo,#4A7CE7)] resize-none"
                    maxLength={1000}
                />
                <p className="text-[11px] text-white/40 mt-2">
                    {instructions.length} / 1000 тэмдэгт
                </p>
            </section>
        </div>
    );
}
