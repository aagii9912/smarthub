import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    hover?: boolean;
}

export function Card({ children, className = '', hover = false, ...props }: CardProps) {
    return (
        <div
            className={`bg-card rounded-2xl border border-border shadow-sm ${hover ? 'hover:shadow-lg hover:border-border/80 transition-all duration-300' : ''} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-6 py-4 border-b border-border ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`text-lg font-semibold text-foreground ${className}`}>{children}</h3>;
}
