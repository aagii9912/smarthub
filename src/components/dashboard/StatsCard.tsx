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
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {change && (
                        <p className={`text-sm mt-2 flex items-center gap-1 ${change.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                            <span className="text-gray-400">өмнөх 7 хоногоос</span>
                        </p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );
}
