'use client';

import { ArrowLeft, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChannelBadge } from './ChannelBadge';
import { deriveChannel, type InboxCustomerDetail } from './types';

interface ChatHeaderProps {
    customer: InboxCustomerDetail;
    messageCount: number;
    onDelete: () => void;
    avatarTone:
        | 'indigo'
        | 'violet'
        | 'emerald'
        | 'cyan'
        | 'rose'
        | 'amber';
}

export function ChatHeader({
    customer,
    messageCount,
    onDelete,
    avatarTone,
}: ChatHeaderProps) {
    const { t } = useLanguage();
    const router = useRouter();

    const channel = deriveChannel({
        facebook_id: customer.facebook_id,
        instagram_id: customer.instagram_id,
    });

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/dashboard/inbox');
        }
    };

    return (
        <div className="px-3 md:px-5 py-3 md:py-3.5 border-b border-white/[0.06] flex items-center gap-3">
            <button
                type="button"
                onClick={handleBack}
                className="md:hidden -ml-1 p-2 rounded-lg text-white/65 hover:text-white hover:bg-white/[0.04] transition-colors"
                aria-label={t.inbox.thread.back}
            >
                <ArrowLeft className="w-5 h-5" strokeWidth={1.8} />
            </button>

            <div className="relative">
                <Avatar
                    tone={avatarTone}
                    fallback={customer.name || 'Зочин'}
                    size="md"
                />
                {channel !== 'unknown' && (
                    <ChannelBadge
                        channel={channel}
                        className="absolute -bottom-0.5 -right-0.5"
                    />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground tracking-[-0.01em] truncate">
                    {customer.name || 'Зочин'}
                </p>
                <p className="text-[11px] text-white/45 tabular-nums">
                    {messageCount} {t.inbox.messages}
                </p>
            </div>

            <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="More">
                    <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.common.delete}
                    onClick={onDelete}
                    className="text-white/40 hover:text-[var(--destructive)]"
                >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </Button>
            </div>
        </div>
    );
}
