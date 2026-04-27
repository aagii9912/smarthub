'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Inbox as InboxIcon, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInbox } from './InboxProvider';
import { ConversationListItem } from './ConversationListItem';

export function InboxList() {
    const { t } = useLanguage();
    const { conversations, loading, searchQuery, setSearchQuery } = useInbox();
    const params = useParams<{ customerId?: string }>();
    const activeId = params?.customerId ?? null;

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter((c) =>
            (c.customer_name || '').toLowerCase().includes(q) ||
            (c.last_message || '').toLowerCase().includes(q)
        );
    }, [conversations, searchQuery]);

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="p-3 border-b border-white/[0.06]">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                    <input
                        type="text"
                        placeholder={t.common.search + '...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] rounded-xl text-[13px] text-foreground placeholder:text-white/35 border border-white/[0.06] focus:border-[var(--border-accent)] focus:bg-white/[0.05] outline-none transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading && conversations.length === 0 ? (
                    <div className="space-y-px">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="px-4 py-3.5 border-b border-white/[0.04] flex items-start gap-3"
                            >
                                <div className="w-10 h-10 rounded-full bg-white/[0.04] animate-pulse" />
                                <div className="flex-1 space-y-2 pt-1">
                                    <div className="h-3 w-2/3 bg-white/[0.04] rounded animate-pulse" />
                                    <div className="h-3 w-4/5 bg-white/[0.03] rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2 py-16 px-4 text-center">
                        <InboxIcon className="w-8 h-8" strokeWidth={1.5} />
                        <p className="text-[13px]">
                            {searchQuery ? t.inbox.noSearchResults : t.inbox.noConversations}
                        </p>
                    </div>
                ) : (
                    filtered.map((convo) => (
                        <ConversationListItem
                            key={convo.id}
                            conversation={convo}
                            isActive={activeId === convo.id}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
