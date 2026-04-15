'use client';

import { cn } from '@/lib/utils';

interface ToggleProps {
    enabled: boolean;
    onChange: (value: boolean) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

export function Toggle({ enabled, onChange, label, description, disabled = false, size = 'md' }: ToggleProps) {
    const trackCls = cn(
        'relative rounded-full transition-colors cursor-pointer',
        size === 'md' ? 'w-11 h-6' : 'w-9 h-5',
        enabled ? 'bg-[#4A7CE7]' : 'bg-[#1C1650]',
        disabled && 'opacity-50 cursor-not-allowed'
    );

    const dotCls = cn(
        'absolute bg-white rounded-full transition-all',
        size === 'md' ? 'top-1 w-4 h-4' : 'top-0.5 w-4 h-4',
        size === 'md' ? (enabled ? 'left-6' : 'left-1') : (enabled ? 'left-4.5' : 'left-0.5')
    );

    if (label || description) {
        return (
            <div className="flex items-center justify-between p-4 bg-[#0D0928] rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div>
                    {label && <p className="text-[13px] font-medium text-foreground">{label}</p>}
                    {description && <p className="text-[11px] text-white/40 mt-0.5">{description}</p>}
                </div>
                <button
                    onClick={() => !disabled && onChange(!enabled)}
                    className={trackCls}
                    disabled={disabled}
                    role="switch"
                    aria-checked={enabled}
                    aria-label={label}
                >
                    <div className={dotCls} />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => !disabled && onChange(!enabled)}
            className={trackCls}
            disabled={disabled}
            role="switch"
            aria-checked={enabled}
        >
            <div className={dotCls} />
        </button>
    );
}
