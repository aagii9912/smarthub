import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    hover?: boolean;
    variant?: 'default' | 'glass' | 'elevated';
}

export function Card({ children, className = '', hover = false, variant = 'default', ...props }: CardProps) {
    const baseStyles = 'rounded-xl md:rounded-2xl transition-all duration-300';

    const variantStyles = {
        default: 'bg-white border border-slate-200/80 shadow-sm',
        glass: 'glass backdrop-blur-xl bg-white/75 border border-white/50',
        elevated: 'bg-white border border-slate-200/80 shadow-lg',
    };

    const hoverStyles = hover
        ? 'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 cursor-pointer'
        : '';

    return (
        <div
            className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-3.5 md:px-5 py-3 md:py-4 border-b border-slate-100 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-3.5 md:px-5 py-3 md:py-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`text-sm md:text-base lg:text-lg font-semibold text-slate-900 ${className}`}>{children}</h3>;
}

