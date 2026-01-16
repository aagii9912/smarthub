import React from 'react';
import { ConversationItem } from './ConversationItem';

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
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-900">Хариуцсан чатууд</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Идэвхтэй харилцаа</p>
            </div>

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
