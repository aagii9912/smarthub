'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: {
        value: number;
        isPositive: boolean;
    };
    icon: LucideIcon;
    iconColor?: string;
    delay?: number;
}

export function StatsCard({
    title,
    value,
    change,
    icon: Icon,
    iconColor = 'from-indigo-500 to-purple-500',
    delay = 0
}: StatsCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="relative overflow-hidden rounded-2xl p-4 md:p-5 cursor-pointer group"
            style={{
                background: 'rgba(24, 24, 27, 0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
        >
            {/* Hover glow effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            </div>

            <div className="flex items-start justify-between relative z-10">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-400 mb-2">{title}</p>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 0.2 }}
                        className="text-2xl md:text-3xl font-bold text-white"
                    >
                        {value}
                    </motion.p>
                    {change && (
                        <p className={`text-sm mt-2 flex items-center gap-1 ${change.isPositive ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                            <span>{change.isPositive ? '↑' : '↓'}</span>
                            <span>{Math.abs(change.value)}%</span>
                            <span className="text-zinc-500 hidden sm:inline">өмнөх 7 хоногоос</span>
                        </p>
                    )}
                </div>
                <div className={`w-12 h-12 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center text-white flex-shrink-0 ml-3 shadow-lg`}>
                    <Icon className="w-6 h-6 md:w-5 md:h-5" />
                </div>
            </div>
        </motion.div>
    );
}
