import React, { useState, useRef, useEffect } from 'react';
import { Send, Check, CheckCheck } from 'lucide-react';

// Helper: Format message time with date context (өнөөдөр, өчигдөр, or full date)
function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const time = date.toLocaleTimeString('mn-MN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ulaanbaatar'
    });

    if (msgDate.getTime() === today.getTime()) {
        return `Өнөөдөр ${time}`;
    } else if (msgDate.getTime() === yesterday.getTime()) {
        return `Өчигдөр ${time}`;
    } else {
        const dateFormatted = date.toLocaleDateString('mn-MN', {
            month: 'short',
            day: 'numeric',
            timeZone: 'Asia/Ulaanbaatar'
        });
        return `${dateFormatted} ${time}`;
    }
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'human';
    content: string;
    created_at: string;
    status?: 'sent' | 'delivered' | 'read';
}

interface MessageThreadProps {
    messages: Message[];
    customerName: string;
    onReply: (text: string) => void;
    hideHeader?: boolean;
    isLoading?: boolean;
}

export function MessageThread({ messages, customerName, onReply, hideHeader = false, isLoading = false }: MessageThreadProps) {
    const [reply, setReply] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (reply.trim()) {
            onReply(reply.trim());
            setReply('');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header - hidden on mobile when parent provides it */}
            {!hideHeader && (
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-900">{customerName}</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Online</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-gray-50/30">
                {messages.map((msg) => {
                    const isIncoming = msg.role === 'user';
                    return (
                        <div key={msg.id} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[70%] group`}>
                                <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm
                                    ${isIncoming
                                        ? 'bg-white border border-gray-100 text-gray-900 rounded-bl-md'
                                        : 'bg-violet-600 text-white rounded-br-md'}`}
                                >
                                    {msg.content}
                                </div>
                                <div className={`flex items-center gap-1 mt-1 px-1 ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                                    <span className="text-[10px] text-gray-400">
                                        {formatMessageTime(msg.created_at)}
                                    </span>
                                    {!isIncoming && (
                                        msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-violet-400" /> : <Check className="w-3 h-3 text-gray-300" />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies / Templates */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-t border-gray-50">
                {['Баталгаажлаа', 'Бэлдэж байна', 'Хүргэлтэнд гарлаа'].map(temp => (
                    <button
                        key={temp}
                        onClick={() => onReply(temp)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-violet-100 hover:text-violet-600 rounded-full text-[11px] font-medium text-gray-500 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {temp}
                    </button>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
                    <input
                        type="text"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder={isLoading ? "Илгээж байна..." : "Хариу бичих..."}
                        disabled={isLoading}
                        className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder:text-gray-400 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={!reply.trim() || isLoading}
                        className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-30 transition-all shadow-md shadow-violet-500/10"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
