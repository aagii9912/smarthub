'use client';

import React, { useState } from 'react';
import { ConversationList } from '@/components/dashboard/ConversationList';
import { MessageThread } from '@/components/dashboard/MessageThread';
import { ActiveCartWidget } from '@/components/dashboard/ActiveCartWidget';
import { useConversations } from '@/hooks/useConversations';
import { toast } from 'sonner';
import { MessageCircle, Loader2, ArrowLeft, Info } from 'lucide-react';

export default function InboxPage() {
    const { data: conversations = [], isLoading, error } = useConversations();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    // Set first conversation as active when data loads (desktop only)
    React.useEffect(() => {
        if (conversations.length > 0 && !activeId && window.innerWidth >= 768) {
            setActiveId(conversations[0].id);
        }
    }, [conversations, activeId]);

    const activeConvo = conversations.find((c: any) => c.id === activeId);
    const activeMessages = activeConvo?.messages || [];

    const handleSelectConversation = (id: string) => {
        setActiveId(id);
    };

    const handleBack = () => {
        setActiveId(null);
        setShowInfo(false);
    };

    const [isSending, setIsSending] = useState(false);

    const handleReply = async (text: string) => {
        if (!activeId || isSending) return;

        setIsSending(true);
        try {
            const res = await fetch('/api/dashboard/conversations/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: activeId,
                    message: text,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send message');
            }

            toast.success('Мессеж илгээгдлээ! ✅');

            // Refetch conversations to show new message
            // TODO: Use optimistic update for better UX
        } catch (error) {
            console.error('Reply error:', error);
            toast.error(`Мессеж илгээхэд алдаа гарлаа: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSending(false);
        }
    };

    // Loading State
    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-140px)] items-center justify-center bg-white md:rounded-3xl md:border md:border-gray-100">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Чатуудыг ачаалж байна...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-white md:rounded-3xl md:border md:border-gray-100">
                <div className="text-center text-red-500 px-4">
                    <p>Алдаа гарлаа: {(error as Error).message}</p>
                </div>
            </div>
        );
    }

    // Empty State
    if (conversations.length === 0) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-white md:rounded-3xl md:border md:border-gray-100">
                <div className="text-center px-6">
                    <MessageCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Чат байхгүй байна</h3>
                    <p className="text-sm text-gray-500 max-w-sm">
                        Messenger-ээр хэрэглэгч холбогдоход энд харагдана.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Mobile Layout */}
            <div className="md:hidden h-[calc(100vh-140px)] bg-white relative overflow-hidden">
                {/* Conversation List - slides out when chat is selected */}
                <div
                    className={`absolute inset-0 transition-transform duration-300 ease-out ${activeId ? '-translate-x-full' : 'translate-x-0'
                        }`}
                >
                    <ConversationList
                        conversations={conversations}
                        activeId={activeId || undefined}
                        onSelect={handleSelectConversation}
                    />
                </div>

                {/* Message Thread - slides in when chat is selected */}
                <div
                    className={`absolute inset-0 transition-transform duration-300 ease-out ${activeId ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    {activeId && activeConvo && (
                        <div className="h-full flex flex-col">
                            {/* Mobile Header with Back Button */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
                                <button
                                    onClick={handleBack}
                                    className="p-2 -ml-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-gray-900 truncate">
                                        {activeConvo.customer_name || 'Зочин'}
                                    </h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] text-gray-500">Messenger</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowInfo(!showInfo)}
                                    className={`p-2 rounded-xl transition-colors ${showInfo ? 'bg-violet-100 text-violet-600' : 'hover:bg-gray-100 text-gray-500'
                                        }`}
                                >
                                    <Info className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Message Thread without its own header */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <MessageThread
                                    messages={activeMessages}
                                    customerName={activeConvo.customer_name || 'Зочин'}
                                    onReply={handleReply}
                                    hideHeader
                                    isLoading={isSending}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Customer Info Slide Panel (Mobile) */}
                {showInfo && activeConvo && (
                    <div
                        className="absolute inset-0 bg-black/40 z-10"
                        onClick={() => setShowInfo(false)}
                    >
                        <div
                            className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl p-4 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-gray-900">Мэдээлэл</h4>
                                <button
                                    onClick={() => setShowInfo(false)}
                                    className="p-2 rounded-xl hover:bg-gray-100"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            </div>

                            <ActiveCartWidget
                                customerName={activeConvo.customer_name || ''}
                                items={[]}
                                onConvertToOrder={() => toast.info('Энэ функц удахгүй бэлэн болно')}
                                onSendReminder={() => toast.info('Сануулга илгээх функц удахгүй бэлэн болно')}
                            />

                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Хэрэглэгч</h5>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">ID:</span>
                                        <span className="text-gray-900 font-mono text-[10px]">{activeId?.slice(0, 8)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Суваг:</span>
                                        <span className="text-violet-600 font-medium">Messenger</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex h-[calc(100vh-140px)] bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                {/* Left: Conversation List */}
                <div className="w-80 lg:w-96 border-r border-gray-100 flex-shrink-0">
                    <ConversationList
                        conversations={conversations}
                        activeId={activeId || undefined}
                        onSelect={handleSelectConversation}
                    />
                </div>

                {/* Middle: Message Thread */}
                <div className="flex-1 flex flex-col min-w-0">
                    {activeId && activeConvo ? (
                        <MessageThread
                            messages={activeMessages}
                            customerName={activeConvo.customer_name || 'Зочин'}
                            onReply={handleReply}
                            isLoading={isSending}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            Харилцаа сонгоно уу
                        </div>
                    )}
                </div>

                {/* Right: Monitoring Widget (Desktop only) */}
                <div className="hidden lg:block w-72 p-4 border-l border-gray-100 bg-gray-50/20 overflow-y-auto no-scrollbar flex-shrink-0">
                    <div className="space-y-6">
                        <ActiveCartWidget
                            customerName={activeConvo?.customer_name || ''}
                            items={[]}
                            onConvertToOrder={() => toast.info('Энэ функц удахгүй бэлэн болно')}
                            onSendReminder={() => toast.info('Сануулга илгээх функц удахгүй бэлэн болно')}
                        />

                        <div className="p-4 bg-white rounded-2xl border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Хэрэглэгчийн мэдээлэл</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">ID:</span>
                                    <span className="text-gray-900 font-mono text-[10px]">{activeId?.slice(0, 8) || '-'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Суваг:</span>
                                    <span className="text-violet-600 font-medium">Messenger</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
