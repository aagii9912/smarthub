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
        <div className="bg-white rounded-xl border border-[#dee2e6] p-4 md:p-5 hover:shadow-md transition-all duration-300">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-[#6c757d] mb-1.5">{title}</p>
                    <p className="text-2xl md:text-3xl font-bold text-[#111111]">{value}</p>
                    {change && (
                        <p className={`text-xs md:text-sm mt-2 flex items-center gap-1 ${change.isPositive ? 'text-[#65c51a]' : 'text-red-500'}`}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                            <span className="text-[#6c757d] hidden sm:inline">vs last week</span>
                        </p>
                    )}
                </div>
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl ${iconColor} flex items-center justify-center text-white flex-shrink-0 ml-3`}>
                    <Icon className="w-5 h-5 md:w-5 md:h-5" />
                </div>
            </div>
        </div>
    );
}
