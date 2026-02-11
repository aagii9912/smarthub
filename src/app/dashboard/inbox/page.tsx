'use client';

import React, { useState } from 'react';
import { CustomerList } from '@/components/dashboard/CustomerList';
import { ActiveCartWidget } from '@/components/dashboard/ActiveCartWidget';
import { useActiveCarts } from '@/hooks/useActiveCarts';
import { toast } from 'sonner';
import { ShoppingCart, Loader2, ArrowLeft, Info, RefreshCcw } from 'lucide-react';

export default function InboxPage() {
    const { data: carts = [], isLoading, error, refetch } = useActiveCarts();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [isReminding, setIsReminding] = useState(false);

    const handleConvertToOrder = async () => {
        if (!activeId) return;
        const cart = carts.find(c => c.id === activeId);
        if (!cart) return;

        try {
            setIsConverting(true);
            const res = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'checkout',
                    customer_id: cart.customer.id,
                    notes: 'Dashboard Inbox Checkout'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Захиалга үүсгэхэд алдаа гарлаа');
            }

            toast.success(data.message || 'Захиалга амжилттай үүслээ');

            await refetch();
            setActiveId(null);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsConverting(false);
        }
    };

    const handleSendReminder = async () => {
        if (!activeId) return;
        const cart = carts.find(c => c.id === activeId);
        if (!cart) return;

        try {
            setIsReminding(true);
            const res = await fetch('/api/dashboard/inbox/remind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: cart.customer.id
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Сануулга илгээхэд алдаа гарлаа');
            }

            toast.success(data.message || 'Сануулга илгээгдлээ');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsReminding(false);
        }
    };

    React.useEffect(() => {
        if (carts.length > 0 && !activeId && window.innerWidth >= 768) {
            setActiveId(carts[0].id);
        }
    }, [carts, activeId]);

    const activeCart = carts.find((c) => c.id === activeId);

    const handleSelect = (id: string) => {
        setActiveId(id);
    };

    const handleBack = () => {
        setActiveId(null);
    };

    // Loading State
    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-[#0F0B2E] rounded-lg border border-white/[0.08]">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 text-white/20 animate-spin mx-auto mb-3" />
                    <p className="text-[13px] text-white/40 tracking-[-0.01em]">Ачаалж байна...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="flex flex-col h-[calc(100vh-140px)] items-center justify-center bg-[#0F0B2E] rounded-lg border border-white/[0.08]">
                <div className="text-center text-red-500 px-4 mb-4">
                    <p className="text-[13px] tracking-[-0.01em]">Алдаа гарлаа: {(error as Error).message}</p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium border border-white/[0.08] rounded-md hover:border-white/[0.15] transition-colors text-foreground tracking-[-0.01em]"
                >
                    <RefreshCcw className="w-3.5 h-3.5" /> Дахин ачаалах
                </button>
            </div>
        );
    }

    // Empty State
    if (carts.length === 0) {
        return (
            <div className="flex flex-col h-[calc(100vh-140px)] items-center justify-center bg-[#0F0B2E] rounded-lg border border-white/[0.08]">
                <div className="text-center px-6">
                    <ShoppingCart className="w-10 h-10 text-white/10 mx-auto mb-6" strokeWidth={1.5} />
                    <h3 className="text-[15px] font-semibold text-foreground mb-2 tracking-[-0.02em]">Идэвхтэй сагс байхгүй</h3>
                    <p className="text-[13px] text-white/40 max-w-sm mb-6 tracking-[-0.01em]">
                        Одоогоор ямар нэгэн хэрэглэгч бараа сонирхоогүй байна.
                    </p>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 mx-auto px-3 py-1.5 text-[13px] font-medium border border-white/[0.08] rounded-md hover:border-white/[0.15] transition-colors text-foreground tracking-[-0.01em]"
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Шинэчлэх
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] bg-[#0F0B2E] rounded-lg border border-white/[0.08] overflow-hidden flex flex-col md:flex-row">
            {/* Left: Customer List */}
            <div className={`
                ${activeId ? 'hidden md:block' : 'block'} 
                w-full md:w-80 lg:w-96 border-r border-white/[0.08] h-full flex flex-col
            `}>
                <CustomerList
                    carts={carts}
                    activeId={activeId || undefined}
                    onSelect={handleSelect}
                />
            </div>

            {/* Right: Active Cart Details */}
            <div className={`
                ${activeId ? 'block' : 'hidden md:block'}
                flex-1 h-full flex flex-col min-w-0
            `}>
                {activeCart ? (
                    <div className="h-full flex flex-col">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center px-4 py-3 border-b border-white/[0.08]">
                            <button onClick={handleBack} className="mr-3 p-2 -ml-2 rounded-md hover:bg-[#0F0B2E] transition-colors">
                                <ArrowLeft className="w-5 h-5 text-white/40" strokeWidth={1.5} />
                            </button>
                            <div>
                                <h3 className="font-semibold text-foreground text-[14px] tracking-[-0.01em]">{activeCart.customer.name}</h3>
                                <p className="text-[11px] text-[#4A7CE7]">Total: {activeCart.totalAmount.toLocaleString()}₮</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8">
                            <div className="max-w-2xl mx-auto space-y-5">
                                <ActiveCartWidget
                                    customerName={activeCart.customer.name}
                                    items={activeCart.items}
                                    onConvertToOrder={handleConvertToOrder}
                                    onSendReminder={handleSendReminder}
                                    isLoading={isConverting || isReminding}
                                />

                                {/* Customer Info Card */}
                                <div className="bg-[#0F0B2E] rounded-lg border border-white/[0.08] p-5">
                                    <h4 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-4 flex items-center gap-2">
                                        <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
                                        Хэрэглэгчийн мэдээлэл
                                    </h4>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
                                        <div>
                                            <dt className="text-white/40 mb-1 tracking-[-0.01em]">Нэр</dt>
                                            <dd className="font-medium text-foreground tracking-[-0.01em]">{activeCart.customer.name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-white/40 mb-1 tracking-[-0.01em]">Facebook ID</dt>
                                            <dd className="font-mono text-[12px] text-white/50">{activeCart.customer.facebookId || 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-white/40 mb-1 tracking-[-0.01em]">Сүүлийн үйлдэл</dt>
                                            <dd className="text-foreground tracking-[-0.01em]">
                                                {activeCart.lastActive
                                                    ? new Date(activeCart.lastActive).toLocaleString()
                                                    : 'N/A'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-white/40 mb-1 tracking-[-0.01em]">VIP статус</dt>
                                            <dd>
                                                {activeCart.customer.isVip ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#4A7CE7]/10 text-[#4A7CE7]">
                                                        VIP Хэрэглэгч
                                                    </span>
                                                ) : (
                                                    <span className="text-white/40 text-[12px]">Энгийн</span>
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
                            <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-white/10" strokeWidth={1.5} />
                            <p className="text-[13px] text-white/40 tracking-[-0.01em]">Хэрэглэгч сонгож дэлгэрэнгүйг харна уу</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
