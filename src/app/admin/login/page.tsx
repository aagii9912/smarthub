'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AdminLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (res.ok) {
                // Store admin session
                localStorage.setItem('admin_session', data.token);
                document.cookie = `admin_token=${data.token}; path=/; max-age=86400`; // 24 hours
                router.push('/admin/dashboard');
            } else {
                setError(data.error || 'Буруу нууц үг');
            }
        } catch (err) {
            setError('Серверийн алдаа');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-violet-900 to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">SmartHub Admin</h1>
                    <p className="text-gray-400 mt-2">Super Admin нэвтрэх</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Admin Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                    <Lock className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-medium"
                            disabled={loading || !password}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Нэвтэрч байна...</span>
                                </div>
                            ) : (
                                'Нэвтрэх'
                            )}
                        </Button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-500 text-sm mt-6">
                    Зөвхөн эрх бүхий админ хандах боломжтой
                </p>
            </div>
        </div>
    );
}
