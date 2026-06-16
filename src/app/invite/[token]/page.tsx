'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const ACTIVE_SHOP_KEY = 'smarthub_active_shop_id';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Админ',
    staff: 'Ажилтан',
};

interface InviteInfo {
    email: string;
    role: string;
    shopName: string | null;
    accountExists: boolean;
}

export default function InviteAcceptPage() {
    const params = useParams<{ token: string }>();
    const token = params?.token as string;
    const router = useRouter();
    const { user, isSignedIn, loading: authLoading } = useAuth();

    const [info, setInfo] = useState<InviteInfo | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [acceptError, setAcceptError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        let active = true;
        (async () => {
            try {
                const res = await fetch(`/api/team/invite/${token}`);
                const data = await res.json();
                if (!active) return;
                if (!res.ok) {
                    setLoadError(data.error || 'Урилга олдсонгүй');
                } else {
                    setInfo(data.invite);
                }
            } catch {
                if (active) setLoadError('Урилгыг ачаалахад алдаа гарлаа');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [token]);

    const handleAccept = async () => {
        setAccepting(true);
        setAcceptError(null);
        try {
            const res = await fetch('/api/team/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAcceptError(data.error || 'Урилгыг хүлээн авахад алдаа гарлаа');
                setAccepting(false);
                return;
            }
            // Шинэ дэлгүүрийг идэвхтэй болгож, dashboard руу шилжинэ.
            if (data.shopId) {
                localStorage.setItem(ACTIVE_SHOP_KEY, data.shopId);
            }
            window.location.href = '/dashboard';
        } catch {
            setAcceptError('Урилгыг хүлээн авахад алдаа гарлаа');
            setAccepting(false);
        }
    };

    const emailMismatch =
        isSignedIn && info && user?.email && user.email.toLowerCase() !== info.email.toLowerCase();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Image src="/logo.png" alt="Syncly" width={64} height={64} className="rounded-lg mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-foreground mb-2">Syncly</h1>
                </div>

                <div className="bg-card border border-border rounded-2xl shadow-xl p-6 space-y-5">
                    {loading || authLoading ? (
                        <p className="text-center text-muted-foreground py-6">Ачааллаж байна...</p>
                    ) : loadError ? (
                        <div className="text-center py-4 space-y-4">
                            <div className="text-4xl">⚠️</div>
                            <p className="text-foreground font-medium">{loadError}</p>
                            <Link href="/dashboard" className="text-primary hover:text-primary/80 text-sm font-medium">
                                Нүүр хуудас руу буцах
                            </Link>
                        </div>
                    ) : info ? (
                        <>
                            <div className="text-center space-y-2">
                                <div className="text-4xl">🎉</div>
                                <h2 className="text-xl font-bold text-foreground">
                                    {info.shopName || 'Дэлгүүр'}-д урьсан байна
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    Танд <span className="font-semibold text-foreground">{ROLE_LABELS[info.role] || info.role}</span> эрх олгоно.
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    Урилгын хаяг: <span className="font-medium">{info.email}</span>
                                </p>
                            </div>

                            {!isSignedIn ? (
                                <div className="space-y-3">
                                    <p className="text-center text-sm text-muted-foreground">
                                        Урилгыг хүлээн авахын тулд нэвтэрнэ үү.
                                    </p>
                                    {info.accountExists ? (
                                        <Link
                                            href={`/auth/login?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
                                            className="block w-full text-center py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors"
                                        >
                                            Нэвтрэх
                                        </Link>
                                    ) : (
                                        <Link
                                            href={`/auth/register?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
                                            className="block w-full text-center py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors"
                                        >
                                            Бүртгүүлэх
                                        </Link>
                                    )}
                                    <div className="text-center">
                                        <Link
                                            href={`/auth/${info.accountExists ? 'register' : 'login'}?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
                                            className="text-xs text-primary hover:text-primary/80"
                                        >
                                            {info.accountExists ? 'Шинэ хаяг үүсгэх' : 'Хаягтай юу? Нэвтрэх'}
                                        </Link>
                                    </div>
                                </div>
                            ) : emailMismatch ? (
                                <div className="space-y-3">
                                    <div className="text-sm text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2.5">
                                        Энэ урилга <strong>{info.email}</strong> хаягт илгээгдсэн. Та одоо{' '}
                                        <strong>{user?.email}</strong> хаягаар нэвтэрсэн байна. Зөв хаягаараа дахин нэвтэрнэ үү.
                                    </div>
                                    <Link
                                        href={`/auth/login?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
                                        className="block w-full text-center py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors"
                                    >
                                        Өөр хаягаар нэвтрэх
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {acceptError && (
                                        <div className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                                            {acceptError}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleAccept}
                                        disabled={accepting}
                                        className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors disabled:opacity-50"
                                    >
                                        {accepting ? 'Нэгдэж байна...' : 'Урилгыг хүлээн авах'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
