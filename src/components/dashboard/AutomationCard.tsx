'use client';

import {
    ToggleLeft,
    ToggleRight,
    Pencil,
    Trash2,
    Zap,
    TrendingUp,
    Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CommentAutomation } from '@/types/database';

export type Automation = CommentAutomation;

interface AutomationCardProps {
    automation: Automation;
    onToggle: (id: string, currentState: boolean) => void;
    onEdit: (automation: Automation) => void;
    onDelete: (id: string) => void;
}

function platformBadge(platform: Automation['platform']) {
    if (platform === 'facebook') {
        return (
            <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                    background: 'color-mix(in oklab, var(--brand-indigo) 18%, transparent)',
                    color: 'var(--brand-indigo-400)',
                }}
            >
                FB
            </span>
        );
    }
    if (platform === 'instagram') {
        return (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-pink-500/15 text-pink-300">
                IG
            </span>
        );
    }
    return (
        <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{
                background: 'color-mix(in oklab, var(--brand-violet-500) 20%, transparent)',
                color: 'color-mix(in oklab, var(--brand-violet-500) 65%, #fff)',
            }}
        >
            FB+IG
        </span>
    );
}

export function AutomationCard({ automation: a, onToggle, onEdit, onDelete }: AutomationCardProps) {
    const { t, locale } = useLanguage();
    const c = t.commentAutomation;
    const dateLocale = locale === 'mn' ? 'mn-MN' : 'en-US';

    const actionLabel =
        a.action_type === 'send_dm'
            ? c.cardActionDm
            : a.action_type === 'reply_comment'
              ? c.cardActionReply
              : c.cardActionBoth;

    return (
        <div
            className={cn(
                'card-outlined p-5 transition-colors',
                !a.is_active && 'opacity-60'
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* Name & Status */}
                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => onToggle(a.id, a.is_active)}
                            className="shrink-0 rounded-md"
                            aria-label={a.is_active ? c.cardAriaToggleOn : c.cardAriaToggleOff}
                        >
                            {a.is_active ? (
                                <ToggleRight
                                    className="w-6 h-6"
                                    style={{ color: 'var(--success)' }}
                                    strokeWidth={1.5}
                                />
                            ) : (
                                <ToggleLeft
                                    className="w-6 h-6 text-white/25"
                                    strokeWidth={1.5}
                                />
                            )}
                        </button>
                        <h3 className="text-[14px] font-semibold text-foreground truncate tracking-[-0.01em]">
                            {a.name}
                        </h3>
                        {platformBadge(a.platform)}
                    </div>

                    {/* Keywords */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {a.trigger_keywords.map((kw, i) => (
                            <span
                                key={i}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/55 border border-white/[0.06] tracking-[-0.01em]"
                            >
                                {kw}
                            </span>
                        ))}
                        <span className="text-[10px] text-white/30 self-center ml-1">
                            ({a.match_type === 'contains' ? c.cardMatchContains : c.cardMatchExact})
                        </span>
                    </div>

                    {/* DM Preview */}
                    <p className="text-[12px] text-white/50 truncate max-w-lg tracking-[-0.01em]">
                        💬 {a.dm_message}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-white/40">
                        <span className="flex items-center gap-1 tabular-nums">
                            <TrendingUp className="w-3 h-3" />
                            {a.trigger_count} {c.cardTriggerCountSuffix}
                        </span>
                        <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {actionLabel}
                        </span>
                        {a.last_triggered_at && (
                            <span className="flex items-center gap-1 tabular-nums">
                                <Clock className="w-3 h-3" />
                                {new Date(a.last_triggered_at).toLocaleDateString(dateLocale)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => onEdit(a)}
                        className="p-2 rounded-lg text-white/40 hover:text-[var(--brand-indigo-400)] hover:bg-white/[0.04] transition-all"
                        aria-label={c.cardAriaEdit}
                    >
                        <Pencil className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button
                        onClick={() => onDelete(a.id)}
                        className="p-2 rounded-lg text-white/40 hover:bg-white/[0.04] transition-all"
                        style={{
                            transition: 'color 150ms, background-color 150ms',
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--destructive)';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = '';
                        }}
                        aria-label={c.cardAriaDelete}
                    >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                </div>
            </div>
        </div>
    );
}
