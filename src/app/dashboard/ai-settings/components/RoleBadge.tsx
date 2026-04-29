'use client';

import {
    ShoppingCart,
    CalendarCheck,
    Info,
    LifeBuoy,
    UserPlus,
    Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentRole } from '@/lib/ai/agents/types';
import { AGENT_ROLES } from '@/lib/ai/agents';

const ICON_MAP = {
    'shopping-cart': ShoppingCart,
    'calendar-check': CalendarCheck,
    'info': Info,
    'life-buoy': LifeBuoy,
    'user-plus': UserPlus,
    'layers': Layers,
} as const;

export function RoleBadge({
    role,
    size = 'md',
    showLabel = true,
    className,
}: {
    role: AgentRole;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}) {
    const def = AGENT_ROLES[role];
    const Icon = ICON_MAP[def.iconName as keyof typeof ICON_MAP] ?? Layers;

    const sizeMap = {
        sm: { wrap: 'h-6 px-2 text-[10.5px] gap-1', icon: 'h-3 w-3' },
        md: { wrap: 'h-8 px-3 text-xs gap-1.5', icon: 'h-3.5 w-3.5' },
        lg: { wrap: 'h-10 px-4 text-sm gap-2', icon: 'h-4 w-4' },
    } as const;

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full font-medium tracking-tight',
                def.accentClass,
                sizeMap[size].wrap,
                className,
            )}
        >
            <Icon className={sizeMap[size].icon} />
            {showLabel && def.label.mn}
        </span>
    );
}
