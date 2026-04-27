import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from './types';

interface InboxMessageBubbleProps {
    message: ChatMessage;
}

function formatTime(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleTimeString('mn-MN', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

export function InboxMessageBubble({ message }: InboxMessageBubbleProps) {
    const isAssistant = message.role === 'assistant';

    return (
        <div
            className={cn(
                'flex gap-2.5',
                isAssistant ? 'justify-end' : 'justify-start'
            )}
        >
            {!isAssistant && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo-400)]">
                    <User className="w-3.5 h-3.5" />
                </div>
            )}

            <div
                className={cn(
                    'max-w-[72%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed tracking-[-0.01em]',
                    isAssistant
                        ? 'rounded-br-md text-foreground'
                        : 'rounded-bl-md bg-white/[0.05] text-white/85'
                )}
                style={
                    isAssistant
                        ? {
                              background:
                                  'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                              boxShadow: 'var(--shadow-cta-indigo)',
                          }
                        : undefined
                }
            >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <div
                    className={cn(
                        'text-[10px] mt-1 tabular-nums',
                        isAssistant ? 'text-white/60' : 'text-white/30'
                    )}
                >
                    {formatTime(message.created_at)}
                </div>
            </div>

            {isAssistant && (
                <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                        background:
                            'color-mix(in oklab, var(--success) 18%, transparent)',
                        color: 'var(--success)',
                    }}
                >
                    <Bot className="w-3.5 h-3.5" />
                </div>
            )}
        </div>
    );
}
