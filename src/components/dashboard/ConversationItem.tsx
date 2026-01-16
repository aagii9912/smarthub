import React from 'react';
import { formatTimeAgo } from '@/lib/utils/date';

interface Conversation {
    id: string;
    customer_name: string;
    customer_avatar?: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
}

interface ConversationItemProps {
    conversation: Conversation;
    isActive: boolean;
    onClick: () => void;
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
    return (
        <div
            onClick={onClick}
            className={`p-4 border-b border-gray-50 flex items-center gap-3 cursor-pointer transition-colors
                ${isActive ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
        >
            <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    {conversation.customer_avatar ? (
                        <img src={conversation.customer_avatar} alt={conversation.customer_name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-violet-600 bg-violet-100 font-bold">
                            {conversation.customer_name.charAt(0)}
                        </div>
                    )}
                </div>
                {conversation.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                        {conversation.unread_count}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <h4 className={`text-sm font-semibold truncate ${isActive ? 'text-violet-900' : 'text-gray-900'}`}>
                        {conversation.customer_name}
                    </h4>
                    <span className="text-[10px] text-gray-400">
                        {formatTimeAgo(conversation.last_message_at)}
                    </span>
                </div>
                <p className={`text-xs truncate ${conversation.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {conversation.last_message}
                </p>
            </div>
        </div>
    );
}
