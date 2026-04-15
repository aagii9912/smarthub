'use client';

import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    actions?: React.ReactNode;
}

export function PageHeader({
    title,
    description,
    icon: Icon,
    iconColor = 'text-white/40',
    iconBg = 'bg-white/[0.06]',
    actions,
}: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.5} />
                    </div>
                )}
                <div>
                    <h1 className="text-[18px] font-bold text-foreground tracking-[-0.02em]">{title}</h1>
                    {description && (
                        <p className="text-[11px] text-white/40 mt-0.5">{description}</p>
                    )}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
