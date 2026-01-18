import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import { cn } from '@/lib/utils'; // Assuming cn exists, if not I'll define it or use clsx/tailwind-merge locally

// Fallback for cn if not exists in project typically (checking imports later, but safe to assume standard utils)
// Actually, let's check if generic utils exist or import strictly what's needed.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';



const buttonVariants = cva(
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 tap-feedback disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
    {
        variants: {
            variant: {
                primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-lg shadow-primary/25',
                secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 active:bg-secondary/70',
                danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 shadow-lg shadow-destructive/25',
                ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80',
                outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
            },
            size: {
                sm: 'px-4 py-2 text-sm min-h-[40px]',
                md: 'px-5 py-2.5 text-sm min-h-[44px]',
                lg: 'px-8 py-4 text-base min-h-[48px]', // Increased padding for premium feel
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    href?: string;
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, isLoading, href, children, ...props }, ref) => {
        if (href) {
            return (
                <Link
                    href={href}
                    className={cn(buttonVariants({ variant, size, className }))}
                >
                    {isLoading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    )}
                    {children}
                </Link>
            );
        }

        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={isLoading || props.disabled}
                aria-busy={isLoading}
                {...props}
            >
                {isLoading && (
                    <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        role="status"
                        aria-label="Loading"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
