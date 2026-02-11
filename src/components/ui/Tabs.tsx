'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ─── Context ─── */
interface TabsContextValue {
    value: string;
    onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
    return ctx;
}

/* ─── Tabs Root ─── */
interface TabsProps {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}

function Tabs({ value: controlledValue, defaultValue = '', onValueChange, children, className }: TabsProps) {
    const [uncontrolled, setUncontrolled] = useState(defaultValue);
    const value = controlledValue ?? uncontrolled;
    const onChange = (v: string) => {
        setUncontrolled(v);
        onValueChange?.(v);
    };

    return (
        <TabsContext.Provider value={{ value, onChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

/* ─── TabsList ─── */
interface TabsListProps {
    children: ReactNode;
    className?: string;
    variant?: 'underline' | 'pill';
}

function TabsList({ children, className, variant = 'underline' }: TabsListProps) {
    return (
        <div
            role="tablist"
            className={cn(
                'flex gap-1',
                variant === 'underline' && 'border-b border-border',
                variant === 'pill' && 'bg-secondary rounded-lg p-1',
                className
            )}
        >
            {children}
        </div>
    );
}

/* ─── TabsTrigger ─── */
interface TabsTriggerProps {
    value: string;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
    variant?: 'underline' | 'pill';
}

function TabsTrigger({ value, children, className, disabled, variant = 'underline' }: TabsTriggerProps) {
    const { value: selectedValue, onChange } = useTabs();
    const isActive = selectedValue === value;

    return (
        <button
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={cn(
                'relative px-3 py-2 text-sm font-medium transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-50',
                variant === 'underline' && [
                    'border-b-2 -mb-px',
                    isActive
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                ],
                variant === 'pill' && [
                    'rounded-md',
                    isActive
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                ],
                className
            )}
        >
            {children}
        </button>
    );
}

/* ─── TabsContent ─── */
interface TabsContentProps {
    value: string;
    children: ReactNode;
    className?: string;
}

function TabsContent({ value, children, className }: TabsContentProps) {
    const { value: selectedValue } = useTabs();
    if (selectedValue !== value) return null;

    return (
        <div role="tabpanel" className={cn('mt-4 animate-fade-in', className)}>
            {children}
        </div>
    );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
