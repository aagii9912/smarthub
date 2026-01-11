import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    hover?: boolean;
}

export function Card({ children, className = '', hover = false, ...props }: CardProps) {
    return (
        <div
            className={`bg-white rounded-xl border border-[#dee2e6] shadow-sm ${hover ? 'hover:shadow-md transition-all duration-300' : ''} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-4 md:px-6 py-3 md:py-4 border-b border-[#dee2e6] ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-4 md:px-6 py-3 md:py-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`text-base md:text-lg font-semibold text-[#111111] ${className}`}>{children}</h3>;
}
