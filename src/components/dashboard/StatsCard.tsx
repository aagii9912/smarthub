'use client';

import { useEffect, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        isPositive: boolean;
    };
    icon: LucideIcon;
    iconColor?: 'brand' | 'blue' | 'purple' | 'success' | 'warning' | 'gold';
}

const gradients: Record<string, { bg: string; icon: string; glow: string }> = {
    brand: {
        bg: 'from-violet-500/10 to-indigo-500/10',
        icon: 'text-violet-500',
        glow: 'shadow-violet-500/20',
    },
    blue: {
        bg: 'from-blue-500/10 to-cyan-500/10',
        icon: 'text-blue-500',
        glow: 'shadow-blue-500/20',
    },
    purple: {
        bg: 'from-purple-500/10 to-pink-500/10',
        icon: 'text-purple-500',
        glow: 'shadow-purple-500/20',
    },
    success: {
        bg: 'from-emerald-500/10 to-teal-500/10',
        icon: 'text-emerald-500',
        glow: 'shadow-emerald-500/20',
    },
    warning: {
        bg: 'from-blue-500/10 to-violet-500/10',
        icon: 'text-blue-500',
        glow: 'shadow-blue-500/20',
    },
    gold: {
        bg: 'from-blue-500/10 to-yellow-500/10',
        icon: 'text-blue-500',
        glow: 'shadow-blue-500/20',
    },
};

function useAnimatedNumber(target: number, duration: number = 800) {
    const [value, setValue] = useState(0);
    const prevRef = useRef(0);

    useEffect(() => {
        const start = prevRef.current;
        const diff = target - start;
        if (diff === 0) return;

        const startTime = performance.now();
        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * eased);
            setValue(current);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                prevRef.current = target;
            }
        };
        requestAnimationFrame(step);
    }, [target, duration]);

    return value;
}

export function StatsCard({ title, value, change, icon: Icon, iconColor = 'brand' }: StatsCardProps) {
    const colors = gradients[iconColor] || gradients.brand;

    // Parse numeric value for animation
    const numericMatch = String(value).match(/^[₮]?([\d,.]+)/);
    const numericValue = numericMatch ? parseFloat(numericMatch[1].replace(/,/g, '')) : 0;
    const animatedNum = useAnimatedNumber(numericValue);
    const prefix = String(value).startsWith('₮') ? '₮' : '';
    const suffix = String(value).replace(/^[₮]?[\d,.]+/, '');

    // Format the animated number like the original
    const displayValue = numericMatch
        ? `${prefix}${animatedNum.toLocaleString()}${suffix}`
        : value;

    return (
        <div className={cn(
            'group relative rounded-2xl p-4 md:p-5 transition-all duration-300',
            'bg-[#0F0B2E] backdrop-blur-sm',
            'border border-white/[0.08]',
            'hover:border-[#4A7CE7]/30',
            'hover:-translate-y-0.5 hover:shadow-lg',
        )}>
            {/* Hover gradient border effect */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-blue-500/[0.05] to-transparent" />

            <div className="relative flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.08em] mb-3">
                        {title}
                    </p>
                    <p className="text-2xl md:text-[28px] font-bold text-foreground tracking-[-0.03em] tabular-nums leading-none">
                        {displayValue}
                    </p>
                    {change && (
                        <div className={cn(
                            'mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold',
                            change.isPositive
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                        )}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                        </div>
                    )}
                </div>

                {/* Gradient icon container */}
                <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    'bg-gradient-to-br transition-shadow duration-300',
                    colors.bg,
                    `group-hover:${colors.glow}`
                )}>
                    <Icon className={cn('w-5 h-5', colors.icon)} strokeWidth={1.5} />
                </div>
            </div>
        </div>
    );
}
