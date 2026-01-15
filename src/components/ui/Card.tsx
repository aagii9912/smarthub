import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    hover?: boolean;
}

export function Card({ children, className = '', hover = false, ...props }: CardProps) {
    return (
        <div
            className={`bg-white rounded-2xl border border-gray-200 ${hover ? 'hover:border-gray-300 transition-all duration-200' : ''} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`px-4 md:px-6 py-4 md:py-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`text-base md:text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>;
}
