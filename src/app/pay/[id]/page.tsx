'use client';

import './pay.css';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface BankInfo {
    name: string;
    description: string;
    logo: string;
    link: string;
}

interface OrderItem {
    id: string;
    name: string;
    image: string | null;
    quantity: number;
    unitPrice: number;
    variantSpecs: Record<string, string>;
}

interface PaymentData {
    id: string;
    amount: number;
    status: 'pending' | 'paid' | 'expired' | 'failed';
    shopName: string;
    shopLogo: string | null;
    paymentType: string;
    planSlug: string | null;
    orderItems: OrderItem[];
    deliveryFee: number;
    deliveryMethod: 'delivery' | 'pickup' | null;
    banks: BankInfo[];
    qrImage: string | null;
    expiresAt: string | null;
    createdAt: string;
}

export default function PaymentPage() {
    const params = useParams();
    const id = params.id as string;
    const [payment, setPayment] = useState<PaymentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    // Client-side countdown hit zero — hide pay UI immediately without
    // waiting for the backend status flip.
    const [clientExpired, setClientExpired] = useState(false);
    // Consecutive poll failures — used to show a subtle reconnect hint.
    // Once a payment is loaded, transient poll errors must NEVER replace
    // the active payment screen (double-payment risk).
    const [pollFailures, setPollFailures] = useState(0);

    // Initial load only. Poll errors are handled separately below.
    const fetchPayment = useCallback(async () => {
        try {
            const res = await fetch(`/api/pay/${id}`);
            if (!res.ok) throw new Error('Payment not found');
            const data = await res.json();
            setPayment(data);
        } catch {
            setError('Төлбөрийн мэдээлэл олдсонгүй');
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Initial fetch
    useEffect(() => {
        fetchPayment();
    }, [fetchPayment]);

    // Poll for payment status while pending. Resilient version:
    //  - poll errors keep the last good state (no fatal error)
    //  - exponential-ish backoff on consecutive failures
    //  - skips fetching while the tab is hidden, resumes on focus
    //  - stops once the status is terminal (paid/expired/failed)
    useEffect(() => {
        if (!payment || payment.status !== 'pending') return;

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let failures = 0;
        const BASE_MS = 5000;

        const schedule = () => {
            if (cancelled) return;
            // 5s → 10s → 20s → 40s (capped) while errors persist
            const delay = BASE_MS * Math.min(2 ** failures, 8);
            timeoutId = setTimeout(tick, delay);
        };

        const tick = async () => {
            if (cancelled) return;
            // Don't burn requests in a background tab — visibilitychange
            // below re-checks immediately when the user comes back.
            if (document.hidden) {
                schedule();
                return;
            }
            try {
                const res = await fetch(`/api/pay/${id}`);
                if (!res.ok) throw new Error('poll failed');
                const data: PaymentData = await res.json();
                if (cancelled) return;
                failures = 0;
                setPollFailures(0);
                setPayment(data);
                if (data.status !== 'pending') return; // terminal — stop polling
            } catch {
                if (cancelled) return;
                failures += 1;
                setPollFailures(failures);
            }
            schedule();
        };

        const onVisibility = () => {
            if (!document.hidden && !cancelled) {
                if (timeoutId) clearTimeout(timeoutId);
                tick();
            }
        };

        document.addEventListener('visibilitychange', onVisibility);
        schedule();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [payment, id]);

    // Countdown timer
    useEffect(() => {
        if (!payment?.expiresAt || payment.status !== 'pending') return;

        const tick = () => {
            const now = new Date().getTime();
            const exp = new Date(payment.expiresAt!).getTime();
            const diff = exp - now;

            if (diff <= 0) {
                setTimeLeft('Хугацаа дууссан');
                setClientExpired(true);
                return;
            }

            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${min}:${sec.toString().padStart(2, '0')}`);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [payment]);

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('mn-MN').format(amount);
    };

    // ── Loading ──
    if (loading) {
        return (
            <div className="pay-container">
                <div className="pay-card">
                    <div className="pay-loading">
                        <div className="pay-spinner" />
                        <p>Ачаалж байна...</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Error ──
    if (error || !payment) {
        return (
            <div className="pay-container">
                <div className="pay-card">
                    <div className="pay-status-icon pay-error-icon">✕</div>
                    <h2>{error || 'Алдаа гарлаа'}</h2>
                    <p className="pay-subtitle">Линк буруу эсвэл хугацаа дууссан байна</p>
                </div>
            </div>
        );
    }

    // ── Paid ──
    if (payment.status === 'paid') {
        const handleBackToChat = () => {
            // Try MessengerExtensions SDK first (works in Messenger WebView)
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const MessengerExtensions = (window as any).MessengerExtensions;
                if (MessengerExtensions?.requestCloseBrowser) {
                    MessengerExtensions.requestCloseBrowser(
                        () => { /* success */ },
                        () => { window.close(); } // fallback
                    );
                    return;
                }
            } catch { /* not in Messenger WebView */ }

            // Fallback: try window.close (works for popup windows)
            try {
                window.close();
            } catch { /* ignore */ }

            // If nothing worked, show hint to tap "Done" 
            const hint = document.getElementById('close-hint');
            if (hint) hint.style.display = 'block';
        };

        return (
            <div className="pay-container">
                <div className="pay-card">
                    <div className="pay-status-icon pay-success-icon">✓</div>
                    <h2>Төлбөр амжилттай!</h2>
                    <p className="pay-subtitle">{payment.shopName}</p>
                    <div className="pay-amount-display">
                        <span className="pay-currency">₮</span>
                        <span className="pay-amount-value">{formatAmount(payment.amount)}</span>
                    </div>
                    {/* Show ordered items on success */}
                    {payment.orderItems && payment.orderItems.length > 0 && (
                        <div className="pay-cart-summary pay-cart-success">
                            <div className="pay-cart-header">
                                <span className="pay-cart-title">📦 {payment.orderItems.length} бараа</span>
                            </div>
                            <div className="pay-cart-items">
                                {payment.orderItems.map((item) => (
                                    <div key={item.id} className="pay-cart-item">
                                        <div className="pay-cart-item-image">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} />
                                            ) : (
                                                <div className="pay-cart-item-placeholder">📦</div>
                                            )}
                                        </div>
                                        <div className="pay-cart-item-info">
                                            <span className="pay-cart-item-name">{item.name}</span>
                                            {Object.keys(item.variantSpecs).length > 0 && (
                                                <span className="pay-cart-item-variant">
                                                    {Object.values(item.variantSpecs).join(' / ')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="pay-cart-item-right">
                                            <span className="pay-cart-item-qty">{item.quantity}ш</span>
                                            <span className="pay-cart-item-price">₮{formatAmount(item.unitPrice * item.quantity)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="pay-success-msg">Баярлалаа! Таны төлбөр хүлээн авлаа.</p>
                    <p className="pay-chat-hint">💬 Баталгаажуулалт чатруу илгээгдсэн</p>

                    {/* Back to chat button */}
                    <button 
                        className="pay-back-btn"
                        onClick={handleBackToChat}
                    >
                        💬 Чатруу буцах
                    </button>
                    <p id="close-hint" className="pay-close-hint" style={{ display: 'none' }}>
                        Дээд талын <strong>&quot;Done&quot;</strong> товч дарж хаана уу
                    </p>
                </div>
            </div>
        );
    }

    // ── Failed ──
    if (payment.status === 'failed') {
        return (
            <div className="pay-container">
                <div className="pay-card">
                    <div className="pay-status-icon pay-error-icon">✕</div>
                    <h2>Төлбөр амжилтгүй боллоо</h2>
                    <p className="pay-subtitle">
                        Төлбөр баталгаажсангүй. Хэрэв данснаас тань мөнгө хасагдсан бол бидэнтэй холбогдоно уу.
                    </p>
                    {payment.paymentType === 'subscription' ? (
                        <a
                            href="/dashboard/subscription"
                            className="pay-back-btn"
                            style={{ textAlign: 'center', textDecoration: 'none' }}
                        >
                            Багц сонгох хуудас руу буцах
                        </a>
                    ) : (
                        <p className="pay-chat-hint">💬 Чат руугаа буцаж шинэ төлбөрийн линк аваад дахин оролдоно уу</p>
                    )}
                </div>
            </div>
        );
    }

    // ── Expired ──
    // Backend says expired, or the client countdown hit zero — either way
    // hide the bank buttons / QR immediately so a late payment can't be made.
    if (payment.status === 'expired' || clientExpired) {
        return (
            <div className="pay-container">
                <div className="pay-card">
                    <div className="pay-status-icon pay-expired-icon">⏱</div>
                    <h2>Хугацаа дууссан</h2>
                    <p className="pay-subtitle">Энэ нэхэмжлэлийн хугацаа дууссан байна.</p>
                    {payment.paymentType === 'subscription' ? (
                        <a
                            href="/dashboard/subscription"
                            className="pay-back-btn"
                            style={{ textAlign: 'center', textDecoration: 'none' }}
                        >
                            Багц сонгох хуудас руу буцах
                        </a>
                    ) : (
                        <p className="pay-chat-hint">💬 Чат руугаа буцаж шинэ төлбөрийн линк авна уу</p>
                    )}
                </div>
            </div>
        );
    }

    // ── Pending — Main Payment UI ──
    return (
        <div className="pay-container">
            <div className="pay-card">
                {/* Header */}
                <div className="pay-header">
                    <div className="pay-shop-info">
                        {payment.shopLogo ? (
                            <img src={payment.shopLogo} alt="" className="pay-shop-logo" />
                        ) : (
                            <div className="pay-shop-logo-placeholder">
                                {payment.shopName.charAt(0)}
                            </div>
                        )}
                        <span className="pay-shop-name">{payment.shopName}</span>
                    </div>
                    {timeLeft && (
                        <div className="pay-timer">
                            <span className="pay-timer-icon">⏱</span>
                            <span>{timeLeft}</span>
                        </div>
                    )}
                </div>

                {/* Amount */}
                <div className="pay-amount-section">
                    <p className="pay-label">Төлөх дүн</p>
                    <div className="pay-amount-display">
                        <span className="pay-currency">₮</span>
                        <span className="pay-amount-value">{formatAmount(payment.amount)}</span>
                    </div>
                    {payment.paymentType === 'subscription' && payment.planSlug && (
                        <p className="pay-plan-badge">{payment.planSlug.toUpperCase()} план</p>
                    )}
                </div>

                {/* ── Cart Summary (Order Items) ── */}
                {payment.orderItems && payment.orderItems.length > 0 && (
                    <details className="pay-cart-summary" open>
                        <summary className="pay-cart-header">
                            <span className="pay-cart-title">📦 Таны захиалга ({payment.orderItems.length} бараа)</span>
                            <span className="pay-cart-chevron">▾</span>
                        </summary>
                        <div className="pay-cart-items">
                            {payment.orderItems.map((item) => (
                                <div key={item.id} className="pay-cart-item">
                                    <div className="pay-cart-item-image">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} />
                                        ) : (
                                            <div className="pay-cart-item-placeholder">📦</div>
                                        )}
                                    </div>
                                    <div className="pay-cart-item-info">
                                        <span className="pay-cart-item-name">{item.name}</span>
                                        {Object.keys(item.variantSpecs).length > 0 && (
                                            <span className="pay-cart-item-variant">
                                                {Object.values(item.variantSpecs).join(' / ')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="pay-cart-item-right">
                                        <span className="pay-cart-item-qty">{item.quantity}ш</span>
                                        <span className="pay-cart-item-price">₮{formatAmount(item.unitPrice * item.quantity)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pay-cart-breakdown">
                            {(() => {
                                // Derive delivery from the charged total so the breakdown always
                                // reconciles (subtotal + delivery = total), even for orders where
                                // a shop delivery-policy fee was applied but not persisted to
                                // orders.delivery_fee.
                                const subtotal = payment.orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
                                const delivery = Math.max(0, payment.amount - subtotal);
                                return (
                                    <>
                                        <div className="pay-cart-row">
                                            <span>Барааны дүн</span>
                                            <span>₮{formatAmount(subtotal)}</span>
                                        </div>
                                        <div className="pay-cart-row">
                                            <span>Хүргэлт</span>
                                            <span>
                                                {payment.deliveryMethod === 'pickup' && delivery === 0
                                                    ? 'Очиж авах'
                                                    : delivery > 0
                                                        ? `₮${formatAmount(delivery)}`
                                                        : 'Үнэгүй'}
                                            </span>
                                        </div>
                                        <div className="pay-cart-total">
                                            <span>Нийт дүн</span>
                                            <span>₮{formatAmount(payment.amount)}</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </details>
                )}

                {/* Divider */}
                <div className="pay-divider" />

                {/* Bank App Buttons */}
                <p className="pay-section-title">Банкны аппаа сонгоно уу</p>

                <div className="pay-banks-grid">
                    {payment.banks.map((bank, i) => (
                        <a
                            key={i}
                            href={bank.link}
                            className="pay-bank-btn"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <img
                                src={bank.logo}
                                alt={bank.name}
                                className="pay-bank-logo"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent && !parent.querySelector('.pay-bank-fallback')) {
                                        const fallback = document.createElement('div');
                                        fallback.className = 'pay-bank-fallback';
                                        fallback.textContent = bank.name.charAt(0);
                                        parent.insertBefore(fallback, parent.firstChild);
                                    }
                                }}
                            />
                            <span className="pay-bank-name">{bank.name}</span>
                        </a>
                    ))}
                </div>

                {/* QR Code fallback (desktop) */}
                {payment.qrImage && (
                    <details className="pay-qr-section" open>
                        <summary className="pay-qr-toggle">QR код харуулах</summary>
                        <div className="pay-qr-wrapper">
                            <img 
                                src={payment.qrImage.startsWith('data:') ? payment.qrImage : `data:image/png;base64,${payment.qrImage}`} 
                                alt="QR Code" 
                                className="pay-qr-image" 
                            />
                        </div>
                    </details>
                )}

                {/* Footer */}
                <div className="pay-footer">
                    <p>Төлбөр хийгдсэний дараа энэ хуудас автоматаар шинэчлэгдэнэ</p>
                    {pollFailures >= 3 && (
                        <p style={{ color: 'rgba(255, 171, 64, 0.8)' }}>
                            Холболт сэргээж байна...
                        </p>
                    )}
                    <div className="pay-polling-dot" />
                </div>
            </div>
        </div>
    );
}

