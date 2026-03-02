'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect_url') || '/dashboard';
    const supabase = createSupabaseBrowserClient();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message === 'Invalid login credentials'
                ? 'Имэйл эсвэл нууц үг буруу байна'
                : error.message);
            setLoading(false);
        } else {
            router.push(redirectUrl);
            router.refresh();
        }
    };

    const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
        setError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectUrl)}`,
                ...(provider === 'facebook' && { scopes: 'public_profile' }),
            },
        });
        if (error) {
            setError(error.message);
        }
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
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        Syncly
                    </h1>
                    <p className="text-muted-foreground">
                        AI платформ руу нэвтрэх
                    </p>
                </div>

                <div className="bg-card border border-border rounded-2xl shadow-xl p-6 space-y-5">
                    {/* OAuth Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleOAuthLogin('google')}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google-ээр нэвтрэх
                        </button>

                        <button
                            onClick={() => handleOAuthLogin('facebook')}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-[#1877F2] hover:bg-[#166FE5] transition-colors text-sm font-medium text-white"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Facebook-ээр нэвтрэх
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-card text-muted-foreground">эсвэл</span>
                        </div>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Имэйл
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
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Нууц үг
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                placeholder="••••••••"
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
                            {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        Бүртгэл байхгүй юу?{' '}
                        <Link href="/auth/register" className="text-primary hover:text-primary/80 font-medium">
                            Бүртгүүлэх
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
