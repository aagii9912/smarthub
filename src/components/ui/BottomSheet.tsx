'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (open) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className="absolute bottom-0 left-0 right-0 
                   bg-[#0F0B2E] rounded-t-[2.5rem] 
                   max-h-[92vh] overflow-hidden
                   animate-in slide-in-from-bottom duration-500 shadow-2xl"
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-4 pb-2">
                    <div className="w-12 h-1.5 rounded-full bg-gray-200" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(92vh-88px)] pb-12 no-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
}
