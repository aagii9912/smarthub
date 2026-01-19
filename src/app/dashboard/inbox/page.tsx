'use client';

import React, { useState } from 'react';
import { CustomerList } from '@/components/dashboard/CustomerList';
import { ActiveCartWidget } from '@/components/dashboard/ActiveCartWidget';
import { useActiveCarts } from '@/hooks/useActiveCarts';
import { toast } from 'sonner';
import { ShoppingCart, Loader2, ArrowLeft, Info, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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

            // Refresh list and clear selection if needed
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

    // Set first cart as active when data loads (desktop only)
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
            <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-white md:rounded-3xl md:border md:border-gray-100">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Ачаалж байна...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="flex flex-col h-[calc(100vh-140px)] items-center justify-center bg-white md:rounded-3xl md:border md:border-gray-100">
                <div className="text-center text-red-500 px-4 mb-4">
                    <p>Алдаа гарлаа: {(error as Error).message}</p>
                </div>
                <Button onClick={() => refetch()} variant="outline" size="sm">
                    <RefreshCcw className="w-4 h-4 mr-2" /> Дахин ачаалах
                </Button>
            </div>
        );
    }

    // Empty State
    if (carts.length === 0) {
        return (
            <div className="flex flex-col h-[calc(100vh-140px)] items-center justify-center bg-white md:rounded-3xl md:border md:border-gray-100">
                <div className="text-center px-6">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShoppingCart className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Идэвхтэй сагс байхгүй</h3>
                    <p className="text-sm text-gray-500 max-w-sm mb-6">
                        Одоогоор ямар нэгэн хэрэглэгч бараа сонирхоогүй байна.
                    </p>
                    <Button onClick={() => refetch()} variant="outline">
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Шинэчлэх
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] bg-white rounded-none md:rounded-3xl md:border md:border-gray-100 overflow-hidden shadow-sm flex flex-col md:flex-row">

            {/* Left: Customer List */}
            <div className={`
                ${activeId ? 'hidden md:block' : 'block'} 
                w-full md:w-80 lg:w-96 border-r border-gray-100 h-full flex flex-col bg-white
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
                flex-1 h-full bg-gray-50/30 flex flex-col min-w-0
            `}>
                {activeCart ? (
                    <div className="h-full flex flex-col">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center px-4 py-3 bg-white border-b border-gray-100">
                            <button onClick={handleBack} className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h3 className="font-bold text-gray-900">{activeCart.customer.name}</h3>
                                <p className="text-xs text-violet-600">Total: {activeCart.totalAmount.toLocaleString()}₮</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8">
                            <div className="max-w-2xl mx-auto space-y-6">
                                <ActiveCartWidget
                                    customerName={activeCart.customer.name}
                                    items={activeCart.items}
                                    onConvertToOrder={handleConvertToOrder}
                                    onSendReminder={handleSendReminder}
                                    isLoading={isConverting || isReminding}
                                />

                                {/* Customer Info Card */}
                                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Info className="w-4 h-4 text-gray-400" />
                                        Хэрэглэгчийн мэдээлэл
                                    </h4>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                        <div>
                                            <dt className="text-gray-500 mb-1">Нэр</dt>
                                            <dd className="font-medium text-gray-900">{activeCart.customer.name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 mb-1">Facebook ID</dt>
                                            <dd className="font-mono text-gray-600 text-xs">{activeCart.customer.facebookId || 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 mb-1">Сүүлийн үйлдэл</dt>
                                            <dd className="text-gray-900">
                                                {new Date(activeCart.lastActive).toLocaleString()}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 mb-1">VIP статус</dt>
                                            <dd>
                                                {activeCart.customer.isVip ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        VIP Хэрэглэгч
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-xs">Энгийн</span>
                                                )}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                            <p>Хэрэглэгч сонгож дэлгэрэнгүйг харна уу</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
