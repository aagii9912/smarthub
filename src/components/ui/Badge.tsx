import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'vip';
    size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
    const variants = {
        default: 'bg-gray-100 text-gray-700',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        danger: 'bg-red-100 text-red-700',
        info: 'bg-blue-100 text-blue-700',
        vip: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
    };

    return (
        <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
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
