import React, { useState } from 'react';
import { Send, Mic, Image as ImageIcon } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Мессеж бичих...' }: ChatInputProps) {
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !disabled) {
            onSend(message.trim());
            setMessage('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-3 bg-[#0F0B2E] border-t border-gray-100 sticky bottom-0">
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-1.5 border border-gray-100">
                {/* Attachment buttons */}
                <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-violet-600 transition"
                >
                    <ImageIcon className="w-5 h-5" />
                </button>

                {/* Input */}
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="flex-1 bg-transparent border-none outline-none text-sm 
                     placeholder:text-gray-400 py-2"
                />

                {/* Send/Mic button */}
                {message.trim() ? (
                    <button
                        type="submit"
                        disabled={disabled}
                        className="p-2 bg-violet-600 text-white rounded-xl 
                       hover:bg-violet-700 disabled:opacity-50 transition shadow-lg shadow-violet-500/20"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="p-2 text-gray-400 hover:text-violet-600 transition"
                    >
                        <Mic className="w-5 h-5" />
                    </button>
                )}
            </div>
        </form>
    );
}
