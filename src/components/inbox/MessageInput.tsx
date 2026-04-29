'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Ban, Loader2, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AIModeControls } from './AIModeControls';
import type { AiPauseMode, MessagingWindowState } from './types';

interface MessageInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    isSending: boolean;
    aiPauseMode: AiPauseMode;
    onAiPauseModeChange: (value: AiPauseMode) => void;
    autoFocus?: boolean;
    windowState?: MessagingWindowState;
}

export function MessageInput({
    value,
    onChange,
    onSend,
    isSending,
    aiPauseMode,
    onAiPauseModeChange,
    autoFocus,
    windowState = 'within_24h',
}: MessageInputProps) {
    const { t } = useLanguage();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const expired = windowState === 'expired';
    const stale = windowState === 'within_7d';

    useEffect(() => {
        if (autoFocus && !expired) {
            textareaRef.current?.focus();
        }
    }, [autoFocus, expired]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!expired) onSend();
        }
    };

    return (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-[#09090b]">
            <div className="mb-2">
                <AIModeControls value={aiPauseMode} onChange={onAiPauseModeChange} />
            </div>

            {stale && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-200/90 tracking-[-0.01em]">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{t.inbox.window.within7dWarning}</span>
                </div>
            )}

            {expired && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-200/90 tracking-[-0.01em]">
                    <Ban className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{t.inbox.window.expiredNotice}</span>
                </div>
            )}

            <div className="flex items-end gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-2.5 focus-within:border-[var(--border-accent)] focus-within:bg-white/[0.05] transition-colors">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.inbox.messagePlaceholder}
                    disabled={isSending || expired}
                    rows={1}
                    className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-white/35 outline-none px-1.5 py-1 disabled:opacity-50 tracking-[-0.01em] resize-none max-h-[160px]"
                />
                <button
                    type="button"
                    onClick={onSend}
                    disabled={!value.trim() || isSending || expired}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-white disabled:opacity-30 disabled:pointer-events-none transition-transform active:scale-95 shrink-0"
                    style={{
                        background:
                            'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                        boxShadow: 'var(--shadow-cta-indigo)',
                    }}
                    aria-label={t.inbox.send}
                >
                    {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" strokeWidth={2} />
                    )}
                </button>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[11px] text-white/35 px-1 tracking-[-0.01em]">
                <span>{t.inbox.cmdEnterToSend}</span>
            </div>
        </div>
    );
}
