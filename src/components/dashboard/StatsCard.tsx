import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        isPositive: boolean;
    };
    icon: LucideIcon;
    iconColor?: string;
}

export function StatsCard({ title, value, change, icon: Icon, iconColor = 'bg-[#65c51a]' }: StatsCardProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 active:scale-[0.98] transition-transform">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
                    {change && (
                        <p className={`text-sm mt-2 flex items-center gap-1 ${change.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                            <span className="text-gray-400 hidden sm:inline">өмнөх 7 хоногоос</span>
                        </p>
                    )}
                </div>
                <div className={`w-12 h-12 md:w-11 md:h-11 rounded-xl ${iconColor} flex items-center justify-center text-white flex-shrink-0 ml-3`}>
                    <Icon className="w-6 h-6 md:w-5 md:h-5" />
                </div>
            </div>
        </div>
    );
}
