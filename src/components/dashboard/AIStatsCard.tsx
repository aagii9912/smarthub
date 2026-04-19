'use client';

import { MessageSquare, Cpu, Phone, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AIStatsCardProps {
    totalConversations: number;
    totalMessages: number;
    creditUsage: {
        used: number;
        limit: number;
        percent: number;
        remaining: number;
        resetAt: string | null;
    };
    contactsCollected: number;
    planType: string;
}

function formatCreditCount(count: number): string {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
}

export function AIStatsCard({
    totalConversations: _totalConversations,
    totalMessages,
    creditUsage,
    contactsCollected,
    planType,
}: AIStatsCardProps) {
    void _totalConversations;
    const { t } = useLanguage();

    // Gradient color based on usage percentage
    const getUsageColor = (percent: number) => {
        if (percent >= 90) return { bar: 'from-red-500 to-rose-600', text: 'text-red-400', bg: 'bg-red-500/10' };
        if (percent >= 70) return { bar: 'from-amber-500 to-orange-500', text: 'text-amber-400', bg: 'bg-amber-500/10' };
        return { bar: 'from-emerald-400 to-cyan-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    };

    const usageColors = getUsageColor(creditUsage.percent);

    const miniStats = [
        {
            icon: MessageSquare,
            label: t.features.creditUsage || 'Чат',
            value: totalMessages.toLocaleString(),
            sublabel: 'мессеж',
            iconColor: 'text-violet-400',
            bgColor: 'bg-violet-500/10',
        },
        {
            icon: Cpu,
            label: 'Credits',
            value: `${creditUsage.percent}%`,
            sublabel: `${formatCreditCount(creditUsage.used)} credit`,
            iconColor: usageColors.text,
            bgColor: usageColors.bg,
        },
        {
            icon: Phone,
            label: t.features.creditUsageDesc || 'Утас',
            value: contactsCollected.toString(),
            sublabel: 'цуглуулсан',
            iconColor: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
        },
        {
            icon: Zap,
            label: 'Plan',
            value: planType.charAt(0).toUpperCase() + planType.slice(1),
            sublabel: `${formatCreditCount(creditUsage.limit)} credit/сар`,
            iconColor: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
        },
    ];

    return (
        <div className="rounded-2xl bg-[#0F0B2E] backdrop-blur-sm border border-white/[0.08] overflow-hidden transition-all duration-300 hover:border-[#4A7CE7]/20">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 flex items-center justify-center">
                        <Cpu className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                    </div>
                    <span className="text-[14px] font-bold text-foreground tracking-[-0.02em]">
                        AI Analytics
                    </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-white/40 font-medium">Live</span>
                </div>
            </div>

            {/* Mini Stats Grid */}
            <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                {miniStats.map((stat, i) => (
                    <div key={i} className="bg-[#0F0B2E] p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0`}>
                            <stat.icon className={`w-4 h-4 ${stat.iconColor}`} strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[16px] font-bold text-foreground tabular-nums tracking-[-0.02em]">
                                {stat.value}
                            </p>
                            <p className="text-[10px] text-white/30 truncate">{stat.sublabel}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Credit Usage Progress Bar */}
            <div className="px-5 py-4 border-t border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-white/40 font-medium">AI Credit хэрэглээ</span>
                    <span className={`text-[11px] font-semibold tabular-nums ${usageColors.text}`}>
                        {creditUsage.used.toLocaleString()} / {creditUsage.limit.toLocaleString()}
                    </span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${usageColors.bar} transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(creditUsage.percent, 100)}%` }}
                    />
                </div>
                {creditUsage.resetAt && (
                    <p className="text-[10px] text-white/20 mt-1.5">
                        Дахин тоолно: {new Date(creditUsage.resetAt).toLocaleDateString('mn-MN')}
                    </p>
                )}
            </div>
        </div>
    );
}
