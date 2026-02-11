'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none',
    {
        variants: {
            variant: {
                primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                outline: 'border border-border bg-transparent hover:bg-secondary text-foreground',
                ghost: 'hover:bg-secondary text-foreground',
                destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
                gold: 'bg-gradient-to-r from-gold-dark via-gold to-gold-light text-neutral-900 font-semibold shadow-md shadow-gold/20 hover:shadow-lg hover:shadow-gold/30',
                link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
            },
            size: {
                xs: 'h-7 px-2.5 text-xs rounded-md',
                sm: 'h-8 px-3 text-sm rounded-md',
                md: 'h-10 px-4 text-sm rounded-lg',
                lg: 'h-11 px-6 text-base rounded-lg',
                xl: 'h-12 px-8 text-base rounded-xl',
                icon: 'h-10 w-10 rounded-lg',
                'icon-sm': 'h-8 w-8 rounded-md',
                'icon-lg': 'h-12 w-12 rounded-xl',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    href?: string;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, href, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
        const content = (
            <>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {!loading && leftIcon}
                {children}
                {rightIcon}
            </>
        );

        if (href) {
            return (
                <Link
                    href={href}
                    className={cn(buttonVariants({ variant, size, className }))}
                >
                    {content}
                </Link>
            );
        }

        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || loading}
                {...props}
            >
                {content}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
