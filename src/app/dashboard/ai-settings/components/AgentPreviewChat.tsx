'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AGENT_ROLES } from '@/lib/ai/agents';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { AIEmotion } from '@/types/ai';

export interface AgentDraftConfig {
    agentRole: AgentRole;
    capabilities: AgentCapability[];
    agentName?: string;
    emotion?: AIEmotion;
    instructions?: string;
}

interface PreviewMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    pending?: boolean;
    error?: boolean;
}

interface AgentPreviewChatProps {
    draft: AgentDraftConfig;
    /** Compact layout for embedded use (overview widget). */
    compact?: boolean;
    /** Optional title — defaults to agent name + role */
    title?: string;
    className?: string;
}

export function AgentPreviewChat({ draft, compact = false, title, className }: AgentPreviewChatProps) {
    const [messages, setMessages] = useState<PreviewMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const role = AGENT_ROLES[draft.agentRole];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const send = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);

        const userMsg: PreviewMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            text: trimmed,
        };
        const pendingId = `a-${Date.now()}`;
        setMessages((prev) => [...prev, userMsg, { id: pendingId, role: 'assistant', text: '', pending: true }]);
        setInput('');

        try {
            const res = await fetch('/api/ai-settings/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed, draft }),
            });

            const data = await res.json();
            if (!res.ok) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === pendingId
                            ? { ...m, pending: false, error: true, text: data?.error || 'Алдаа гарлаа' }
                            : m,
                    ),
                );
            } else {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === pendingId
                            ? { ...m, pending: false, text: data?.text || '...' }
                            : m,
                    ),
                );
            }
        } catch {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === pendingId
                        ? { ...m, pending: false, error: true, text: 'Сүлжээний алдаа.' }
                        : m,
                ),
            );
        } finally {
            setSending(false);
        }
    };

    const reset = () => {
        setMessages([]);
        setInput('');
    };

    const scenarios = role.previewScenarios.slice(0, 3);

    return (
        <div className={cn('flex flex-col h-full min-h-0', className)}>
            {/* Header */}
            {!compact && (
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-white/45" />
                        <h3 className="text-[12.5px] font-semibold text-foreground tracking-tight">
                            {title ?? `${draft.agentName || 'AI Agent'} preview`}
                        </h3>
                    </div>
                    <button
                        onClick={reset}
                        className="text-white/40 hover:text-white/70 transition-colors"
                        aria-label="Reset preview"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Empty state with scenarios */}
            {messages.length === 0 ? (
                <div className="flex-1 overflow-y-auto px-4 py-5">
                    <p className="text-[11.5px] text-white/45 mb-3 tracking-tight">
                        Жишээ асуултаар турш:
                    </p>
                    <div className="space-y-2">
                        {scenarios.map((s, idx) => (
                            <button
                                key={idx}
                                onClick={() => send(s.user.mn)}
                                className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[12.5px] text-foreground transition-colors"
                            >
                                {s.user.mn}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {messages.map((m) => (
                        <MessageBubble key={m.id} message={m} agentName={draft.agentName} />
                    ))}
                </div>
            )}

            {/* Input */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                }}
                className="flex items-end gap-2 border-t border-white/[0.06] px-3 py-3"
            >
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Хариу хүсэх асуултаа бичээрэй..."
                    className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo,#4A7CE7)]"
                    disabled={sending}
                    maxLength={500}
                />
                <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    disabled={sending || !input.trim()}
                    loading={sending}
                >
                    <Send className="h-3.5 w-3.5" />
                </Button>
            </form>
        </div>
    );
}

function MessageBubble({ message, agentName }: { message: PreviewMessage; agentName?: string }) {
    const isUser = message.role === 'user';
    return (
        <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
            <span className="text-[10px] uppercase tracking-wider text-white/35">
                {isUser ? 'Хэрэглэгч' : agentName || 'AI'}
            </span>
            <div
                className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug whitespace-pre-wrap',
                    isUser
                        ? 'bg-gradient-to-br from-[var(--brand-indigo,#4A7CE7)] to-[var(--brand-violet,#904EA0)] text-white rounded-br-sm'
                        : message.error
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-bl-sm'
                          : 'bg-white/[0.04] border border-white/[0.06] text-foreground rounded-bl-sm',
                )}
            >
                {message.pending ? (
                    <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce" />
                    </span>
                ) : (
                    message.text
                )}
            </div>
        </div>
    );
}
