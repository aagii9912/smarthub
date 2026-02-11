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
        <button
            onClick={onClick}
            className={`w-full p-4 md:p-3.5 border-b border-white/[0.04] flex items-center gap-3 text-left transition-colors active:bg-[#151040]
                ${isActive ? 'bg-violet-500/10 md:bg-violet-500/10' : 'hover:bg-[#0F0B2E]'}`}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-12 h-12 md:w-11 md:h-11 rounded-full overflow-hidden bg-[#151040]">
                    {conversation.customer_avatar ? (
                        <img
                            src={conversation.customer_avatar}
                            alt={conversation.customer_name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-violet-600 bg-violet-100 font-bold text-lg md:text-base">
                            {conversation.customer_name.charAt(0)}
                        </div>
                    )}
                </div>
                {conversation.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <h4 className={`text-sm font-semibold truncate ${isActive ? 'text-violet-900' : 'text-white'}`}>
                        {conversation.customer_name}
                    </h4>
                    <span className="text-[10px] text-white/40 flex-shrink-0 ml-2">
                        {formatTimeAgo(conversation.last_message_at)}
                    </span>
                </div>
                <p className={`text-xs truncate leading-relaxed ${conversation.unread_count > 0 ? 'text-white font-medium' : 'text-white/50'
                    }`}>
                    {conversation.last_message || 'Мессеж байхгүй'}
                </p>
            </div>

            {/* Unread indicator - chevron for mobile */}
            <div className="flex-shrink-0 md:hidden">
                <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </button>
    );
}
