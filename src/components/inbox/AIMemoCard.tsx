'use client';

import { Loader2, RefreshCw, Sparkles, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AIMemoCardProps {
    summary: string | null;
    updatedAt: string | null;
    isStale: boolean;
    isLoading: boolean;
    onRegenerate: () => void;
}

function parseBullets(summary: string): string[] {
    return summary
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^[•·\-*]\s*/, ''))
        .filter((line) => line.length > 0);
}

function formatRelative(iso: string | null, t: ReturnType<typeof useLanguage>['t']): string {
    if (!iso) return '';
    try {
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60_000) return t.inbox.memo.justNow;
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}${t.inbox.memo.minutesAgoSuffix}`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}${t.inbox.memo.hoursAgoSuffix}`;
        return `${Math.floor(diff / 86_400_000)}${t.inbox.memo.daysAgoSuffix}`;
    } catch {
        return '';
    }
}

export function AIMemoCard({
    summary,
    updatedAt,
    isStale,
    isLoading,
    onRegenerate,
}: AIMemoCardProps) {
    const { t } = useLanguage();
    const [collapsed, setCollapsed] = useState(false);

    const bullets = useMemo(() => (summary ? parseBullets(summary) : []), [summary]);
    const relative = useMemo(() => formatRelative(updatedAt, t), [updatedAt, t]);

    const isEmpty = !summary && !isLoading;

    return (
        <div
            className="rounded-2xl px-4 py-3.5"
            style={{
                background:
                    'linear-gradient(135deg, color-mix(in oklab, var(--brand-indigo) 12%, transparent), color-mix(in oklab, var(--brand-violet-500) 8%, transparent))',
                border: '1px solid color-mix(in oklab, var(--brand-indigo) 24%, transparent)',
            }}
        >
            <div className="flex items-center gap-2">
                <Sparkles
                    className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                    strokeWidth={2}
                />
                <span className="text-[12px] font-semibold text-foreground tracking-[-0.01em]">
                    {t.inbox.memo.title}
                </span>
                {relative && !isLoading && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-white/40 tabular-nums">
                        <Clock className="w-3 h-3" strokeWidth={1.6} />
                        {relative}
                    </span>
                )}
                {isStale && !isLoading && summary && (
                    <span className="text-[10px] font-medium text-[var(--warning)] px-1.5 py-0.5 rounded-md bg-[color-mix(in_oklab,var(--warning)_14%,transparent)]">
                        {t.inbox.memo.stale}
                    </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onRegenerate}
                        disabled={isLoading}
                        className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                            'text-[var(--brand-indigo-400)] hover:bg-white/[0.05] disabled:opacity-50 disabled:pointer-events-none'
                        )}
                        aria-label={t.inbox.memo.regenerate}
                    >
                        {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3 h-3" strokeWidth={2} />
                        )}
                        <span className="hidden sm:inline">{t.inbox.memo.regenerate}</span>
                    </button>
                    {!isEmpty && (
                        <button
                            type="button"
                            onClick={() => setCollapsed((v) => !v)}
                            className="p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
                            aria-label={collapsed ? t.inbox.memo.expand : t.inbox.memo.collapse}
                            aria-expanded={!collapsed}
                        >
                            {collapsed ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronUp className="w-3.5 h-3.5" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {!collapsed && (
                <div className="mt-2.5 text-[12.5px] leading-relaxed tracking-[-0.01em]">
                    {isLoading && !summary && (
                        <div className="space-y-1.5">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="h-3 bg-white/[0.05] rounded animate-pulse"
                                    style={{ width: `${85 - i * 8}%` }}
                                />
                            ))}
                        </div>
                    )}

                    {!isLoading && isEmpty && (
                        <p className="text-white/45 text-[12px]">
                            {t.inbox.memo.empty}
                        </p>
                    )}

                    {bullets.length > 0 && (
                        <ul className="space-y-1.5 text-white/85">
                            {bullets.map((bullet, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="text-[var(--brand-indigo-400)] shrink-0 mt-[1px]">
                                        •
                                    </span>
                                    <span>{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
