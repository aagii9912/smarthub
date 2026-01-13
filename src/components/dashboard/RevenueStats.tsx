'use client';

import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from 'lucide-react';

interface RevenueStatsProps {
    total: number;
    orderCount: number;
    avgOrderValue: number;
    growth: number;
    newCustomers: number;
    vipCustomers: number;
}

export function RevenueStats({
    total,
    orderCount,
    avgOrderValue,
    growth,
    newCustomers,
    vipCustomers,
}: RevenueStatsProps) {
    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `₮${(value / 1000000).toFixed(1)}M`;
        }
        return `₮${value.toLocaleString()}`;
    };

    const stats = [
        {
            label: 'Нийт орлого',
            value: formatCurrency(total),
            icon: DollarSign,
            growth: growth,
            color: 'bg-green-500',
        },
        {
            label: 'Захиалгын тоо',
            value: orderCount.toString(),
            icon: ShoppingCart,
            color: 'bg-blue-500',
        },
        {
            label: 'Дундаж захиалга',
            value: formatCurrency(avgOrderValue),
            icon: TrendingUp,
            color: 'bg-purple-500',
        },
        {
            label: 'Шинэ харилцагч',
            value: newCustomers.toString(),
            icon: Users,
            color: 'bg-orange-500',
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={stat.label}
                        className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 ${stat.color} bg-opacity-10 rounded-lg flex items-center justify-center`}>
                                <Icon className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`} />
                            </div>
                            {stat.growth !== undefined && (
                                <div className={`flex items-center gap-1 text-xs font-medium ${stat.growth >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {stat.growth >= 0 ? (
                                        <TrendingUp className="w-3 h-3" />
                                    ) : (
                                        <TrendingDown className="w-3 h-3" />
                                    )}
                                    {Math.abs(stat.growth)}%
                                </div>
                            )}
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                    </div>
                );
            })}
        </div>
    );
}
