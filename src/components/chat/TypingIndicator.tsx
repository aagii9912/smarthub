import React from 'react';
import { Bot } from 'lucide-react';

export function TypingIndicator() {
    return (
        <div className="flex items-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 
                      flex items-center justify-center mr-2 flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
            </div>

            <div className="bg-[#0F0B2E] border border-gray-100 rounded-2xl rounded-bl-md 
                      px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}
