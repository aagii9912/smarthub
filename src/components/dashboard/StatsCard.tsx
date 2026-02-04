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
    iconColor?: 'brand' | 'blue' | 'purple' | 'success' | 'warning';
}

export function StatsCard({ title, value, change, icon: Icon, iconColor = 'brand' }: StatsCardProps) {
    const iconStyles = {
        brand: 'bg-gradient-to-br from-[#4A7CE7] to-[#904EA0] shadow-lg shadow-[#4A7CE7]/20',
        blue: 'bg-gradient-to-br from-[#4A7CE7] to-[#3A5BB8] shadow-lg shadow-[#4A7CE7]/20',
        purple: 'bg-gradient-to-br from-[#904EA0] to-[#6B2D7B] shadow-lg shadow-[#904EA0]/20',
        success: 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20',
        warning: 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20',
    };

    return (
        <div className="group relative overflow-hidden bg-white/90 backdrop-blur-sm rounded-xl md:rounded-2xl border border-slate-200/80 p-3.5 md:p-5 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-1 cursor-pointer">
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#4A7CE7]/0 to-[#904EA0]/0 group-hover:from-[#4A7CE7]/3 group-hover:to-[#904EA0]/3 transition-all duration-300" />

            <div className="relative flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1 md:mb-2 truncate">{title}</p>
                    <p className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
                    {change && (
                        <p className={`text-xs md:text-sm mt-1.5 md:mt-2.5 flex items-center gap-1 font-medium ${change.isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                            <span className={`inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full text-[10px] md:text-xs ${change.isPositive ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                {change.isPositive ? '↑' : '↓'}
                            </span>
                            <span>{Math.abs(change.value)}%</span>
                        </p>
                    )}
                </div>
                <div className={`w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg md:rounded-xl ${iconStyles[iconColor]} flex items-center justify-center text-white flex-shrink-0 transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" strokeWidth={1.5} />
                </div>
            </div>
        </div>
    );
}

