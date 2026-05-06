'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Loader2, Copy, ExternalLink, Plus, Minus, X, Search, Package } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/Modal';

interface QPayInvoiceModalProps {
    open: boolean;
    onClose: () => void;
    customerId: string;
}

interface InvoiceResult {
    qr_text: string;
    qr_image: string;
    urls: Array<{ name?: string; link: string }>;
    sentToCustomer: boolean;
    expires_at: string;
}

interface Product {
    id: string;
    name: string;
    price: number;
}

interface SelectedItem {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
}

export function QPayInvoiceModal({ open, onClose, customerId }: QPayInvoiceModalProps) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [sendToCustomer, setSendToCustomer] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<InvoiceResult | null>(null);

    // Product picker state
    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoaded, setProductsLoaded] = useState(false);
    const [productsLoading, setProductsLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [productQuery, setProductQuery] = useState('');
    const [items, setItems] = useState<SelectedItem[]>([]);
    const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);

    const itemsTotal = useMemo(
        () => items.reduce((sum, it) => sum + it.price * it.quantity, 0),
        [items]
    );

    // Lazy-load products the first time the picker opens
    useEffect(() => {
        if (!showPicker || productsLoaded || productsLoading) return;
        setProductsLoading(true);
        fetch('/api/dashboard/products')
            .then((r) => r.json())
            .then((data) => {
                const list: Product[] = (data?.products || []).map((p: { id: string; name: string; price: number | string }) => ({
                    id: p.id,
                    name: p.name,
                    price: Number(p.price) || 0,
                }));
                setProducts(list);
                setProductsLoaded(true);
            })
            .catch(() => toast.error('Бараа татахад алдаа'))
            .finally(() => setProductsLoading(false));
    }, [showPicker, productsLoaded, productsLoading]);

    // Auto-sync amount with items total unless the operator explicitly edited it.
    useEffect(() => {
        if (amountManuallyEdited) return;
        if (items.length === 0) return;
        setAmount(String(itemsTotal));
    }, [itemsTotal, items.length, amountManuallyEdited]);

    const filteredProducts = useMemo(() => {
        const q = productQuery.trim().toLowerCase();
        if (!q) return products.slice(0, 30);
        return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
    }, [products, productQuery]);

    const addProduct = (p: Product) => {
        setItems((prev) => {
            const existing = prev.find((it) => it.product_id === p.id);
            if (existing) {
                return prev.map((it) =>
                    it.product_id === p.id ? { ...it, quantity: it.quantity + 1 } : it
                );
            }
            return [...prev, { product_id: p.id, name: p.name, price: p.price, quantity: 1 }];
        });
        setProductQuery('');
    };

    const updateItemQty = (productId: string, delta: number) => {
        setItems((prev) =>
            prev
                .map((it) =>
                    it.product_id === productId
                        ? { ...it, quantity: Math.max(0, it.quantity + delta) }
                        : it
                )
                .filter((it) => it.quantity > 0)
        );
    };

    const removeItem = (productId: string) => {
        setItems((prev) => prev.filter((it) => it.product_id !== productId));
    };

    const handleClose = () => {
        if (submitting) return;
        setAmount('');
        setDescription('');
        setSendToCustomer(true);
        setResult(null);
        setItems([]);
        setShowPicker(false);
        setProductQuery('');
        setAmountManuallyEdited(false);
        onClose();
    };

    const handleSubmit = async () => {
        const amt = Number(amount.replace(/[\s,]/g, ''));
        if ((!Number.isFinite(amt) || amt <= 0) && items.length === 0) {
            toast.error('Дүнг оруулна уу эсвэл бараа нэмнэ үү.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/dashboard/conversations/${customerId}/qpay-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Send amount only when the operator overrode the auto-sum
                    // (or when no items exist). Otherwise let the server use
                    // the items total.
                    amount: items.length === 0 || amountManuallyEdited ? amt : undefined,
                    description: description.trim() || undefined,
                    sendToCustomer,
                    items: items.length > 0
                        ? items.map((it) => ({ product_id: it.product_id, quantity: it.quantity }))
                        : undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data?.error || 'Invoice үүсгэхэд алдаа гарлаа');
                return;
            }

            setResult({
                qr_text: data.qr_text,
                qr_image: data.qr_image,
                urls: data.urls || [],
                sentToCustomer: data.sentToCustomer,
                expires_at: data.expires_at,
            });

            if (data.sentToCustomer) {
                toast.success('Хэрэглэгч рүү QPay линк илгээгдлээ');
            } else if (sendToCustomer) {
                toast.warning('Invoice үүслээ, гэхдээ хэрэглэгч рүү илгээх боломжгүй байсан тул гараар хуулна уу.');
            } else {
                toast.success('Invoice үүсгэгдлээ');
            }
        } catch {
            toast.error('Сүлжээний алдаа');
        } finally {
            setSubmitting(false);
        }
    };

    const copyLink = async (link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Хууллаа');
        } catch {
            toast.error('Хуулж чадсангүй');
        }
    };

    return (
        <Modal open={open} onOpenChange={(v) => !v && handleClose()}>
            <ModalContent
                size="md"
                title="QPay invoice үүсгэх"
                description="Хэрэглэгчээс гар QPay төлбөр авах"
            >
                {!result ? (
                    <div className="space-y-4">
                        {/* Product picker */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12px] font-medium text-foreground/80">
                                    Бараа{items.length > 0 && (
                                        <span className="ml-2 text-white/45">({items.length})</span>
                                    )}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowPicker((v) => !v)}
                                    disabled={submitting}
                                    className="inline-flex items-center gap-1 text-[12px] text-[var(--brand-indigo-400)] hover:text-[var(--brand-indigo-300)] transition-colors disabled:opacity-50"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {showPicker ? 'Хаах' : 'Бараа нэмэх'}
                                </button>
                            </div>

                            {/* Selected items list */}
                            {items.length > 0 && (
                                <ul className="space-y-1.5 mb-2 max-h-44 overflow-y-auto rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                                    {items.map((it) => (
                                        <li
                                            key={it.product_id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04]"
                                        >
                                            <Package className="w-3.5 h-3.5 text-white/40 shrink-0" strokeWidth={1.5} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] text-foreground/90 truncate">{it.name}</p>
                                                <p className="text-[11px] text-white/45">
                                                    {it.price.toLocaleString('mn-MN')}₮ × {it.quantity} ={' '}
                                                    <span className="text-foreground/70">
                                                        {(it.price * it.quantity).toLocaleString('mn-MN')}₮
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => updateItemQty(it.product_id, -1)}
                                                    disabled={submitting}
                                                    className="p-1 rounded hover:bg-white/[0.08] text-white/60 disabled:opacity-50"
                                                    aria-label="Хасах"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="text-[12px] text-foreground/80 min-w-[1.5rem] text-center">
                                                    {it.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateItemQty(it.product_id, 1)}
                                                    disabled={submitting}
                                                    className="p-1 rounded hover:bg-white/[0.08] text-white/60 disabled:opacity-50"
                                                    aria-label="Нэмэх"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(it.product_id)}
                                                    disabled={submitting}
                                                    className="p-1 rounded hover:bg-white/[0.08] text-white/60 disabled:opacity-50 ml-1"
                                                    aria-label="Устгах"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                    <li className="flex justify-between items-center px-2 pt-1.5 border-t border-white/[0.06] text-[12px]">
                                        <span className="text-white/60">Нийт</span>
                                        <span className="text-foreground font-medium">
                                            {itemsTotal.toLocaleString('mn-MN')}₮
                                        </span>
                                    </li>
                                </ul>
                            )}

                            {/* Picker dropdown */}
                            {showPicker && (
                                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                                    <div className="relative mb-2">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                                        <input
                                            type="text"
                                            value={productQuery}
                                            onChange={(e) => setProductQuery(e.target.value)}
                                            placeholder="Бараа хайх..."
                                            disabled={submitting}
                                            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-[12px] text-foreground placeholder:text-white/30 focus:border-[var(--border-accent)] outline-none disabled:opacity-50"
                                        />
                                    </div>
                                    {productsLoading ? (
                                        <div className="py-6 flex justify-center text-white/40">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        </div>
                                    ) : filteredProducts.length === 0 ? (
                                        <p className="py-4 text-center text-[11px] text-white/45">
                                            {productsLoaded
                                                ? productQuery
                                                    ? 'Тохирох бараа олдсонгүй'
                                                    : 'Бараа байхгүй'
                                                : ''}
                                        </p>
                                    ) : (
                                        <ul className="max-h-44 overflow-y-auto">
                                            {filteredProducts.map((p) => (
                                                <li key={p.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => addProduct(p)}
                                                        disabled={submitting}
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.06] text-left transition-colors disabled:opacity-50"
                                                    >
                                                        <Package className="w-3.5 h-3.5 text-white/40 shrink-0" strokeWidth={1.5} />
                                                        <span className="flex-1 text-[12px] text-foreground/85 truncate">
                                                            {p.name}
                                                        </span>
                                                        <span className="text-[11px] text-white/55 shrink-0">
                                                            {p.price.toLocaleString('mn-MN')}₮
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[12px] font-medium text-foreground/80 mb-1.5">
                                Дүн (₮){items.length > 0 && !amountManuallyEdited && (
                                    <span className="ml-2 text-[11px] text-white/45 font-normal">
                                        автомат тооцсон
                                    </span>
                                )}
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value);
                                    if (items.length > 0) setAmountManuallyEdited(true);
                                }}
                                placeholder="50000"
                                disabled={submitting}
                                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-foreground placeholder:text-white/30 focus:border-[var(--border-accent)] focus:bg-white/[0.05] outline-none transition-colors disabled:opacity-50"
                            />
                            {items.length > 0 && amountManuallyEdited && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAmount(String(itemsTotal));
                                        setAmountManuallyEdited(false);
                                    }}
                                    className="mt-1 text-[11px] text-[var(--brand-indigo-400)] hover:text-[var(--brand-indigo-300)]"
                                >
                                    ↺ Барааны нийтэд буцах ({itemsTotal.toLocaleString('mn-MN')}₮)
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-[12px] font-medium text-foreground/80 mb-1.5">
                                Тайлбар (заавал биш)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={items.length > 0
                                    ? 'Хоосон бол барааны нэрс автомат орно'
                                    : 'Жишээ: Захиалга №123 - 2 ширхэг'}
                                rows={2}
                                disabled={submitting}
                                maxLength={100}
                                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-[13px] text-foreground placeholder:text-white/30 focus:border-[var(--border-accent)] focus:bg-white/[0.05] outline-none transition-colors resize-none disabled:opacity-50"
                            />
                        </div>

                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={sendToCustomer}
                                onChange={(e) => setSendToCustomer(e.target.checked)}
                                disabled={submitting}
                                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.03] text-[var(--brand-indigo)] focus:ring-2 focus:ring-[var(--brand-indigo)]/30"
                            />
                            <span className="text-[13px] text-foreground/85">
                                Хэрэглэгч рүү автоматаар QPay линк илгээх
                            </span>
                        </label>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-[13px] text-foreground transition-colors disabled:opacity-50"
                            >
                                Болих
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                style={{
                                    background: 'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                                    boxShadow: 'var(--shadow-cta-indigo)',
                                }}
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Invoice үүсгэх
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {result.qr_image ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="rounded-lg bg-white p-3 inline-block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={result.qr_image.startsWith('data:') ? result.qr_image : `data:image/png;base64,${result.qr_image}`}
                                        alt="QPay QR"
                                        className="w-44 h-44"
                                    />
                                </div>
                                <p className="text-[11px] text-white/50">QR кодыг скан хийж төлнө</p>
                            </div>
                        ) : null}

                        {result.urls.length > 0 && (
                            <div>
                                <p className="text-[11px] font-medium text-white/60 mb-2 uppercase tracking-wider">
                                    Банкны линкүүд
                                </p>
                                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {result.urls.map((u, i) => (
                                        <li key={i} className="flex items-center gap-2 text-[12px]">
                                            <span className="flex-1 text-foreground/80 truncate">{u.name || 'Банк'}</span>
                                            <button
                                                type="button"
                                                onClick={() => copyLink(u.link)}
                                                className="p-1.5 rounded hover:bg-white/[0.06] text-white/60 hover:text-white"
                                                aria-label="Хуулах"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <a
                                                href={u.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded hover:bg-white/[0.06] text-white/60 hover:text-white"
                                                aria-label="Нээх"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {!result.sentToCustomer && (
                            <p className="text-[12px] text-amber-300/80">
                                Хэрэглэгч рүү автомат илгээгдээгүй. Линкийг хуулж чатанд тавьна уу.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-[13px] text-foreground transition-colors"
                        >
                            Хаах
                        </button>
                    </div>
                )}
            </ModalContent>
        </Modal>
    );
}
