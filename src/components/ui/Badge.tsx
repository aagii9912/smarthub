import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'vip';
    size?: 'sm' | 'md';
    className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
    const variants = {
        default: 'bg-secondary text-secondary-foreground',
        success: 'bg-emerald-500/10 text-emerald-600',
        warning: 'bg-amber-500/10 text-amber-600',
        danger: 'bg-destructive/10 text-destructive',
        info: 'bg-blue-500/10 text-blue-600',
        vip: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
    };

    return (
        <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
            {children}
        </span>
    );
}

// Order status badge
export function OrderStatusBadge({ status }: { status: string }) {
    const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
        pending: { label: 'Хүлээгдэж буй', variant: 'warning' },
        confirmed: { label: 'Баталгаажсан', variant: 'info' },
        processing: { label: 'Бэлтгэж буй', variant: 'info' },
        shipped: { label: 'Илгээсэн', variant: 'success' },
        delivered: { label: 'Хүргэгдсэн', variant: 'success' },
        cancelled: { label: 'Цуцлагдсан', variant: 'danger' },
    };

    const config = statusConfig[status] || { label: status, variant: 'default' as const };

    return <Badge variant={config.variant}>{config.label}</Badge>;
}
