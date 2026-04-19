import type { HTMLAttributes, ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';

interface KPIProps extends HTMLAttributes<HTMLDivElement> {
    label: ReactNode;
    value: ReactNode;
    trend?: 'up' | 'down';
    trendValue?: ReactNode;
    spark?: number[];
    featured?: boolean;
    icon?: ReactNode;
}

export function KPI({
    label,
    value,
    trend,
    trendValue,
    spark,
    featured,
    icon,
    className,
    ...props
}: KPIProps) {
    return (
        <div
            className={cn(
                featured ? 'card-featured' : 'card-outlined',
                'p-4 md:p-5 flex flex-col gap-2',
                className
            )}
            {...props}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </div>
                {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
            </div>
            <div className="syn-metric">{value}</div>
            {trend && (
                <div
                    className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium',
                        trend === 'up' ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'
                    )}
                >
                    {trend === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {trendValue && <span className="tabular-nums">{trendValue}</span>}
                </div>
            )}
            {spark && spark.length > 0 && (
                <div className="mt-1">
                    <Sparkline data={spark} height={36} />
                </div>
            )}
        </div>
    );
}
