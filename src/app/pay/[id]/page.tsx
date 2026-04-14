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

interface PaymentData {
    id: string;
    amount: number;
    status: 'pending' | 'paid' | 'expired';
    shopName: string;
    shopLogo: string | null;
    paymentType: string;
    planSlug: string | null;
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

    const fetchPayment = useCallback(async () => {
        try {
            const res = await fetch(`/api/pay/${id}`);
            if (!res.ok) throw new Error('Payment not found');
            const data = await res.json();
            setPayment(data);
            if (data.status === 'paid') setLoading(false);
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

    // Poll for payment status every 5s
    useEffect(() => {
        if (!payment || payment.status !== 'pending') return;
        const interval = setInterval(fetchPayment, 5000);
        return () => clearInterval(interval);
    }, [payment, fetchPayment]);

    // Countdown timer
    useEffect(() => {
        if (!payment?.expiresAt || payment.status !== 'pending') return;

        const tick = () => {
            const now = new Date().getTime();
            const exp = new Date(payment.expiresAt!).getTime();
            const diff = exp - now;

            if (diff <= 0) {
                setTimeLeft('Хугацаа дууссан');
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
                    <p className="pay-success-msg">Баярлалаа! Таны төлбөр хүлээн авлаа.</p>
                </div>
            </div>
        );
    }

    // ── Expired ──
    if (payment.status === 'expired') {
        return (
            <div className="pay-container">
                <div className="pay-card">
                    <div className="pay-status-icon pay-expired-icon">⏱</div>
                    <h2>Хугацаа дууссан</h2>
                    <p className="pay-subtitle">Энэ нэхэмжлэлийн хугацаа дууссан байна. Шинэ нэхэмжлэл авна уу.</p>
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
                            onClick={() => {
                                // Track click for analytics
                                fetch(`/api/pay/${id}`, { method: 'HEAD' }).catch(() => {});
                            }}
                        >
                            <img
                                src={bank.logo}
                                alt={bank.name}
                                className="pay-bank-logo"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="pay-bank-name">{bank.name}</span>
                        </a>
                    ))}
                </div>

                {/* QR Code fallback (desktop) */}
                {payment.qrImage && (
                    <details className="pay-qr-section">
                        <summary className="pay-qr-toggle">QR код харуулах</summary>
                        <div className="pay-qr-wrapper">
                            <img src={payment.qrImage} alt="QR Code" className="pay-qr-image" />
                        </div>
                    </details>
                )}

                {/* Footer */}
                <div className="pay-footer">
                    <p>Төлбөр хийгдсэний дараа энэ хуудас автоматаар шинэчлэгдэнэ</p>
                    <div className="pay-polling-dot" />
                </div>
            </div>
        </div>
    );
}
