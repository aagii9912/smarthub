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
        <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-border/80 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
                    <p className="text-3xl font-bold text-foreground">{value}</p>
                    {change && (
                        <p className={`text-sm mt-2 flex items-center gap-1 ${change.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                            <span className="text-muted-foreground">өмнөх 7 хоногоос</span>
                        </p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-lg text-white`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
}
