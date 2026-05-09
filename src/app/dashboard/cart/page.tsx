'use client';

import React, { useState, useEffect } from 'react';
import { CustomerList } from '@/components/dashboard/CustomerList';
import { ActiveCartWidget } from '@/components/dashboard/ActiveCartWidget';
import { useActiveCarts } from '@/hooks/useActiveCarts';
import { toast } from 'sonner';
import {
    ShoppingCart,
    ArrowLeft,
    Info,
    RefreshCcw,
    Crown,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function CartPage() {
    const { data: carts = [], isLoading, error, refetch } = useActiveCarts();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isReminding, setIsReminding] = useState(false);

    const shopId =
        typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    const handleConvertToOrder = async () => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart) return;

        try {
            setIsConverting(true);
            const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'checkout',
                    customer_id: cart.customer.id,
                    notes: 'Dashboard Cart Checkout',
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Захиалга үүсгэхэд алдаа гарлаа');
            }

            toast.success(data.message || 'Захиалга амжилттай үүслээ');

            await refetch();
            setActiveId(null);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setIsConverting(false);
        }
    };

    const handleSendReminder = async () => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart) return;

        try {
            setIsReminding(true);
            const res = await fetch('/api/dashboard/inbox/remind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: cart.customer.id,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Сануулга илгээхэд алдаа гарлаа');
            }

            toast.success(data.message || 'Сануулга илгээгдлээ');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setIsReminding(false);
        }
    };

    const handleUpdateQuantity = async (itemId: string, quantity: number) => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart?.customer?.id) return;

        try {
            const res = await fetch('/api/cart', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId,
                },
                body: JSON.stringify({
                    item_id: itemId,
                    customer_id: cart.customer.id,
                    quantity,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Шинэчлэхэд алдаа гарлаа');
            }
            await refetch();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!activeId) return;
        const cart = carts.find((c) => c.id === activeId);
        if (!cart?.customer?.id) return;

        try {
            const res = await fetch(
                `/api/cart?item_id=${itemId}&customer_id=${cart.customer.id}`,
                {
                    method: 'DELETE',
                    headers: { 'x-shop-id': shopId },
                }
            );
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Устгахад алдаа гарлаа');
            }
            toast.success(data.message || 'Бараа хасагдлаа');
            await refetch();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    useEffect(() => {
        if (carts.length > 0 && !activeId && window.innerWidth >= 768) {
            setActiveId(carts[0].id);
        }
    }, [carts, activeId]);

    const activeCart = carts.find((c) => c.id === activeId);
    const handleSelect = (id: string) => setActiveId(id);
    const handleBack = () => setActiveId(null);

    const header = (
        <PageHero
            eyebrow="Идэвхтэй сагс"
            live
            title="Сагс"
            subtitle="AI-тай яриа үргэлжилж буй харилцагчдын сагс. Чат хариулахдаа Inbox-ыг ашиглана уу."
            actions={
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/70">
                    <ShoppingCart
                        className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                        strokeWidth={1.5}
                    />
                    <span className="font-medium tabular-nums tracking-[-0.01em]">
                        {carts.length} сагс
                    </span>
                </div>
            }
        />
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="h-[calc(100vh-260px)] card-outlined animate-pulse" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                {header}
                <div className="card-outlined p-10 flex flex-col items-center justify-center text-center">
                    <p
                        className="text-[13px] mb-4 tracking-[-0.01em]"
                        style={{ color: 'var(--destructive)' }}
                    >
                        Алдаа гарлаа: {(error as Error).message}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}
                    >
                        Дахин ачаалах
                    </Button>
                </div>
            </div>
        );
    }

    if (carts.length === 0) {
        return (
            <div className="space-y-6">
                {header}
                <div className="card-outlined p-14 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                        <ShoppingCart
                            className="w-7 h-7 text-[var(--brand-indigo-400)]"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-[16px] font-semibold text-foreground mb-1 tracking-[-0.02em]">
                        Идэвхтэй сагс байхгүй
                    </h3>
                    <p className="text-[13px] text-white/45 max-w-sm mb-6 tracking-[-0.01em]">
                        Одоогоор ямар нэгэн хэрэглэгч бараа сонирхоогүй байна.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}
                    >
                        Шинэчлэх
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            {header}

            <div className="flex-1 min-h-[520px] card-outlined overflow-hidden flex flex-col md:flex-row">
                {/* Left: Customer List */}
                <div
                    className={cn(
                        'w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-white/[0.06] h-full flex flex-col min-h-0',
                        activeId ? 'hidden md:flex' : 'flex'
                    )}
                >
                    <CustomerList
                        carts={carts}
                        activeId={activeId || undefined}
                        onSelect={handleSelect}
                    />
                </div>

                {/* Right: Active Cart Details */}
                <div
                    className={cn(
                        'flex-1 h-full flex flex-col min-w-0',
                        activeId ? 'flex' : 'hidden md:flex'
                    )}
                >
                    {activeCart ? (
                        <div className="h-full flex flex-col">
                            {/* Mobile Header */}
                            <div className="md:hidden flex items-center px-4 py-3 border-b border-white/[0.06]">
                                <button
                                    onClick={handleBack}
                                    className="mr-3 p-2 -ml-2 rounded-md hover:bg-white/[0.04] transition-colors"
                                    aria-label="Back"
                                >
                                    <ArrowLeft className="w-5 h-5 text-white/50" strokeWidth={1.5} />
                                </button>
                                <div>
                                    <h3 className="font-semibold text-foreground text-[14px] tracking-[-0.01em]">
                                        {activeCart.customer.name}
                                    </h3>
                                    <p className="text-[11px] text-[var(--brand-indigo-400)] tabular-nums">
                                        Нийт: ₮{activeCart.totalAmount.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                <div className="max-w-2xl mx-auto space-y-5">
                                    <ActiveCartWidget
                                        customerName={activeCart.customer.name}
                                        items={activeCart.items}
                                        onConvertToOrder={handleConvertToOrder}
                                        onSendReminder={handleSendReminder}
                                        onUpdateQuantity={handleUpdateQuantity}
                                        onRemoveItem={handleRemoveItem}
                                        isLoading={isConverting || isReminding}
                                    />

                                    {/* Customer Info Card */}
                                    <div className="card-outlined p-5">
                                        <h4 className="text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] mb-4 flex items-center gap-2">
                                            <Info
                                                className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]"
                                                strokeWidth={1.5}
                                            />
                                            Хэрэглэгчийн мэдээлэл
                                        </h4>
                                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Нэр
                                                </dt>
                                                <dd className="font-medium text-foreground tracking-[-0.01em]">
                                                    {activeCart.customer.name}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Facebook ID
                                                </dt>
                                                <dd className="font-mono text-[12px] text-white/55">
                                                    {activeCart.customer.facebookId || 'N/A'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Сүүлийн үйлдэл
                                                </dt>
                                                <dd className="text-foreground tracking-[-0.01em]">
                                                    {activeCart.lastActive
                                                        ? new Date(
                                                              activeCart.lastActive
                                                          ).toLocaleString()
                                                        : 'N/A'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-white/45 mb-1 tracking-[-0.01em] text-[11px] uppercase tracking-[0.06em]">
                                                    Статус
                                                </dt>
                                                <dd>
                                                    {activeCart.customer.isVip ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                            style={{
                                                                background:
                                                                    'color-mix(in oklab, var(--gold) 20%, transparent)',
                                                                color: 'var(--gold)',
                                                            }}
                                                        >
                                                            <Crown className="w-3 h-3" />
                                                            VIP
                                                        </span>
                                                    ) : (
                                                        <span className="text-white/45 text-[12px]">
                                                            Энгийн
                                                        </span>
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                                    <ShoppingCart
                                        className="w-7 h-7 text-[var(--brand-indigo-400)]"
                                        strokeWidth={1.5}
                                    />
                                </div>
                                <p className="text-[13px] text-white/45 tracking-[-0.01em]">
                                    Хэрэглэгч сонгож дэлгэрэнгүйг харна уу
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
