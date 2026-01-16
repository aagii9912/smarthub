'use client';

import React, { useState } from 'react';
import { ConversationList } from '@/components/dashboard/ConversationList';
import { MessageThread } from '@/components/dashboard/MessageThread';
import { ActiveCartWidget } from '@/components/dashboard/ActiveCartWidget';
import { useConversations } from '@/hooks/useConversations';
import { toast } from 'sonner';
import { MessageCircle, Loader2 } from 'lucide-react';

export default function InboxPage() {
    const { data: conversations = [], isLoading, error } = useConversations();
    const [activeId, setActiveId] = useState<string | null>(null);

    // Set first conversation as active when data loads
    React.useEffect(() => {
        if (conversations.length > 0 && !activeId) {
            setActiveId(conversations[0].id);
        }
    }, [conversations, activeId]);

    const activeConvo = conversations.find((c: any) => c.id === activeId);
    const activeMessages = activeConvo?.messages || [];

    const handleReply = (text: string) => {
        // TODO: Implement sending message back to Messenger via Graph API
        toast.info('Мессеж илгээх боломж удахгүй ашиглах боломжтой болно');
        console.log('Reply:', text, 'to customer:', activeId);
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-white rounded-3xl border border-gray-100">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Чатуудыг ачаалж байна...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-white rounded-3xl border border-gray-100">
                <div className="text-center text-red-500">
                    <p>Алдаа гарлаа: {(error as Error).message}</p>
                </div>
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-white rounded-3xl border border-gray-100">
                <div className="text-center">
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
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Left: Conversation List */}
            <div className="w-full md:w-80 lg:w-96 border-r border-gray-100">
                <ConversationList
                    conversations={conversations}
                    activeId={activeId || undefined}
                    onSelect={setActiveId}
                />
            </div>

            {/* Middle: Message Thread */}
            <div className="flex-1 flex flex-col min-w-0">
                {activeId && activeConvo ? (
                    <MessageThread
                        messages={activeMessages}
                        customerName={activeConvo.customer_name || 'Зочин'}
                        onReply={handleReply}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        Харилцаа сонгоно уу
                    </div>
                )}
            </div>

            {/* Right: Monitoring Widget (Desktop only) */}
            <div className="hidden lg:block w-72 p-4 border-l border-gray-100 bg-gray-50/20 overflow-y-auto no-scrollbar">
                <div className="space-y-6">
                    <ActiveCartWidget
                        customerName={activeConvo?.customer_name || ''}
                        items={[]} // TODO: Connect to real cart data
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
    );
}
