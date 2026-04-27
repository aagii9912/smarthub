'use client';

import { MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function EmptyThreadState() {
    const { t } = useLanguage();
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3 p-10">
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                    background:
                        'linear-gradient(135deg, color-mix(in oklab, var(--brand-indigo) 14%, transparent), color-mix(in oklab, var(--brand-violet-500) 10%, transparent))',
                    border: '1px solid color-mix(in oklab, var(--brand-indigo) 22%, transparent)',
                }}
            >
                <MessageSquare
                    className="w-7 h-7 text-[var(--brand-indigo-400)]"
                    strokeWidth={1.5}
                />
            </div>
            <p className="text-[13px] tracking-[-0.01em] text-white/55">
                {t.inbox.thread.empty}
            </p>
        </div>
    );
}
