import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    children: React.ReactNode;
}

export function Button({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 tap-feedback disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-lg shadow-primary/25',
        secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 active:bg-secondary/70',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 shadow-lg shadow-destructive/25',
        ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80',
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm min-h-[40px]', // 40px for mobile accessibility
        md: 'px-5 py-2.5 text-sm min-h-[44px]', // 44px minimum touch target
        lg: 'px-6 py-3 text-base min-h-[48px]', // 48px for larger touch area
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled || isLoading ? 'opacity-50 pointer-events-none' : ''} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            )}
            {children}
        </button>
    );
}
