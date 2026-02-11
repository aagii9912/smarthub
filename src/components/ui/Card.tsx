import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ─── Card ─── */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { hover?: boolean; glass?: boolean }>(
    ({ className, hover, glass, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
                hover && 'card-hover-lift cursor-pointer',
                glass && 'glass',
                className
            )}
            {...props}
        />
    )
);
Card.displayName = 'Card';

/* ─── CardHeader ─── */
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col gap-1.5 p-4 md:p-6', className)} {...props} />
    )
);
CardHeader.displayName = 'CardHeader';

/* ─── CardTitle ─── */
const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />
    )
);
CardTitle.displayName = 'CardTitle';

/* ─── CardDescription ─── */
const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
    )
);
CardDescription.displayName = 'CardDescription';

/* ─── CardContent ─── */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('p-4 md:p-6 pt-0', className)} {...props} />
    )
);
CardContent.displayName = 'CardContent';

/* ─── CardFooter ─── */
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex items-center p-4 md:p-6 pt-0', className)} {...props} />
    )
);
CardFooter.displayName = 'CardFooter';

/* ─── MetricCard (Dashboard Stats) ─── */
interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: { value: number; label?: string };
    color?: 'default' | 'gold' | 'blue' | 'green' | 'purple' | 'red';
}

const colorMap = {
    default: 'bg-secondary text-foreground',
    gold: 'bg-gold/10 text-gold-dark',
    blue: 'bg-blue-900/20 text-blue-400',
    green: 'bg-green-900/20 text-green-400',
    purple: 'bg-purple-900/20 text-purple-400',
    red: 'bg-red-900/20 text-red-400',
};

const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
    ({ title, value, subtitle, icon, trend, color = 'default', className, ...props }, ref) => (
        <Card ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
            <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
                        <p className="mt-2 text-2xl md:text-3xl font-bold text-foreground tabular-nums">{value}</p>
                        {trend && (
                            <div className="mt-1 flex items-center gap-1">
                                <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-500')}>
                                    {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
                                </span>
                                {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
                            </div>
                        )}
                        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
                    </div>
                    {icon && (
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', colorMap[color])}>
                            {icon}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
);
MetricCard.displayName = 'MetricCard';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, MetricCard };
