import React from 'react';
import { ConversationItem } from './ConversationItem';
import { Search } from 'lucide-react';

interface Conversation {
    id: string;
    customer_name: string;
    customer_avatar?: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
}

interface ConversationListProps {
    conversations: Conversation[];
    activeId?: string;
    onSelect: (id: string) => void;
}

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 md:p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3 md:mb-2">
                    <h3 className="font-bold text-gray-900 text-lg md:text-base">Харилцсан чатууд</h3>
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-xs font-semibold rounded-full">
                        {conversations.length}
                    </span>
                </div>

                {/* Search - better on mobile */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Хайх..."
                        className="w-full pl-9 pr-4 py-2.5 md:py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {conversations.length > 0 ? (
                    conversations.map((convo) => (
                        <ConversationItem
                            key={convo.id}
                            conversation={convo}
                            isActive={activeId === convo.id}
                            onClick={() => onSelect(convo.id)}
                        />
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-400">
                        <p className="text-sm">Одоогоор чат байхгүй байна.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
