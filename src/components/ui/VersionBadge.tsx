'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, X } from 'lucide-react';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.2.0';

interface VersionBadgeProps {
    collapsed?: boolean;
    className?: string;
    showChangelog?: boolean;
}

// Version 1.2 changelog
const CHANGELOG = [
    {
        version: '1.2.0', date: '2026-02-06', changes: [
            '🔄 Realtime sync сайжруулалт',
            '📡 Connection status indicator',
            '🏷️ Version badge нэмсэн',
            '⚡ Product/Order автомат sync'
        ]
    }
];

export function VersionBadge({ collapsed = false, showChangelog = true, className = '' }: VersionBadgeProps) {
    const [showModal, setShowModal] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Check if user has seen this version
        if (typeof window !== 'undefined') {
            const seenVersion = localStorage.getItem('syncly_seen_version');
            if (seenVersion !== APP_VERSION) {
                setIsNew(true);
            }
        }
    }, []);

    const handleClick = () => {
        setShowModal(true);
        setIsNew(false);
        if (typeof window !== 'undefined') {
            localStorage.setItem('syncly_seen_version', APP_VERSION);
        }
    };

    // Prevent hydration mismatch
    if (!isMounted) {
        return collapsed ? (
            <span className={`text-[10px] text-neutral-500 text-center ${className}`}>
                v{APP_VERSION.split('.').slice(0, 2).join('.')}
            </span>
        ) : (
            <div className={`flex items-center gap-2 text-xs text-neutral-500 ${className}`}>
                <span className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] font-mono">
                    v{APP_VERSION}
                </span>
                <span className="text-neutral-600">Syncly</span>
            </div>
        );
    }

    if (collapsed) {
        return (
            <button
                onClick={handleClick}
                className={`text-[10px] text-neutral-500 text-center hover:text-gold transition-colors ${className}`}
            >
                v{APP_VERSION.split('.').slice(0, 2).join('.')}
                {isNew && <span className="ml-1 w-1.5 h-1.5 bg-gold rounded-full inline-block animate-pulse" />}
            </button>
        );
    }

    return (
        <>
            <button
                onClick={handleClick}
                className={`flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors group ${className}`}
            >
                <span className="px-2 py-0.5 bg-neutral-800 group-hover:bg-neutral-700 rounded text-[10px] font-mono flex items-center gap-1.5">
                    v{APP_VERSION}
                    {isNew && <Sparkles className="w-3 h-3 text-gold animate-pulse" />}
                </span>
                <span className="text-neutral-600 group-hover:text-neutral-400">Syncly</span>
            </button>

            {/* Changelog Modal */}
            {showModal && showChangelog && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-50"
                        onClick={() => setShowModal(false)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-800">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-gold" />
                                <h3 className="font-semibold text-gray-900 dark:text-white">Шинэ хувилбар!</h3>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {CHANGELOG.map((release) => (
                                <div key={release.version} className="mb-4 last:mb-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-gold/10 text-gold text-xs font-bold rounded">
                                            v{release.version}
                                        </span>
                                        <span className="text-xs text-gray-500">{release.date}</span>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {release.changes.map((change, i) => (
                                            <li key={i} className="text-sm text-gray-600 dark:text-gray-300">
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950">
                            <a
                                href="https://syncly.mn/changelog"
                                target="_blank"
                                className="flex items-center justify-center gap-2 text-sm text-gold hover:text-gold-light transition-colors"
                            >
                                Бүх өөрчлөлтүүд
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
