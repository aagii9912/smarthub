import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeroProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    eyebrow?: ReactNode;
    eyebrowTone?: 'default' | 'violet' | 'emerald';
    title: ReactNode;
    subtitle?: ReactNode;
    live?: boolean;
    actions?: ReactNode;
}

export function PageHero({
    eyebrow,
    eyebrowTone = 'default',
    title,
    subtitle,
    live,
    actions,
    className,
    ...props
}: PageHeroProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-4 md:pb-6 border-b border-border/60',
                className
            )}
            {...props}
        >
            <div className="min-w-0">
                {eyebrow && (
                    <div
                        className={cn(
                            'syn-eyebrow',
                            eyebrowTone === 'violet' && 'violet',
                            eyebrowTone === 'emerald' && 'emerald'
                        )}
                    >
                        {live && <span className="live-pulse" aria-hidden />}
                        {eyebrow}
                    </div>
                )}
                <h1 className="syn-h1 mt-2">{title}</h1>
                {subtitle && (
                    <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 md:gap-3">{actions}</div>}
        </div>
    );
}
