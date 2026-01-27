'use client';

import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════
// FRAMER MOTION ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
};

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.5, ease: 'easeOut' }
    }
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    }
};

export const slideInLeft: Variants = {
    hidden: { opacity: 0, x: -30 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
};

export const slideInRight: Variants = {
    hidden: { opacity: 0, x: 30 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
};

export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
};

// ═══════════════════════════════════════════════════════════════════
// ANIMATED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

interface MotionCardProps extends HTMLMotionProps<'div'> {
    children: ReactNode;
    className?: string;
    delay?: number;
    hover?: boolean;
}

export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
    ({ children, className = '', delay = 0, hover = true, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: {
                        opacity: 1,
                        y: 0,
                        transition: {
                            duration: 0.5,
                            delay,
                            ease: [0.16, 1, 0.3, 1]
                        }
                    }
                }}
                whileHover={hover ? {
                    y: -4,
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                    borderColor: 'rgba(99, 102, 241, 0.5)'
                } : undefined}
                transition={{ duration: 0.3 }}
                className={`glass rounded-xl p-6 ${className}`}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

MotionCard.displayName = 'MotionCard';

interface MotionContainerProps extends HTMLMotionProps<'div'> {
    children: ReactNode;
    className?: string;
    stagger?: boolean;
}

export const MotionContainer = forwardRef<HTMLDivElement, MotionContainerProps>(
    ({ children, className = '', stagger = true, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial="hidden"
                animate="visible"
                variants={stagger ? staggerContainer : undefined}
                className={className}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

MotionContainer.displayName = 'MotionContainer';

interface MotionItemProps extends HTMLMotionProps<'div'> {
    children: ReactNode;
    className?: string;
}

export const MotionItem = forwardRef<HTMLDivElement, MotionItemProps>(
    ({ children, className = '', ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                variants={staggerItem}
                className={className}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

MotionItem.displayName = 'MotionItem';

interface MotionButtonProps extends HTMLMotionProps<'button'> {
    children: ReactNode;
    className?: string;
    variant?: 'primary' | 'secondary' | 'ghost';
}

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
    ({ children, className = '', variant = 'primary', ...props }, ref) => {
        const baseStyles = 'px-6 py-3 rounded-xl font-medium transition-all cursor-pointer';
        const variants = {
            primary: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white',
            secondary: 'bg-secondary text-secondary-foreground border border-border',
            ghost: 'bg-transparent text-foreground hover:bg-secondary'
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`${baseStyles} ${variants[variant]} ${className}`}
                {...props}
            >
                {children}
            </motion.button>
        );
    }
);

MotionButton.displayName = 'MotionButton';

// Page transition wrapper
interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Gradient text component
interface GradientTextProps {
    children: ReactNode;
    className?: string;
}

export function GradientText({ children, className = '' }: GradientTextProps) {
    return (
        <span className={`bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent ${className}`}>
            {children}
        </span>
    );
}

// Glow effect wrapper
interface GlowWrapperProps {
    children: ReactNode;
    className?: string;
    color?: 'purple' | 'blue' | 'pink';
}

export function GlowWrapper({ children, className = '', color = 'purple' }: GlowWrapperProps) {
    const colors = {
        purple: 'rgba(99, 102, 241, 0.3)',
        blue: 'rgba(14, 165, 233, 0.3)',
        pink: 'rgba(236, 72, 153, 0.3)'
    };

    return (
        <motion.div
            animate={{
                boxShadow: [
                    `0 0 20px ${colors[color]}`,
                    `0 0 40px ${colors[color]}`,
                    `0 0 20px ${colors[color]}`
                ]
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
