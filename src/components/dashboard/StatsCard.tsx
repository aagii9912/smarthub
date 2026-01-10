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

export function StatsCard({ title, value, change, icon: Icon, iconColor = 'from-violet-500 to-indigo-600' }: StatsCardProps) {
    return (
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6 hover:shadow-lg hover:border-border/80 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1 truncate">{title}</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground truncate">{value}</p>
                    {change && (
                        <p className={`text-xs md:text-sm mt-1 md:mt-2 flex items-center gap-1 ${change.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                            <span className="text-muted-foreground hidden sm:inline">өмнөх 7 хоногоос</span>
                        </p>
                    )}
                </div>
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-lg text-white flex-shrink-0 ml-2`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
            </div>
        </div>
    );
}
