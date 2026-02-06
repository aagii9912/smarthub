'use client';

import React from 'react';

// VERSION is imported from package.json at build time
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.2.0';

interface VersionBadgeProps {
    collapsed?: boolean;
    className?: string;
}

export function VersionBadge({ collapsed = false, className = '' }: VersionBadgeProps) {
    if (collapsed) {
        return (
            <div className={`text-[10px] text-neutral-500 text-center ${className}`}>
                v{APP_VERSION.split('.').slice(0, 2).join('.')}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 text-xs text-neutral-500 ${className}`}>
            <span className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] font-mono">
                v{APP_VERSION}
            </span>
            <span className="text-neutral-600">Syncly</span>
        </div>
    );
}
