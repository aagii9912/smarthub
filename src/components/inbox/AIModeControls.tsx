'use client';

import { Power, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AiPauseMode } from './types';

interface AIModeControlsProps {
    value: AiPauseMode;
    onChange: (value: AiPauseMode) => void;
}

export function AIModeControls({ value, onChange }: AIModeControlsProps) {
    const { t } = useLanguage();
    return (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[10px] text-white/35 mr-1 uppercase tracking-[0.08em]">
                {t.inbox.aiMode.label}
            </span>
            <button
                type="button"
                onClick={() => onChange('pause')}
                className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all tracking-[-0.01em]',
                    value === 'pause'
                        ? 'border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-[var(--warning)]'
                        : 'border-white/[0.06] bg-white/[0.03] text-white/45 hover:bg-white/[0.05]'
                )}
            >
                <Timer className="w-3 h-3" strokeWidth={2} />
                {t.inbox.aiMode.pause30}
            </button>
            <button
                type="button"
                onClick={() => onChange('off')}
                className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all tracking-[-0.01em]',
                    value === 'off'
                        ? 'border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-[var(--destructive)]'
                        : 'border-white/[0.06] bg-white/[0.03] text-white/45 hover:bg-white/[0.05]'
                )}
            >
                <Power className="w-3 h-3" strokeWidth={2} />
                {t.inbox.aiMode.off}
            </button>
        </div>
    );
}
