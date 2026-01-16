import React from 'react';

interface LiveIndicatorProps {
    label?: string;
}

export function LiveIndicator({ label = 'Live' }: LiveIndicatorProps) {
    return (
        <div className="flex items-center gap-2 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
            <span className="relative flex h-2 w-2">
                {/* Ping animation */}
                <span className="animate-ping absolute inline-flex h-full w-full 
                        rounded-full bg-emerald-400 opacity-75" />
                {/* Solid dot */}
                <span className="relative inline-flex rounded-full h-2 w-2 
                        bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{label}</span>
        </div>
    );
}
