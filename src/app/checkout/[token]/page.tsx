'use client';

import './checkout.css';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ItemView {
    id: string;
    product_id: string;
    name: string;
    image: string | null;
    variant_specs: Record<string, string>;
    quantity: number;
    unit_price: number;
    subtotal: number;
    available_stock: number;
}

interface Summary {
    cartId: string;
    status: string;
    shopName: string;
    shopAddress: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    items: ItemView[];
    subtotal: number;
    deliveryFee: number;
    deliveryMethod: 'delivery' | 'pickup';
    total: number;
    hasDeliveryItems: boolean;
    needsDeliveryInfo: boolean;
}

interface CatalogVariant {
    id: string;
    name: string;
    price: number | null;
    stock: number;
}
interface CatalogProduct {
    id: string;
    name: string;
    price: number;
    image: string | null;
    discount_percent: number;
    available_stock: number;
    has_variants: boolean;
    variants: CatalogVariant[];
}

const fmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n);

export default function CheckoutPage() {
    const { token } = useParams<{ token: string }>();

    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ phone?: string; address?: string }>({});

    const [catalogOpen, setCatalogOpen] = useState(false);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const [confirming, setConfirming] = useState(false);
    const [doneMessage, setDoneMessage] = useState<string | null>(null);

    const applySummary = useCallback((s: Summary) => {
        setSummary(s);
        setPhone((prev) => prev || s.customerPhone || '');
        setAddress((prev) => prev || s.customerAddress || '');
    }, []);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await fetch(`/api/checkout/${token}`);
            if (!res.ok) throw new Error('not found');
            applySummary(await res.json());
        } catch {
            setError('Сагсны мэдээлэл олдсонгүй');
        } finally {
            setLoading(false);
        }
    }, [token, applySummary]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // Escape товчоор каталог модалыг хаана (a11y).
    useEffect(() => {
        if (!catalogOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setCatalogOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [catalogOpen]);

    const mutate = useCallback(
        async (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => {
            setBusy(true);
            setError(null);
            try {
                const res = await fetch(`/api/checkout/${token}/items${path}`, {
                    method,
                    headers: body ? { 'Content-Type': 'application/json' } : undefined,
                    body: body ? JSON.stringify(body) : undefined,
                });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error || 'Алдаа гарлаа');
                    return;
                }
                if (data.summary) applySummary(data.summary);
            } catch {
                setError('Сүлжээний алдаа');
            } finally {
                setBusy(false);
            }
        },
        [token, applySummary],
    );

    const setQty = (item: ItemView, qty: number) => mutate('PATCH', '', { item_id: item.id, quantity: qty });
    const removeItem = (item: ItemView) => mutate('DELETE', `?item_id=${item.id}`);

    const openCatalog = async () => {
        setCatalogOpen(true);
        setCatalogLoading(true);
        try {
            const res = await fetch(`/api/checkout/${token}/products`);
            const data = await res.json();
            setCatalog(data.products || []);
        } catch {
            setError('Бараа ачаалахад алдаа гарлаа');
        } finally {
            setCatalogLoading(false);
        }
    };

    const addProduct = async (p: CatalogProduct, variant?: CatalogVariant) => {
        await mutate('POST', '', {
            product_id: p.id,
            quantity: 1,
            variant_specs: variant ? { Сонголт: variant.name } : {},
        });
        setCatalogOpen(false);
    };

    const confirm = async () => {
        if (!summary) return;

        // Хүргэлттэй захиалгад утас/хаягийг урьдчилан шалгана — backend-ийн
        // 422-г хүлээлгүйгээр талбар бүр дээр алдааг шууд харуулна.
        const cleanPhone = phone.replace(/\s+/g, '');
        if (summary.hasDeliveryItems && summary.deliveryMethod === 'delivery') {
            const errs: { phone?: string; address?: string } = {};
            if (!/^\d{8}$/.test(cleanPhone)) {
                errs.phone = 'Утасны дугаараа 8 оронтой тоогоор оруулна уу';
            }
            if (!address.trim()) {
                errs.address = 'Хүргэх хаягаа оруулна уу';
            }
            if (errs.phone || errs.address) {
                setFieldErrors(errs);
                return;
            }
        }
        setFieldErrors({});

        setConfirming(true);
        setError(null);
        try {
            const res = await fetch(`/api/checkout/${token}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: cleanPhone, address, payment_type: 'qpay' }),
            });
            const data = await res.json();
            if (!res.ok) {
                // Backend-ийн structured 422 → талбар тус бүрийн алдаа
                if (data.needsDeliveryInfo) {
                    setFieldErrors({
                        ...(data.missingPhone
                            ? { phone: 'Утасны дугаараа оруулна уу' }
                            : {}),
                        ...(data.missingAddress
                            ? { address: 'Хүргэх хаягаа оруулна уу' }
                            : {}),
                    });
                    return;
                }
                setError(data.error || 'Төлбөр үүсгэхэд алдаа гарлаа');
                return;
            }
            if (data.paymentLink) {
                window.location.href = data.paymentLink;
                return;
            }
            // COD / bank — no online pay link
            setDoneMessage(
                data.paymentMethod === 'cod'
                    ? '✅ Захиалга баталгаажлаа! Хүргэлтийн ажилтан тантай холбогдоно.'
                    : '✅ Захиалга баталгаажлаа! Төлбөрийн мэдээллийг чатаар илгээнэ.',
            );
        } catch {
            setError('Сүлжээний алдаа');
        } finally {
            setConfirming(false);
        }
    };

    if (loading) {
        return (
            <div className="co-container">
                <div className="co-card"><div className="co-spinner" /><p>Ачаалж байна...</p></div>
            </div>
        );
    }

    if (error && !summary) {
        return (
            <div className="co-container">
                <div className="co-card">
                    <div className="co-error-icon">✕</div>
                    <h2>{error}</h2>
                    <button
                        className="co-pay-btn"
                        onClick={() => {
                            setError(null);
                            setLoading(true);
                            fetchSummary();
                        }}
                    >
                        Дахин оролдох
                    </button>
                </div>
            </div>
        );
    }

    if (doneMessage) {
        return (
            <div className="co-container">
                <div className="co-card"><div className="co-success-icon">✓</div><p className="co-done">{doneMessage}</p></div>
            </div>
        );
    }

    if (!summary) return null;

    const isCheckedOut = summary.status !== 'active';
    const empty = summary.items.length === 0;

    return (
        <div className="co-container">
            <div className="co-card">
                <div className="co-header">
                    <span className="co-shop">{summary.shopName}</span>
                    <span className="co-title">🛒 Захиалга шалгах</span>
                </div>

                {isCheckedOut && (
                    <div className="co-banner">Энэ сагс аль хэдийн захиалга болсон байна.</div>
                )}

                {/* Items */}
                <div className="co-items">
                    {empty && <p className="co-empty">Сагс хоосон байна. Доорх товчоор бараа нэмнэ үү.</p>}
                    {summary.items.map((item) => (
                        <div key={item.id} className="co-item">
                            <div className="co-item-img">
                                {item.image ? <img src={item.image} alt={item.name} /> : <div className="co-ph">📦</div>}
                            </div>
                            <div className="co-item-main">
                                <span className="co-item-name">{item.name}</span>
                                {Object.keys(item.variant_specs).length > 0 && (
                                    <span className="co-item-variant">{Object.values(item.variant_specs).join(' / ')}</span>
                                )}
                                <span className="co-item-price">₮{fmt(item.unit_price)}</span>
                            </div>
                            <div className="co-item-actions">
                                <div className="co-qty">
                                    <button disabled={busy || isCheckedOut} onClick={() => setQty(item, item.quantity - 1)}>−</button>
                                    <span>{item.quantity}</span>
                                    <button
                                        disabled={busy || isCheckedOut || item.quantity >= item.available_stock}
                                        onClick={() => setQty(item, item.quantity + 1)}
                                    >＋</button>
                                </div>
                                <button className="co-remove" disabled={busy || isCheckedOut} onClick={() => removeItem(item)}>Устгах</button>
                            </div>
                        </div>
                    ))}
                </div>

                {!isCheckedOut && (
                    <button className="co-add-btn" disabled={busy} onClick={openCatalog}>＋ Бараа нэмэх</button>
                )}

                {/* Breakdown */}
                <div className="co-breakdown">
                    <div className="co-row"><span>Барааны дүн</span><span>₮{fmt(summary.subtotal)}</span></div>
                    <div className="co-row">
                        <span>Хүргэлт</span>
                        <span>
                            {summary.deliveryMethod === 'pickup'
                                ? 'Очиж авах'
                                : summary.deliveryFee > 0
                                    ? `₮${fmt(summary.deliveryFee)}`
                                    : 'Үнэгүй'}
                        </span>
                    </div>
                    <div className="co-total"><span>Нийт дүн</span><span>₮{fmt(summary.total)}</span></div>
                </div>

                {/* Delivery info */}
                {summary.hasDeliveryItems && summary.deliveryMethod === 'delivery' && (
                    <div className="co-form">
                        <p className="co-form-title">📦 Хүргэлтийн мэдээлэл</p>
                        <div className="co-field">
                            <label className="co-label" htmlFor="co-phone">
                                Утасны дугаар <span className="co-required">*</span>
                            </label>
                            <input
                                id="co-phone"
                                className="co-input"
                                placeholder="📱 Жишээ: 99112233"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                                }}
                                inputMode="tel"
                                required
                                aria-invalid={!!fieldErrors.phone}
                            />
                            {fieldErrors.phone && <p className="co-field-error">{fieldErrors.phone}</p>}
                        </div>
                        <div className="co-field">
                            <label className="co-label" htmlFor="co-address">
                                Хүргэх хаяг <span className="co-required">*</span>
                            </label>
                            <input
                                id="co-address"
                                className="co-input"
                                placeholder="📍 Дүүрэг, хороо, байр, тоот"
                                value={address}
                                onChange={(e) => {
                                    setAddress(e.target.value);
                                    setFieldErrors((prev) => ({ ...prev, address: undefined }));
                                }}
                                required
                                aria-invalid={!!fieldErrors.address}
                            />
                            {fieldErrors.address && <p className="co-field-error">{fieldErrors.address}</p>}
                        </div>
                    </div>
                )}

                {error && <p className="co-error-text">{error}</p>}

                {!isCheckedOut && (
                    <button className="co-pay-btn" disabled={empty || confirming || busy} onClick={confirm}>
                        {confirming ? 'Боловсруулж байна...' : `Төлбөр төлөх · ₮${fmt(summary.total)}`}
                    </button>
                )}
            </div>

            {/* Catalog modal */}
            {catalogOpen && (
                <div className="co-modal" onClick={() => setCatalogOpen(false)}>
                    <div
                        className="co-modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Бараа сонгох"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="co-modal-head">
                            <span>Бараа сонгох</span>
                            <button onClick={() => setCatalogOpen(false)}>✕</button>
                        </div>
                        <div className="co-modal-body">
                            {catalogLoading && <p className="co-empty">Ачаалж байна...</p>}
                            {!catalogLoading && catalog.length === 0 && <p className="co-empty">Бараа алга.</p>}
                            {catalog.map((p) => (
                                <div key={p.id} className="co-cat-item">
                                    <div className="co-item-img">
                                        {p.image ? <img src={p.image} alt={p.name} /> : <div className="co-ph">📦</div>}
                                    </div>
                                    <div className="co-item-main">
                                        <span className="co-item-name">{p.name}</span>
                                        <span className="co-item-price">₮{fmt(p.price)}</span>
                                        {p.has_variants && p.variants.length > 0 && (
                                            <div className="co-variants">
                                                {p.variants.map((v) => (
                                                    <button key={v.id} disabled={busy || v.stock <= 0} onClick={() => addProduct(p, v)}>
                                                        {v.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {!(p.has_variants && p.variants.length > 0) && (
                                        <button className="co-cat-add" disabled={busy || p.available_stock <= 0} onClick={() => addProduct(p)}>
                                            {p.available_stock <= 0 ? 'Дууссан' : '＋'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
