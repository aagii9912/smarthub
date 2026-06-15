'use client';

import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

interface RevenueStatsProps {
    total: number;
    orderCount: number;
    avgOrderValue: number;
    growth: number;
    growthAmount?: number;
    newCustomers: number;
    vipCustomers: number;
}

interface StatCard {
    label: string;
    value: string;
    icon: LucideIcon;
    color: string;
    growth?: number;
    growthAmount?: number;
    featured?: boolean;
}

export function RevenueStats({
    total,
    orderCount,
    avgOrderValue,
    growth,
    growthAmount,
    newCustomers,
    vipCustomers,
}: RevenueStatsProps) {
    const stats: StatCard[] = [
        {
            label: 'Нийт орлого (төлөгдсөн)',
            value: formatCurrency(total),
            icon: DollarSign,
            color: 'var(--success)',
            growth,
            growthAmount,
            featured: true,
        },
        {
            label: 'Захиалгын тоо',
            value: orderCount.toString(),
            icon: ShoppingCart,
            color: 'var(--brand-indigo)',
        },
        {
            label: 'Дундаж захиалга',
            value: formatCurrency(avgOrderValue),
            icon: TrendingUp,
            color: 'var(--brand-violet-500)',
        },
        {
            label: 'Шинэ харилцагч',
            value: newCustomers.toString(),
            icon: Users,
            color: 'var(--brand-cyan)',
        },
    ];

    void vipCustomers; // kept for API parity

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => {
                const Icon = stat.icon;
                const positive = (stat.growth ?? 0) >= 0;
                return (
                    <div
                        key={stat.label}
                        className={`p-4 overflow-hidden ${stat.featured ? 'card-featured' : 'card-outlined'}`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: `color-mix(in oklab, ${stat.color} 18%, transparent)`, color: stat.color }}
                            >
                                <Icon className="w-5 h-5" strokeWidth={1.5} />
                            </div>
                            {stat.growth !== undefined && (
                                <div
                                    className="flex items-center gap-1 text-[11px] font-semibold tabular-nums"
                                    style={{ color: positive ? 'var(--success)' : 'var(--destructive)' }}
                                >
                                    {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {Math.abs(stat.growth)}%
                                </div>
                            )}
                        </div>
                        <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">{stat.value}</p>
                        <p className="text-[11px] text-white/45 mt-1 tracking-[-0.01em]">{stat.label}</p>
                        {stat.growthAmount !== undefined && stat.growthAmount !== 0 && (
                            <p className="text-[10.5px] text-white/35 mt-0.5 tabular-nums">
                                {stat.growthAmount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(stat.growthAmount))} өмнөх үеэс
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
