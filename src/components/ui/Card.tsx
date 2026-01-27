'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children: React.ReactNode;
    hover?: boolean;
    className?: string;
}

export function Card({ children, className = '', hover = false, ...props }: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : undefined}
            className={`rounded-2xl overflow-hidden ${className}`}
            style={{
                background: 'rgba(24, 24, 27, 0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`px-4 md:px-6 py-4 md:py-5 border-b border-zinc-800/50 ${className}`}>
            {children}
        </div>
    );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`px-4 md:px-6 py-4 md:py-5 ${className}`}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <h3 className={`text-base md:text-lg font-semibold text-white ${className}`}>
            {children}
        </h3>
    );
}
