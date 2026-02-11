import { type HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
    {
        variants: {
            variant: {
                default: 'border-border bg-secondary text-secondary-foreground',
                primary: 'border-transparent bg-primary text-primary-foreground',
                secondary: 'border-border bg-secondary text-secondary-foreground',
                success: 'border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                warning: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 text-blue-400',
                destructive: 'border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 text-red-400',
                info: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 text-blue-400',
                gold: 'border-transparent bg-gold/10 text-gold-dark dark:text-gold',
                vip: 'border-gold/30 bg-gradient-to-r from-gold/10 to-gold/5 text-gold-dark dark:text-gold font-semibold',
                outline: 'border-border text-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps
    extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    dot?: boolean;
    dotColor?: string;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant, dot, dotColor, children, ...props }, ref) => (
        <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
            {dot && (
                <span
                    className={cn('h-1.5 w-1.5 rounded-full', dotColor || 'bg-current')}
                    style={dotColor ? { backgroundColor: dotColor } : undefined}
                />
            )}
            {children}
        </div>
    )
);
Badge.displayName = 'Badge';

/* ─── Order Status Badge ─── */
const statusConfig: Record<string, { label: string; variant: NonNullable<VariantProps<typeof badgeVariants>['variant']> }> = {
    pending: { label: 'Хүлээгдэж буй', variant: 'warning' },
    confirmed: { label: 'Баталгаажсан', variant: 'info' },
    shipping: { label: 'Хүргэлтэнд', variant: 'info' },
    delivered: { label: 'Хүргэгдсэн', variant: 'success' },
    cancelled: { label: 'Цуцлагдсан', variant: 'destructive' },
    paid: { label: 'Төлөгдсөн', variant: 'gold' },
    pickup: { label: 'Очиж авах', variant: 'info' },
};

function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
    const config = statusConfig[status] || { label: status, variant: 'default' as const };
    return (
        <Badge variant={config.variant} dot className={cn('text-[10px]', className)}>
            {config.label}
        </Badge>
    );
}

export { Badge, badgeVariants, OrderStatusBadge };
