'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CustomerList } from '@/components/dashboard/CustomerList';
import { ActiveCartWidget } from '@/components/dashboard/ActiveCartWidget';
import { useActiveCarts } from '@/hooks/useActiveCarts';
import { toast } from 'sonner';
import {
    ShoppingCart,
    Loader2,
    ArrowLeft,
    Info,
    RefreshCcw,
    Send,
    MessageSquare,
    User,
    Bot,
    PauseCircle,
    Crown,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
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
    messages: ChatMessage[];
}

export default function CartPage() {
    const { data: carts = [], isLoading, error, refetch } = useActiveCarts();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isReminding, setIsReminding] = useState(false);

    const [replyMessage, setReplyMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const shopId =
        typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    const fetchChatHistory = useCallback(
        async (customerId: string) => {
            setLoadingChat(true);
            setChatMessages([]);
            try {
                const res = await fetch('/api/dashboard/conversations', {
                    headers: { 'x-shop-id': shopId },
                });
                if (res.ok) {
                    const data = await res.json();
                    const convo = (data.conversations || []).find(
                        (c: Conversation) => c.id === customerId
                    );
                    if (convo?.messages) {
                        const sorted = [...convo.messages].sort(
                            (a: ChatMessage, b: ChatMessage) =>
                                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        );
                        setChatMessages(sorted.slice(-20));
                    }
                }
            } catch {
                // Silent fail — chat history is supplementary
            } finally {
                setLoadingChat(false);
            }
        },
        [shopId]
    );

    useEffect(() => {
        if (activeId) {
            const cart = carts.find((c) => c.id === activeId);
            if (cart?.customer?.id) {
                fetchChatHistory(cart.customer.id);
            }
        } else {
            setChatMessages([]);
        }
        setReplyMessage('');
    }, [activeId, carts, fetchChatHistory]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSendReply = async () => {
        if (!replyMessage.trim() || isSending || !activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart?.customer?.id) return;

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
                    customerId: cart.customer.id,
                    message: messageText,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Мессеж илгээхэд алдаа гарлаа');
            }

            toast.success('Мессеж илгээгдлээ');
            toast('AI agent 30 минут зогссон', {
                icon: '⏸️',
                description: 'Та гараар хариулж байгаа учир AI түр зогслоо.',
            });
            inputRef.current?.focus();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
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

    const handleConvertToOrder = async () => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart) return;

        try {
            setIsConverting(true);
            const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'checkout',
                    customer_id: cart.customer.id,
                    notes: 'Dashboard Cart Checkout',
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Захиалга үүсгэхэд алдаа гарлаа');
            }

            toast.success(data.message || 'Захиалга амжилттай үүслээ');

            await refetch();
            setActiveId(null);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setIsConverting(false);
        }
    };

    const handleSendReminder = async () => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart) return;

        try {
            setIsReminding(true);
            const res = await fetch('/api/dashboard/inbox/remind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: cart.customer.id,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Сануулга илгээхэд алдаа гарлаа');
            }

            toast.success(data.message || 'Сануулга илгээгдлээ');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setIsReminding(false);
        }
    };

    const handleUpdateQuantity = async (itemId: string, quantity: number) => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart?.customer?.id) return;

        try {
            const res = await fetch('/api/cart', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId,
                },
                body: JSON.stringify({
                    item_id: itemId,
                    customer_id: cart.customer.id,
                    quantity,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Шинэчлэхэд алдаа гарлаа');
            }
            await refetch();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart?.customer?.id) return;

        try {
            const res = await fetch(
                `/api/cart?item_id=${itemId}&customer_id=${cart.customer.id}`,
                {
                    method: 'DELETE',
                    headers: { 'x-shop-id': shopId },
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Устгахад алдаа гарлаа');
            }
            toast.success(data.message || 'Бараа хасагдлаа');
            await refetch();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    useEffect(() => {
        if (carts.length > 0 && !activeId && window.innerWidth >= 768) {
            setActiveId(carts[0].id);
        }
    }, [carts, activeId]);

    const activeCart = carts.find((c) => c.id === activeId);
    const handleSelect = (id: string) => setActiveId(id);
    const handleBack = () => setActiveId(null);

    const header = (
        <PageHero
            eyebrow="Идэвхтэй сагс"
            live
            title="Сагс & Checkout"
            subtitle="AI-тай яриа үргэлжилж буй харилцагчдын сагс, тэдэнтэй шууд мессеж солих."
            actions={
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/70">
                    <ShoppingCart
                        className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                        strokeWidth={1.5}
                    />
                    <span className="font-medium tabular-nums tracking-[-0.01em]">
                        {carts.length} сагс
                    </span>
                </div>
            }
        />
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="h-[calc(100vh-260px)] card-outlined animate-pulse" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                {header}
                <div className="card-outlined p-10 flex flex-col items-center justify-center text-center">
                    <p
                        className="text-[13px] mb-4 tracking-[-0.01em]"
                        style={{ color: 'var(--destructive)' }}
                    >
                        Алдаа гарлаа: {(error as Error).message}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}
                    >
                        Дахин ачаалах
                    </Button>
                </div>
            </div>
        );
    }

    if (carts.length === 0) {
        return (
            <div className="space-y-6">
                {header}
                <div className="card-outlined p-14 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                        <ShoppingCart
                            className="w-7 h-7 text-[var(--brand-indigo-400)]"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-[16px] font-semibold text-foreground mb-1 tracking-[-0.02em]">
                        Идэвхтэй сагс байхгүй
                    </h3>
                    <p className="text-[13px] text-white/45 max-w-sm mb-6 tracking-[-0.01em]">
                        Одоогоор ямар нэгэн хэрэглэгч бараа сонирхоогүй байна.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}
                    >
                        Шинэчлэх
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            {header}

            <div className="flex-1 min-h-[520px] card-outlined overflow-hidden flex flex-col md:flex-row">
                {/* Left: Customer List */}
                <div
                    className={cn(
                        'w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-white/[0.06] h-full flex flex-col min-h-0',
                        activeId ? 'hidden md:flex' : 'flex'
                    )}
                >
                    <CustomerList
                        carts={carts}
                        activeId={activeId || undefined}
                        onSelect={handleSelect}
                    />
                </div>

                {/* Right: Active Cart Details + Chat */}
                <div
                    className={cn(
                        'flex-1 h-full flex flex-col min-w-0',
                        activeId ? 'flex' : 'hidden md:flex'
                    )}
                >
                    {activeCart ? (
                        <div className="h-full flex flex-col">
                            {/* Mobile Header */}
                            <div className="md:hidden flex items-center px-4 py-3 border-b border-white/[0.06]">
                                <button
                                    onClick={handleBack}
                                    className="mr-3 p-2 -ml-2 rounded-md hover:bg-white/[0.04] transition-colors"
                                    aria-label="Back"
                                >
                                    <ArrowLeft className="w-5 h-5 text-white/50" strokeWidth={1.5} />
                                </button>
                                <div>
                                    <h3 className="font-semibold text-foreground text-[14px] tracking-[-0.01em]">
                                        {activeCart.customer.name}
                                    </h3>
                                    <p className="text-[11px] text-[var(--brand-indigo-400)] tabular-nums">
                                        Нийт: ₮{activeCart.totalAmount.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                <div className="max-w-2xl mx-auto space-y-5">
                                    <ActiveCartWidget
                                        customerName={activeCart.customer.name}
                                        items={activeCart.items}
                                        onConvertToOrder={handleConvertToOrder}
                                        onSendReminder={handleSendReminder}
                                        onUpdateQuantity={handleUpdateQuantity}
                                        onRemoveItem={handleRemoveItem}
                                        isLoading={isConverting || isReminding}
                                    />

                                    {/* Chat History */}
                                    <div className="card-outlined overflow-hidden">
                                        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                            <h4 className="text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] flex items-center gap-2">
                                                <MessageSquare
                                                    className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                                                    strokeWidth={1.5}
                                                />
                                                Чат түүх
                                            </h4>
                                            {chatMessages.length > 0 && (
                                                <span className="text-[10px] text-white/35 tabular-nums">
                                                    {chatMessages.length} мессеж
                                                </span>
                                            )}
                                        </div>

                                        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                                            {loadingChat ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                                                </div>
                                            ) : chatMessages.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <MessageSquare
                                                        className="w-8 h-8 text-white/15 mx-auto mb-2"
                                                        strokeWidth={1.5}
                                                    />
                                                    <p className="text-[12px] text-white/30">
                                                        Чат түүх хоосон байна
                                                    </p>
                                                </div>
                                            ) : (
                                                chatMessages.map((msg) => (
                                                    <div
                                                        key={msg.id}
                                                        className={cn(
                                                            'flex gap-2',
                                                            msg.role === 'assistant'
                                                                ? 'justify-end'
                                                                : 'justify-start'
                                                        )}
                                                    >
                                                        {msg.role === 'user' && (
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo-400)]">
                                                                <User className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                        <div
                                                            className={cn(
                                                                'max-w-[75%] rounded-xl px-3 py-2',
                                                                msg.role === 'assistant'
                                                                    ? 'rounded-br-sm text-foreground'
                                                                    : 'rounded-bl-sm bg-white/[0.05] text-white/80'
                                                            )}
                                                            style={
                                                                msg.role === 'assistant'
                                                                    ? {
                                                                          background:
                                                                              'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                                                                      }
                                                                    : undefined
                                                            }
                                                        >
                                                            <p className="text-[12px] leading-relaxed whitespace-pre-wrap break-words tracking-[-0.01em]">
                                                                {msg.content}
                                                            </p>
                                                            <p
                                                                className={cn(
                                                                    'text-[9px] mt-1 tabular-nums',
                                                                    msg.role === 'assistant'
                                                                        ? 'text-white/60'
                                                                        : 'text-white/30'
                                                                )}
                                                            >
                                                                {new Date(
                                                                    msg.created_at
                                                                ).toLocaleTimeString('mn-MN', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}
                                                            </p>
                                                        </div>
                                                        {msg.role === 'assistant' && (
                                                            <div
                                                                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                                                style={{
                                                                    background:
                                                                        'color-mix(in oklab, var(--success) 18%, transparent)',
                                                                    color: 'var(--success)',
                                                                }}
                                                            >
                                                                <Bot className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>
                                    </div>

                                    {/* Customer Info Card */}
                                    <div className="card-outlined p-5">
                                        <h4 className="text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] mb-4 flex items-center gap-2">
                                            <Info
                                                className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                                                strokeWidth={1.5}
                                            />
                                            Хэрэглэгчийн мэдээлэл
                                        </h4>
                                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Нэр
                                                </dt>
                                                <dd className="font-medium text-foreground tracking-[-0.01em]">
                                                    {activeCart.customer.name}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Facebook ID
                                                </dt>
                                                <dd className="font-mono text-[12px] text-white/55">
                                                    {activeCart.customer.facebookId || 'N/A'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Сүүлийн үйлдэл
                                                </dt>
                                                <dd className="text-foreground tracking-[-0.01em]">
                                                    {activeCart.lastActive
                                                        ? new Date(
                                                              activeCart.lastActive
                                                          ).toLocaleString()
                                                        : 'N/A'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Статус
                                                </dt>
                                                <dd>
                                                    {activeCart.customer.isVip ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                            style={{
                                                                background:
                                                                    'color-mix(in oklab, var(--gold) 20%, transparent)',
                                                                color: 'var(--gold)',
                                                            }}
                                                        >
                                                            <Crown className="w-3 h-3" />
                                                            VIP
                                                        </span>
                                                    ) : (
                                                        <span className="text-white/45 text-[12px]">
                                                            Энгийн
                                                        </span>
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>
                            </div>

                            {/* Reply bar */}
                            <div className="border-t border-white/[0.06] px-4 py-3 bg-white/[0.015]">
                                {activeCart.customer.facebookId ? (
                                    <>
                                        <div className="max-w-2xl mx-auto flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-2.5 focus-within:border-[var(--border-accent)] focus-within:bg-white/[0.05] transition-colors">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={replyMessage}
                                                onChange={(e) => setReplyMessage(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Мессеж бичих... (Enter = илгээх)"
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
                                                    <Send className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="max-w-2xl mx-auto text-[11px] text-white/35 mt-2 flex items-center gap-1 tracking-[-0.01em]">
                                            <PauseCircle className="w-3 h-3" />
                                            Гараар хариулахад AI agent 30 мин зогсно
                                        </p>
                                    </>
                                ) : (
                                    <p
                                        className="max-w-2xl mx-auto text-[11px] flex items-center gap-1.5 py-1 tracking-[-0.01em]"
                                        style={{ color: 'var(--warning)' }}
                                    >
                                        <Info className="w-3.5 h-3.5 shrink-0" />
                                        Хэрэглэгчид Facebook ID байхгүй тул мессеж илгээх боломжгүй
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                                    <ShoppingCart
                                        className="w-7 h-7 text-[var(--brand-indigo-400)]"
                                        strokeWidth={1.5}
                                    />
                                </div>
                                <p className="text-[13px] text-white/45 tracking-[-0.01em]">
                                    Хэрэглэгч сонгож дэлгэрэнгүйг харна уу
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
