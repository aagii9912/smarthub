'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ForgotPasswordPage() {
    const supabase = createSupabaseBrowserClient();
    const { t } = useLanguage();

    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
        });

        setLoading(false);

        if (error) {
            setError(error.message);
            return;
        }
        setSent(true);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Image
                        src="/logo.png"
                        alt="Syncly"
                        width={64}
                        height={64}
                        className="rounded-lg mx-auto mb-4"
                    />
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        {t.auth.forgotPasswordTitle}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {t.auth.forgotPasswordSubtitle}
                    </p>
                </div>

                <div className="bg-card border border-border rounded-2xl shadow-xl p-6 space-y-5">
                    {sent ? (
                        <div className="text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-3 text-center">
                            {t.auth.forgotPasswordSent}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    {t.auth.email}
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors disabled:opacity-50"
                            >
                                {loading ? t.auth.forgotPasswordSending : t.auth.forgotPasswordSubmit}
                            </button>
                        </form>
                    )}

                    <p className="text-center text-sm text-muted-foreground">
                        <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium">
                            {t.auth.backToLogin}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
