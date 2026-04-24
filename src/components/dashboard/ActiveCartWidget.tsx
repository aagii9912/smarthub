'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import {
    ShoppingCart,
    Send,
    ArrowRightLeft,
    Minus,
    Plus,
    Trash2,
    Package,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
}

interface ActiveCartWidgetProps {
    customerName: string;
    items: CartItem[];
    onConvertToOrder: () => void;
    onSendReminder: () => void;
    onUpdateQuantity?: (itemId: string, quantity: number) => Promise<void> | void;
    onRemoveItem?: (itemId: string) => Promise<void> | void;
    isLoading?: boolean;
}

export function ActiveCartWidget({
    items,
    onConvertToOrder,
    onSendReminder,
    onUpdateQuantity,
    onRemoveItem,
    isLoading = false,
}: ActiveCartWidgetProps) {
    const [busyItemId, setBusyItemId] = useState<string | null>(null);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    const handleQuantity = async (itemId: string, next: number) => {
        if (!onUpdateQuantity || busyItemId) return;
        if (next < 1) return;
        setBusyItemId(itemId);
        try {
            await onUpdateQuantity(itemId, next);
        } finally {
            setBusyItemId(null);
        }
    };

    const handleRemove = async (itemId: string) => {
        if (!onRemoveItem || busyItemId) return;
        setBusyItemId(itemId);
        try {
            await onRemoveItem(itemId);
        } finally {
            setBusyItemId(null);
        }
    };

    const hasItems = items.length > 0;

    return (
        <div className="card-outlined overflow-hidden">
            {/* Header: prominent total */}
            <div
                className="px-5 py-4 border-b border-white/[0.06]"
                style={{
                    background:
                        'linear-gradient(135deg, color-mix(in oklab, var(--brand-indigo) 12%, transparent), color-mix(in oklab, var(--brand-violet-500) 6%, transparent))',
                }}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-white/55 uppercase tracking-[0.08em]">
                            <ShoppingCart
                                className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                                strokeWidth={1.5}
                            />
                            Идэвхтэй сагс
                        </div>
                        <div className="mt-1 text-[11px] text-white/40 tabular-nums">
                            {items.length} бараа · {itemCount} ширхэг
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-[10px] font-medium text-white/45 uppercase tracking-[0.08em]">
                            Нийт дүн
                        </div>
                        <div
                            className="mt-0.5 text-[24px] font-black tracking-[-0.02em] tabular-nums"
                            style={{
                                background:
                                    'linear-gradient(135deg, var(--brand-indigo-400), var(--brand-violet-500))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {total.toLocaleString()}₮
                        </div>
                    </div>
                </div>
            </div>

            {/* Items list */}
            <div className="divide-y divide-white/[0.04]">
                {hasItems ? (
                    items.map((item) => {
                        const isBusy = busyItemId === item.id;
                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 transition-opacity',
                                    isBusy && 'opacity-60'
                                )}
                            >
                                {/* Image */}
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06] shrink-0 flex items-center justify-center">
                                    {item.image ? (
                                        <Image
                                            src={item.image}
                                            alt={item.name}
                                            width={48}
                                            height={48}
                                            className="w-full h-full object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <Package
                                            className="w-5 h-5 text-white/25"
                                            strokeWidth={1.5}
                                        />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-foreground truncate tracking-[-0.01em]">
                                        {item.name}
                                    </p>
                                    <div className="mt-0.5 text-[11px] text-white/50 tabular-nums">
                                        {item.price.toLocaleString()}₮ ×{' '}
                                        <span className="text-white/75 font-medium">
                                            {item.quantity}ш
                                        </span>
                                        <span className="mx-1.5 text-white/20">·</span>
                                        <span className="text-white/70 font-semibold">
                                            {(item.price * item.quantity).toLocaleString()}₮
                                        </span>
                                    </div>
                                </div>

                                {/* Quantity + Remove */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {onUpdateQuantity && (
                                        <div className="flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleQuantity(item.id, item.quantity - 1)
                                                }
                                                disabled={item.quantity <= 1 || isBusy}
                                                className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                aria-label="Бууруулах"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-7 text-center text-[12px] font-semibold text-white tabular-nums">
                                                {isBusy ? (
                                                    <Loader2 className="w-3 h-3 animate-spin inline" />
                                                ) : (
                                                    item.quantity
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleQuantity(item.id, item.quantity + 1)
                                                }
                                                disabled={isBusy}
                                                className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                aria-label="Нэмэгдүүлэх"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    {onRemoveItem && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(item.id)}
                                            disabled={isBusy}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            aria-label="Устгах"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="px-6 py-10 text-center">
                        <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <ShoppingCart
                                className="w-5 h-5 text-white/25"
                                strokeWidth={1.5}
                            />
                        </div>
                        <p className="text-[12px] text-white/40 tracking-[-0.01em]">
                            Сагс хоосон байна
                        </p>
                    </div>
                )}
            </div>

            {/* Actions */}
            {hasItems && (
                <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.015] flex flex-col sm:flex-row gap-2">
                    <Button
                        size="sm"
                        onClick={onConvertToOrder}
                        disabled={isLoading}
                        className="flex-1 h-10 text-[13px] font-semibold"
                    >
                        <ArrowRightLeft
                            className={cn('w-4 h-4 mr-1.5', isLoading && 'animate-spin')}
                        />
                        {isLoading ? 'Үүсгэж байна...' : 'Захиалга болгох'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onSendReminder}
                        disabled={isLoading}
                        className="flex-1 sm:flex-initial h-10 text-[13px] font-semibold"
                    >
                        <Send className="w-4 h-4 mr-1.5" />
                        Сануулга илгээх
                    </Button>
                </div>
            )}
        </div>
    );
}
