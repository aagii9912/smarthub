'use client';

import { useMemo } from 'react';
import {
    Store,
    UtensilsCrossed,
    Calendar,
    ShoppingBag,
    Sparkles,
    MoreHorizontal,
    HeartPulse,
    GraduationCap,
    Building2,
    Check,
    Layers,
    ShoppingCart,
    CalendarCheck,
    Info,
    LifeBuoy,
    UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BUSINESS_TYPES, type BusinessType } from '@/lib/constants/business-types';
import {
    AGENT_ROLE_VALUES,
    AGENT_ROLES,
    AGENT_CAPABILITY_VALUES,
    BUSINESS_ROLE_RECOMMENDATIONS,
    getRecommendedAgentForBusinessType,
} from '@/lib/ai/agents';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';

const BUSINESS_TYPE_ICONS = {
    retail: Store,
    restaurant: UtensilsCrossed,
    service: Calendar,
    ecommerce: ShoppingBag,
    beauty: Sparkles,
    healthcare: HeartPulse,
    education: GraduationCap,
    realestate_auto: Building2,
    other: MoreHorizontal,
} as const;

const ROLE_ICONS = {
    sales: ShoppingCart,
    booking: CalendarCheck,
    information: Info,
    support: LifeBuoy,
    lead_capture: UserPlus,
    hybrid: Layers,
} as const;

interface Step1Props {
    businessType: BusinessType;
    onBusinessTypeChange: (bt: BusinessType) => void;
    role: AgentRole;
    onRoleChange: (role: AgentRole) => void;
    capabilities: AgentCapability[];
    onCapabilitiesChange: (caps: AgentCapability[]) => void;
}

export function Step1Role({
    businessType,
    onBusinessTypeChange,
    role,
    onRoleChange,
    capabilities,
    onCapabilitiesChange,
}: Step1Props) {
    const recommended = useMemo(
        () => getRecommendedAgentForBusinessType(businessType),
        [businessType],
    );

    const handleBusinessTypeChange = (bt: BusinessType) => {
        onBusinessTypeChange(bt);
        const rec = BUSINESS_ROLE_RECOMMENDATIONS[bt];
        onRoleChange(rec.defaultRole);
        onCapabilitiesChange(rec.defaultCapabilities);
    };

    return (
        <div className="max-w-3xl space-y-8">
            {/* Headline */}
            <div>
                <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                    Бизнестээ тохирсон AI үүрэг сонгоё
                </h2>
                <p className="text-[13px] text-white/55 mt-1.5">
                    Эхлээд бизнесийн төрлөө сонгоход тохирох AI үүргүүдийг санал болгоно.
                </p>
            </div>

            {/* Business type grid */}
            <section>
                <h3 className="text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                    Бизнесийн төрөл
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(Object.keys(BUSINESS_TYPES) as BusinessType[]).map((bt) => {
                        const meta = BUSINESS_TYPES[bt];
                        const Icon = BUSINESS_TYPE_ICONS[bt];
                        const isActive = businessType === bt;
                        return (
                            <button
                                key={bt}
                                onClick={() => handleBusinessTypeChange(bt)}
                                className={cn(
                                    'relative text-left rounded-xl border p-4 transition-all',
                                    isActive
                                        ? 'border-[var(--brand-indigo,#4A7CE7)] bg-[var(--brand-indigo,#4A7CE7)]/[0.08]'
                                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]',
                                )}
                            >
                                {isActive && (
                                    <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-indigo,#4A7CE7)] text-white">
                                        <Check className="h-3 w-3" />
                                    </span>
                                )}
                                <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg mb-3', meta.accentClass)}>
                                    <Icon className="h-4.5 w-4.5" />
                                </span>
                                <p className="text-[13px] font-semibold text-foreground tracking-tight">
                                    {meta.label}
                                </p>
                                <p className="text-[11.5px] text-white/45 mt-0.5 line-clamp-2">
                                    {meta.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Role picker */}
            <section>
                <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em]">
                        AI Agent-ийн үүрэг
                    </h3>
                    <span className="text-[10.5px] text-white/40">
                        Санал болгож буй: <span className="text-emerald-400">{AGENT_ROLES[recommended.defaultRole].label.mn}</span>
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {AGENT_ROLE_VALUES.map((r) => {
                        const def = AGENT_ROLES[r];
                        const Icon = ROLE_ICONS[r];
                        const isActive = role === r;
                        const isRecommended = recommended.defaultRole === r;
                        return (
                            <button
                                key={r}
                                onClick={() => {
                                    onRoleChange(r);
                                    if (r === 'hybrid' && capabilities.length === 0) {
                                        onCapabilitiesChange(recommended.defaultCapabilities);
                                    }
                                }}
                                className={cn(
                                    'relative text-left rounded-lg border p-3 transition-all',
                                    isActive
                                        ? 'border-[var(--brand-indigo,#4A7CE7)] bg-[var(--brand-indigo,#4A7CE7)]/[0.08]'
                                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]',
                                )}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md', def.accentClass)}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="text-[12.5px] font-semibold text-foreground tracking-tight truncate">
                                        {def.label.mn}
                                    </span>
                                    {isRecommended && (
                                        <span className="ml-auto text-[9.5px] uppercase tracking-wider text-emerald-400 font-bold">
                                            ⭐
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10.5px] text-white/45 line-clamp-2">
                                    {def.description.mn}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Hybrid capabilities */}
            {role === 'hybrid' && (
                <section>
                    <h3 className="text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                        Идэвхжүүлэх чадвар (capability)
                    </h3>
                    <p className="text-[12px] text-white/45 mb-3">
                        Hybrid agent нь хэд хэдэн үүргийг хослуулсан. Доорхоос ашиглах чадварыг сонгоорой.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {AGENT_CAPABILITY_VALUES.map((c) => {
                            const def = AGENT_ROLES[c];
                            const Icon = ROLE_ICONS[c];
                            const isActive = capabilities.includes(c);
                            return (
                                <button
                                    key={c}
                                    onClick={() => {
                                        if (isActive) {
                                            onCapabilitiesChange(capabilities.filter((x) => x !== c));
                                        } else {
                                            onCapabilitiesChange([...capabilities, c]);
                                        }
                                    }}
                                    className={cn(
                                        'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all',
                                        isActive
                                            ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
                                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]',
                                    )}
                                >
                                    <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md', def.accentClass)}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="text-[12px] font-medium text-foreground tracking-tight flex-1">
                                        {def.label.mn}
                                    </span>
                                    {isActive && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                                </button>
                            );
                        })}
                    </div>
                    {capabilities.length === 0 && (
                        <p className="mt-3 text-[11.5px] text-amber-400">
                            Дор хаяж нэг чадвар сонгоорой.
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
