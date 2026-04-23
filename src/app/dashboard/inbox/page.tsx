'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Loader2,
    Send,
    MessageSquare,
    User,
    Bot,
    Search,
    Inbox as InboxIcon,
    Timer,
    Power,
    Trash2,
    Sparkles,
    Phone,
    MoreHorizontal,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHero } from '@/components/ui/PageHero';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

interface Conversation {
    id: string;
    customer_name: string;
    customer_avatar: string | null;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    messages: ChatMessage[];
}

type AvatarTone = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
const TONES: AvatarTone[] = ['indigo', 'violet', 'emerald', 'cyan', 'rose', 'amber'];
function toneFor(id: string): AvatarTone {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return TONES[h % TONES.length];
}

export default function InboxPage() {
    const { t } = useLanguage();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [replyMessage, setReplyMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [aiPauseMode, setAiPauseMode] = useState<'pause' | 'off'>('pause');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const shopId =
        typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    const fetchConversations = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/dashboard/conversations', {
                headers: { 'x-shop-id': shopId },
            });
            if (res.ok) {
                const data = await res.json();
                setConversations(data.conversations || []);
            }
        } catch {
            toast.error(t.inbox.error);
        } finally {
            setLoading(false);
        }
    }, [shopId, t.inbox.error]);

    useEffect(() => {
        if (shopId) fetchConversations();
    }, [shopId, fetchConversations]);

    const selectConversation = (convo: Conversation) => {
        setActiveId(convo.id);
        const sorted = [...convo.messages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setChatMessages(sorted);
        setReplyMessage('');
    };

    const handleDeleteCustomer = async (customerId: string, name: string) => {
        if (!confirm(`"${name || 'Customer'}" хэрэглэгчийг устгах уу? Чат түүх бүгд устана.`))
            return;
        try {
            const res = await fetch(`/api/dashboard/customers?id=${customerId}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': shopId },
            });
            if (!res.ok) throw new Error('Failed');
            setActiveId(null);
            setChatMessages([]);
            toast.success('Хэрэглэгч устгагдлаа');
            fetchConversations();
        } catch {
            toast.error('Устгахад алдаа гарлаа');
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSendReply = async () => {
        if (!replyMessage.trim() || isSending || !activeId) return;

        const messageText = replyMessage.trim();
        setIsSending(true);
        setReplyMessage('');

        const optimisticMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'assistant',
            content: messageText,
            created_at: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, optimisticMsg]);

        try {
            const res = await fetch('/api/dashboard/conversations/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId,
                },
                body: JSON.stringify({
                    customerId: activeId,
                    message: messageText,
                    aiPauseMode,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || data.details || t.inbox.sendError);
            }

            toast.success(t.inbox.messageSent);
            if (aiPauseMode === 'off') {
                toast('AI agent off', {
                    icon: '⛔',
                    description: 'AI is disabled for this customer until you turn it back on.',
                });
            } else {
                toast(t.inbox.aiPaused, {
                    icon: '⏸️',
                    description: t.inbox.aiPausedDesc,
                });
            }
            inputRef.current?.focus();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : t.inbox.sendError);
            setChatMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
            setReplyMessage(messageText);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendReply();
        }
    };

    const formatTime = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleTimeString('mn-MN', {
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '';
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diff = now.getTime() - d.getTime();
            if (diff < 86400000) return formatTime(dateStr);
            if (diff < 172800000) return 'Өчигдөр';
            return d.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    const filtered = conversations.filter((c) =>
        c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeConvo = conversations.find((c) => c.id === activeId);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="h-[calc(100vh-260px)] card-outlined animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <PageHero
                eyebrow="Харилцан яриа"
                live
                title="Хавсарга"
                subtitle="Facebook Messenger болон Instagram-ын бүх ярианууд нэг дороос."
                actions={
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/70">
                        <MessageSquare
                            className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                            strokeWidth={1.5}
                        />
                        <span className="font-medium tabular-nums tracking-[-0.01em]">
                            {conversations.length} харилцагч
                        </span>
                    </div>
                }
            />

            <div className="flex-1 min-h-[520px] card-outlined overflow-hidden grid grid-cols-1 md:grid-cols-[340px_1fr]">
                {/* Left: Conversation list */}
                <div className="flex flex-col border-b md:border-b-0 md:border-r border-white/[0.06] min-h-0">
                    {/* Search */}
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

                    {/* Conversations */}
                    <div className="flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2 py-12">
                                <InboxIcon className="w-8 h-8" strokeWidth={1.5} />
                                <p className="text-[13px]">{t.inbox.noActiveCarts}</p>
                            </div>
                        ) : (
                            filtered.map((convo) => {
                                const isActive = activeId === convo.id;
                                return (
                                    <button
                                        key={convo.id}
                                        onClick={() => selectConversation(convo)}
                                        className={cn(
                                            'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all border-b border-white/[0.04]',
                                            isActive
                                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] shadow-[inset_2px_0_0_var(--brand-indigo)]'
                                                : 'hover:bg-white/[0.02]'
                                        )}
                                    >
                                        <Avatar
                                            tone={toneFor(convo.id)}
                                            fallback={convo.customer_name}
                                            size="md"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        'text-[13px] truncate tracking-[-0.01em]',
                                                        convo.unread_count > 0
                                                            ? 'font-semibold text-foreground'
                                                            : 'font-medium text-white/80'
                                                    )}
                                                >
                                                    {convo.customer_name || 'Guest'}
                                                </span>
                                                <span className="text-[10px] text-white/40 shrink-0 tabular-nums font-mono">
                                                    {formatDate(convo.last_message_at)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p
                                                    className={cn(
                                                        'text-[12px] truncate flex-1',
                                                        convo.unread_count > 0
                                                            ? 'text-white/85 font-medium'
                                                            : 'text-white/45'
                                                    )}
                                                >
                                                    {convo.last_message || '…'}
                                                </p>
                                                {convo.unread_count > 0 && (
                                                    <span
                                                        className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] font-bold text-white tabular-nums"
                                                        style={{
                                                            background: 'var(--brand-indigo)',
                                                            boxShadow: 'var(--shadow-cta-indigo)',
                                                        }}
                                                    >
                                                        {convo.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: Chat area */}
                <div className="flex flex-col min-h-0">
                    {!activeConvo ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3 p-10">
                            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                <MessageSquare className="w-7 h-7" strokeWidth={1.5} />
                            </div>
                            <p className="text-[13px] tracking-[-0.01em]">{t.inbox.selectCustomer}</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-3">
                                <Avatar
                                    tone={toneFor(activeConvo.id)}
                                    fallback={activeConvo.customer_name}
                                    size="md"
                                    status="online"
                                />
                                <div className="min-w-0">
                                    <p className="text-[14px] font-semibold text-foreground tracking-[-0.01em] truncate">
                                        {activeConvo.customer_name || 'Guest'}
                                    </p>
                                    <p className="text-[11px] text-white/45 tabular-nums">
                                        {chatMessages.length} {t.inbox.messages}
                                    </p>
                                </div>
                                <div className="ml-auto flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Phone"
                                    >
                                        <Phone className="w-4 h-4" strokeWidth={1.5} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="More"
                                    >
                                        <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Delete"
                                        onClick={() =>
                                            handleDeleteCustomer(
                                                activeConvo.id,
                                                activeConvo.customer_name
                                            )
                                        }
                                        className="text-white/40 hover:text-[var(--destructive)]"
                                    >
                                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                    </Button>
                                </div>
                            </div>

                            {/* AI handoff banner */}
                            <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-[12px]"
                                style={{
                                    background:
                                        'linear-gradient(90deg, color-mix(in oklab, var(--brand-indigo) 14%, transparent), transparent 70%)',
                                    border: '1px solid color-mix(in oklab, var(--brand-indigo) 24%, transparent)',
                                }}
                            >
                                <Sparkles
                                    className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                                    strokeWidth={1.8}
                                />
                                <span className="text-white/55 tracking-[-0.01em]">
                                    <span className="font-semibold text-foreground">AI агент</span>{' '}
                                    энэ харилцан яриаг удирдаж байна
                                </span>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {chatMessages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-white/30 text-[13px]">
                                        {t.inbox.emptyChatHistory}
                                    </div>
                                ) : (
                                    chatMessages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                'flex gap-2.5',
                                                msg.role === 'assistant'
                                                    ? 'justify-end'
                                                    : 'justify-start'
                                            )}
                                        >
                                            {msg.role === 'user' && (
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo-400)]">
                                                    <User className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    'max-w-[72%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed tracking-[-0.01em]',
                                                    msg.role === 'assistant'
                                                        ? 'rounded-br-md text-foreground'
                                                        : 'rounded-bl-md bg-white/[0.05] text-white/85'
                                                )}
                                                style={
                                                    msg.role === 'assistant'
                                                        ? {
                                                              background:
                                                                  'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                                                              boxShadow: 'var(--shadow-cta-indigo)',
                                                          }
                                                        : undefined
                                                }
                                            >
                                                {msg.content}
                                                <div
                                                    className={cn(
                                                        'text-[10px] mt-1 tabular-nums',
                                                        msg.role === 'assistant'
                                                            ? 'text-white/60'
                                                            : 'text-white/30'
                                                    )}
                                                >
                                                    {formatTime(msg.created_at)}
                                                </div>
                                            </div>
                                            {msg.role === 'assistant' && (
                                                <div
                                                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                                    style={{
                                                        background:
                                                            'color-mix(in oklab, var(--success) 18%, transparent)',
                                                        color: 'var(--success)',
                                                    }}
                                                >
                                                    <Bot className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Reply input */}
                            <div className="px-4 py-3 border-t border-white/[0.06]">
                                <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
                                    <span className="text-[10px] text-white/35 mr-1 uppercase tracking-[0.08em]">
                                        AI mode
                                    </span>
                                    <button
                                        onClick={() => setAiPauseMode('pause')}
                                        className={cn(
                                            'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all tracking-[-0.01em]',
                                            aiPauseMode === 'pause'
                                                ? 'border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-[var(--warning)]'
                                                : 'border-white/[0.06] bg-white/[0.03] text-white/45 hover:bg-white/[0.05]'
                                        )}
                                    >
                                        <Timer className="w-3 h-3" strokeWidth={2} />
                                        30 мин түр зогсоох
                                    </button>
                                    <button
                                        onClick={() => setAiPauseMode('off')}
                                        className={cn(
                                            'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all tracking-[-0.01em]',
                                            aiPauseMode === 'off'
                                                ? 'border-[color-mix(in_oklab,var(--destructive)_35%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-[var(--destructive)]'
                                                : 'border-white/[0.06] bg-white/[0.03] text-white/45 hover:bg-white/[0.05]'
                                        )}
                                    >
                                        <Power className="w-3 h-3" strokeWidth={2} />
                                        AI унтраах
                                    </button>
                                </div>
                                <div className="flex items-end gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-2.5 focus-within:border-[var(--border-accent)] focus-within:bg-white/[0.05] transition-colors">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={t.inbox.messagePlaceholder}
                                        disabled={isSending}
                                        className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-white/35 outline-none px-1.5 py-1 disabled:opacity-50 tracking-[-0.01em]"
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!replyMessage.trim() || isSending}
                                        className="h-9 w-9 rounded-lg flex items-center justify-center text-white disabled:opacity-30 disabled:pointer-events-none transition-transform active:scale-95"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                                            boxShadow: 'var(--shadow-cta-indigo)',
                                        }}
                                        aria-label="Send"
                                    >
                                        {isSending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" strokeWidth={2} />
                                        )}
                                    </button>
                                </div>
                                <div className="mt-2 flex items-center gap-3 text-[11px] text-white/35 px-1 tracking-[-0.01em]">
                                    <span>⌘ + Enter илгээх</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
