'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { InboxMessageBubble } from './InboxMessageBubble';
import type { ChatMessage } from './types';

interface ChatMessagesProps {
    messages: ChatMessage[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
    const { t } = useLanguage();
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-white/30 text-[13px] p-5">
                {t.inbox.emptyChatHistory}
            </div>
        );
    }

    return (
        <div
            className="flex-1 overflow-y-auto p-5 space-y-3"
            role="log"
            aria-live="polite"
            aria-label={t.inbox.chatHistory}
        >
            {messages.map((msg) => (
                <InboxMessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={endRef} />
        </div>
    );
}
