'use client';

import { CheckCircle2, Sparkles } from 'lucide-react';
import { AgentPreviewChat, type AgentDraftConfig } from '../AgentPreviewChat';
import { RoleBadge } from '../RoleBadge';
import { AGENT_ROLES } from '@/lib/ai/agents';

interface Step5Props {
    draft: AgentDraftConfig;
}

export function Step5Preview({ draft }: Step5Props) {
    const role = AGENT_ROLES[draft.agentRole];

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                    Бэлэн боллоо! Туршиж үзье
                </h2>
                <p className="text-[13px] text-white/55 mt-1.5">
                    Доор таны AI agent-той бодит ярилцлага хийгээрэй. Amжилттай бол доор &ldquo;Идэвхжүүлэх&rdquo; товчийг дарна уу.
                </p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-indigo,#4A7CE7)] to-[var(--brand-violet,#904EA0)] text-white font-bold">
                            {(draft.agentName || 'AI').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-foreground tracking-tight truncate">
                                {draft.agentName || 'AI Agent'}
                            </p>
                            <p className="text-[11.5px] text-white/45 truncate">
                                {role.description.mn}
                            </p>
                        </div>
                    </div>
                    <RoleBadge role={draft.agentRole} size="md" />
                </div>
                {draft.capabilities.length > 0 && draft.agentRole === 'hybrid' && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {draft.capabilities.map((c) => (
                            <RoleBadge key={c} role={c} size="sm" />
                        ))}
                    </div>
                )}
            </div>

            {/* Live chat */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden h-[480px] flex flex-col">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[12px] font-semibold text-foreground tracking-tight">
                        Жинхэнэ AI хариулт
                    </span>
                    <span className="ml-auto text-[10.5px] text-white/35">
                        💬 Тэст хийсэн token хэрэглээнд тооцогдоно
                    </span>
                </div>
                <div className="flex-1 min-h-0">
                    <AgentPreviewChat draft={draft} compact />
                </div>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-4 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-emerald-300">
                        Идэвхжүүлсний дараа
                    </p>
                    <p className="text-[11.5px] text-emerald-200/70 mt-0.5">
                        Facebook / Instagram-ийн хэрэглэгчид шууд таны шинэ AI agent-тай ярилцана. Хэрэв хариу таалагдахгүй бол энэ wizard-ыг дахин нээж тааруулж болно.
                    </p>
                </div>
            </div>
        </div>
    );
}
