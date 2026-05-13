'use client';

import { cn } from '@/lib/utils';
import { labelCls } from '../shared-styles';
import type { AISupportedLanguage } from '@/types/ai';

const LANG_OPTIONS: { value: AISupportedLanguage; label: string; flag: string }[] = [
    { value: 'mn', label: 'Монгол', flag: '🇲🇳' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
];

interface SupportedLanguagesPickerProps {
    languages: AISupportedLanguage[];
    onChange: (next: AISupportedLanguage[]) => void;
}

export function SupportedLanguagesPicker({ languages, onChange }: SupportedLanguagesPickerProps) {
    function toggle(lang: AISupportedLanguage) {
        if (languages.includes(lang)) {
            // mn is always available — don't let user uncheck it explicitly
            if (lang === 'mn') return;
            onChange(languages.filter((l) => l !== lang));
        } else {
            onChange([...languages, lang]);
        }
    }

    return (
        <div>
            <label className={labelCls}>Дэмждэг хэлнүүд</label>
            <p className="text-[11.5px] text-white/45 mb-3 leading-relaxed">
                AI хэрэглэгчийн мессежийн хэлийг автоматаар таних чадвартай. Зөвхөн сонгогдсон хэлүүдийг таних болно. Монгол хэл анхдагч тул заавал асаагдсан.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {LANG_OPTIONS.map((opt) => {
                    const selected = languages.includes(opt.value);
                    const isLocked = opt.value === 'mn';
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggle(opt.value)}
                            disabled={isLocked && selected}
                            className={cn(
                                'p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all',
                                selected
                                    ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)]'
                                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]',
                                isLocked && selected && 'cursor-default',
                            )}
                        >
                            <span className="text-xl leading-none">{opt.flag}</span>
                            <span className="text-[12px] font-medium text-foreground tracking-[-0.01em]">
                                {opt.label}
                            </span>
                            {isLocked && (
                                <span className="text-[9px] uppercase tracking-[0.08em] text-white/30">
                                    Анхдагч
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
