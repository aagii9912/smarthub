'use client';

import { useMemo } from 'react';
import { Pencil, Power, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { AGENT_ROLES } from '@/lib/ai/agents';
import { BUSINESS_TYPES, type BusinessType } from '@/lib/constants/business-types';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import { RoleBadge } from './RoleBadge';
import { QuickEditCards } from './QuickEditCards';
import { AgentPreviewChat, type AgentDraftConfig } from './AgentPreviewChat';

interface AgentOverviewProps {
    shop: {
        ai_agent_role?: AgentRole | null;
        ai_agent_capabilities?: AgentCapability[] | null;
        ai_agent_name?: string | null;
        ai_emotion?: string | null;
        ai_instructions?: string | null;
        is_ai_active?: boolean | null;
        business_type?: BusinessType | null;
    };
    onWizardOpen: () => void;
    onAdvancedClick: () => void;
    onTabClick: (tab: 'persona' | 'knowledge' | 'automation' | 'notifications') => void;
    onToggleAi: () => void;
}

export function AgentOverview({
    shop,
    onWizardOpen,
    onAdvancedClick,
    onTabClick,
    onToggleAi,
}: AgentOverviewProps) {
    const role: AgentRole = shop.ai_agent_role ?? 'sales';
    const caps: AgentCapability[] = useMemo(
        () => shop.ai_agent_capabilities ?? ['sales'],
        [shop.ai_agent_capabilities],
    );
    const roleDef = AGENT_ROLES[role];
    const isActive = shop.is_ai_active !== false;
    const businessTypeMeta = shop.business_type ? BUSINESS_TYPES[shop.business_type] : null;

    const draft: AgentDraftConfig = useMemo(
        () => ({
            agentRole: role,
            capabilities: caps,
            agentName: shop.ai_agent_name || undefined,
            emotion: (shop.ai_emotion || 'friendly') as AgentDraftConfig['emotion'],
            instructions: shop.ai_instructions || undefined,
        }),
        [role, caps, shop.ai_agent_name, shop.ai_emotion, shop.ai_instructions],
    );

    return (
        <div className="space-y-6">
            {/* Hero card */}
            <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden">
                <div className="p-5 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="relative">
                                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-indigo,#4A7CE7)] to-[var(--brand-violet,#904EA0)] text-white text-[18px] font-bold">
                                    {(shop.ai_agent_name || 'AI').slice(0, 2).toUpperCase()}
                                </span>
                                <span
                                    className={cn(
                                        'absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--page-bg-dashboard,#09090b)]',
                                        isActive ? 'bg-emerald-400' : 'bg-white/30',
                                    )}
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-[18px] font-semibold text-foreground tracking-tight">
                                        {shop.ai_agent_name || 'AI Agent'}
                                    </h2>
                                    <RoleBadge role={role} size="sm" />
                                    {isActive ? (
                                        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-emerald-500/15 px-2 text-[10.5px] font-semibold text-emerald-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Идэвхтэй
                                        </span>
                                    ) : (
                                        <span className="inline-flex h-5 items-center rounded-full bg-white/[0.08] px-2 text-[10.5px] font-semibold text-white/50">
                                            Зогссон
                                        </span>
                                    )}
                                </div>
                                <p className="text-[12.5px] text-white/55 mt-1 line-clamp-2">
                                    {roleDef.description.mn}
                                </p>
                                {businessTypeMeta && (
                                    <p className="text-[11px] text-white/40 mt-1.5">
                                        Бизнесийн төрөл: <span className="text-white/65">{businessTypeMeta.label}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Power className="h-3.5 w-3.5" />}
                                onClick={onToggleAi}
                            >
                                {isActive ? 'Зогсоох' : 'Идэвхжүүлэх'}
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<Pencil className="h-3.5 w-3.5" />}
                                onClick={onWizardOpen}
                            >
                                Дахин setup
                            </Button>
                        </div>
                    </div>

                    {role === 'hybrid' && caps.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
                            <span className="text-[10.5px] uppercase tracking-wider text-white/40">
                                Чадварууд:
                            </span>
                            {caps.map((c) => (
                                <RoleBadge key={c} role={c} size="sm" />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Quick edit + Live preview */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2">
                    <h3 className="flex items-center gap-2 text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                        <Sparkles className="h-3 w-3" />
                        Хурдан тохируулга
                    </h3>
                    <QuickEditCards
                        onPersonalityClick={() => onTabClick('persona')}
                        onKnowledgeClick={() => onTabClick('knowledge')}
                        onCapabilitiesClick={onAdvancedClick}
                        onNotificationsClick={() => onTabClick('notifications')}
                        onWizardClick={onWizardOpen}
                    />
                </div>

                <div>
                    <h3 className="flex items-center gap-2 text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                        <RefreshCw className="h-3 w-3" />
                        Туршилтын чат
                    </h3>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden h-[480px] flex flex-col">
                        <AgentPreviewChat draft={draft} compact title="Live preview" />
                    </div>
                </div>
            </div>

            {/* Advanced link */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground tracking-tight">
                        Бүх тохиргоог нарийвчлан үзэх
                    </p>
                    <p className="text-[11.5px] text-white/45 mt-0.5">
                        Quick reply, slogan, мэдэгдэл, хуваалцах тохиргоог advanced хэсгээс засна.
                    </p>
                </div>
                <Button variant="secondary" size="sm" onClick={onAdvancedClick}>
                    Advanced settings
                </Button>
            </div>
        </div>
    );
}
