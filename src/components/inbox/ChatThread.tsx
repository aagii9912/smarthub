'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { STALE_MEMO_DELTA } from '@/lib/inbox/constants';
import { useInbox } from './InboxProvider';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { MessageInput } from './MessageInput';
import { AIMemoCard } from './AIMemoCard';
import type {
    AiPauseMode,
    ChatMessage,
    ConversationDetailResponse,
    InboxCustomerDetail,
    MessagingWindowState,
    SummaryResponse,
} from './types';

const TONES = ['indigo', 'violet', 'emerald', 'cyan', 'rose', 'amber'] as const;
type Tone = (typeof TONES)[number];

function toneFor(id: string): Tone {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return TONES[h % TONES.length];
}

interface ChatThreadProps {
    customerId: string;
}

export function ChatThread({ customerId }: ChatThreadProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const { shopId, patchConversation, refreshConversations } = useInbox();

    const [customer, setCustomer] = useState<InboxCustomerDetail | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [lastInboundAt, setLastInboundAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [replyValue, setReplyValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [aiPauseMode, setAiPauseMode] = useState<AiPauseMode>('pause');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const autoRegenAttemptedRef = useRef<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!shopId) return;
        try {
            setLoading(true);
            setNotFound(false);
            const res = await fetch(`/api/dashboard/conversations/${customerId}`, {
                headers: { 'x-shop-id': shopId },
            });
            if (res.status === 404) {
                setNotFound(true);
                return;
            }
            if (!res.ok) {
                throw new Error('Failed to load conversation');
            }
            const data = (await res.json()) as ConversationDetailResponse;
            setCustomer(data.customer);
            setMessages(data.messages);
            setLastInboundAt(data.last_customer_message_at);
        } catch {
            toast.error(t.inbox.error);
        } finally {
            setLoading(false);
        }
    }, [customerId, shopId, t.inbox.error]);

    useEffect(() => {
        autoRegenAttemptedRef.current = null;
        void fetchDetail();
    }, [fetchDetail]);

    const regenerateSummary = useCallback(async () => {
        if (!shopId || !customer) return;
        try {
            setSummaryLoading(true);
            const res = await fetch(
                `/api/dashboard/conversations/${customerId}/summary`,
                {
                    method: 'POST',
                    headers: { 'x-shop-id': shopId },
                }
            );
            if (!res.ok) {
                throw new Error('Summary failed');
            }
            const data = (await res.json()) as SummaryResponse;
            setCustomer((prev) =>
                prev
                    ? {
                          ...prev,
                          ai_summary: data.summary,
                          ai_summary_updated_at: data.updated_at,
                          ai_summary_message_count: data.message_count,
                      }
                    : prev
            );
            patchConversation(customerId, {
                ai_summary: data.summary,
                ai_summary_updated_at: data.updated_at,
                ai_summary_message_count: data.message_count,
            });
        } catch {
            toast.error(t.inbox.memo.regenerateError);
        } finally {
            setSummaryLoading(false);
        }
    }, [customer, customerId, shopId, patchConversation, t.inbox.memo.regenerateError]);

    const isStale = useMemo(() => {
        if (!customer) return false;
        if (!customer.ai_summary) return true;
        const lastCount = customer.ai_summary_message_count ?? 0;
        return messages.length - lastCount >= STALE_MEMO_DELTA;
    }, [customer, messages.length]);

    const windowState: MessagingWindowState = useMemo(() => {
        if (!lastInboundAt) return 'expired';
        const hours = (Date.now() - new Date(lastInboundAt).getTime()) / 3_600_000;
        if (hours <= 24) return 'within_24h';
        if (hours <= 168) return 'within_7d';
        return 'expired';
    }, [lastInboundAt]);

    useEffect(() => {
        if (loading || !customer) return;
        if (autoRegenAttemptedRef.current === customerId) return;
        if (!isStale) return;
        if (summaryLoading) return;
        autoRegenAttemptedRef.current = customerId;
        void regenerateSummary();
    }, [customerId, customer, isStale, loading, summaryLoading, regenerateSummary]);

    const handleSendReply = useCallback(async () => {
        if (!replyValue.trim() || isSending || !shopId) return;
        const messageText = replyValue.trim();
        setIsSending(true);
        setReplyValue('');

        const optimistic: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'assistant',
            content: messageText,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
            const res = await fetch('/api/dashboard/conversations/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId,
                },
                body: JSON.stringify({
                    customerId,
                    message: messageText,
                    aiPauseMode,
                }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    code?: string;
                    details?: string;
                    last_customer_message_at?: string | null;
                };
                if (data.code === 'OUTSIDE_MESSAGING_WINDOW') {
                    toast.error(t.inbox.window.expiredToast);
                    setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
                    setReplyValue(messageText);
                    if (data.last_customer_message_at !== undefined) {
                        setLastInboundAt(data.last_customer_message_at);
                    }
                    return;
                }
                throw new Error(data.error || data.details || t.inbox.sendError);
            }
            toast.success(t.inbox.messageSent);
            patchConversation(customerId, {
                last_message: messageText,
                last_message_at: optimistic.created_at,
            });
            void refreshConversations();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t.inbox.sendError);
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
            setReplyValue(messageText);
        } finally {
            setIsSending(false);
        }
    }, [
        replyValue,
        isSending,
        shopId,
        customerId,
        aiPauseMode,
        t.inbox.sendError,
        t.inbox.messageSent,
        t.inbox.window.expiredToast,
        patchConversation,
        refreshConversations,
    ]);

    const handleDelete = useCallback(async () => {
        if (!customer) return;
        const name = customer.name || 'Customer';
        if (
            !window.confirm(
                t.inbox.deleteConfirm.replace('{name}', name)
            )
        ) {
            return;
        }
        try {
            const res = await fetch(
                `/api/dashboard/customers?id=${customerId}`,
                {
                    method: 'DELETE',
                    headers: { 'x-shop-id': shopId },
                }
            );
            if (!res.ok) throw new Error('Failed');
            toast.success(t.inbox.deleted);
            await refreshConversations();
            router.push('/dashboard/inbox');
        } catch {
            toast.error(t.inbox.deleteError);
        }
    }, [customer, customerId, shopId, t.inbox, refreshConversations, router]);

    if (loading && !customer) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-white/40" />
            </div>
        );
    }

    if (notFound || !customer) {
        return (
            <div className="flex-1 flex items-center justify-center text-white/45 text-[13px] p-10">
                {t.inbox.notFound}
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-[#09090b]">
            <ChatHeader
                customer={customer}
                messageCount={messages.length}
                onDelete={handleDelete}
                avatarTone={toneFor(customer.id)}
            />

            <div className="px-4 md:px-5 pt-4">
                <AIMemoCard
                    summary={customer.ai_summary}
                    updatedAt={customer.ai_summary_updated_at}
                    isStale={isStale}
                    isLoading={summaryLoading}
                    onRegenerate={regenerateSummary}
                />
            </div>

            <ChatMessages messages={messages} />

            <MessageInput
                value={replyValue}
                onChange={setReplyValue}
                onSend={handleSendReply}
                isSending={isSending}
                aiPauseMode={aiPauseMode}
                onAiPauseModeChange={setAiPauseMode}
                windowState={windowState}
                autoFocus
            />
        </div>
    );
}
