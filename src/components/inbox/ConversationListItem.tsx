import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ChannelBadge } from './ChannelBadge';
import { deriveChannel, type InboxConversation } from './types';

const TONES = ['indigo', 'violet', 'emerald', 'cyan', 'rose', 'amber'] as const;
type Tone = (typeof TONES)[number];

function toneFor(id: string): Tone {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return TONES[h % TONES.length];
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 86_400_000) {
            return d.toLocaleTimeString('mn-MN', {
                hour: '2-digit',
                minute: '2-digit',
            });
        }
        if (diff < 172_800_000) return 'Өчигдөр';
        return d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

function firstBullet(summary: string | null): string | null {
    if (!summary) return null;
    const first = summary
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
    if (!first) return null;
    return first.replace(/^[•·\-*]\s*/, '');
}

interface ConversationListItemProps {
    conversation: InboxConversation;
    isActive: boolean;
}

export function ConversationListItem({
    conversation,
    isActive,
}: ConversationListItemProps) {
    const tone = toneFor(conversation.id);
    const channel = deriveChannel({
        facebook_id: conversation.facebook_id,
        instagram_id: conversation.instagram_id,
    });
    const memoLine = firstBullet(conversation.ai_summary);
    const isUnread = conversation.unread_count > 0;

    return (
        <Link
            href={`/dashboard/inbox/${conversation.id}`}
            prefetch
            scroll={false}
            className={cn(
                'block w-full px-4 py-3.5 text-left transition-all border-b border-white/[0.04]',
                isActive
                    ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] shadow-[inset_2px_0_0_var(--brand-indigo)]'
                    : 'hover:bg-white/[0.02]'
            )}
        >
            <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                    <Avatar
                        tone={tone}
                        fallback={conversation.customer_name || 'Зочин'}
                        size="md"
                    />
                    {channel !== 'unknown' && (
                        <ChannelBadge
                            channel={channel}
                            className="absolute -bottom-0.5 -right-0.5"
                        />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className={cn(
                                'text-[13px] truncate tracking-[-0.01em]',
                                isUnread
                                    ? 'font-semibold text-foreground'
                                    : 'font-medium text-white/80'
                            )}
                        >
                            {conversation.customer_name || 'Зочин'}
                        </span>
                        <span className="text-[10px] text-white/40 shrink-0 tabular-nums font-mono">
                            {formatDate(conversation.last_message_at)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                        <p
                            className={cn(
                                'text-[12px] truncate flex-1',
                                isUnread
                                    ? 'text-white/85 font-medium'
                                    : 'text-white/45'
                            )}
                        >
                            {conversation.last_message || '…'}
                        </p>
                        {isUnread && (
                            <span
                                className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] font-bold text-white tabular-nums"
                                style={{
                                    background: 'var(--brand-indigo)',
                                    boxShadow: 'var(--shadow-cta-indigo)',
                                }}
                            >
                                {conversation.unread_count}
                            </span>
                        )}
                    </div>

                    {memoLine && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <Sparkles
                                className="w-3 h-3 text-[var(--brand-indigo-400)] shrink-0"
                                strokeWidth={2}
                            />
                            <p className="text-[11px] text-[var(--brand-indigo-400)]/85 font-medium truncate">
                                {memoLine}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
