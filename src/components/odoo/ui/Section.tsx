import React from 'react';

interface SectionProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
}

export function Section({ children, className = '', id }: SectionProps) {
    return (
        <section id={id} className={`py-16 md:py-24 ${className}`}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                {children}
            </div>
        </section>
    );
}
