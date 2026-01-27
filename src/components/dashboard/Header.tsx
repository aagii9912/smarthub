'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Settings, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationButton } from '@/components/NotificationButton';
import { ShopSwitcher } from '@/components/dashboard/ShopSwitcher';

export function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const { signOut } = useClerk();
    const { user, shop, shops } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            if (typeof window !== 'undefined' && 'caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            await signOut({ redirectUrl: '/auth/login' });
        } catch (error) {
            console.error('Logout error:', error);
            if (typeof window !== 'undefined') window.location.href = '/auth/login';
        }
    };

    // Get first name for mobile, full name for desktop
    const fullName = user?.fullName || user?.email?.split('@')[0] || 'User';
    const firstName = fullName.split(' ')[0];
    const displayEmail = user?.email || '';

    // Determine header title based on current path
    const getHeaderTitle = () => {
        const path = pathname || '';
        if (path === '/dashboard' || path === '/dashboard/') {
            return (
                <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-base md:text-lg font-semibold truncate"
                >
                    <span className="hidden sm:inline text-white">Сайн байна у|у, </span>
                    <span className="hidden sm:inline bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{fullName}!</span>
                    <span className="sm:hidden text-white">Сайн у|у, </span>
                    <span className="sm:hidden bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{firstName}!</span>
                </motion.h1>
            );
        }

        let title = 'Dashboard';
        if (path.includes('/orders')) title = 'Захиалга';
        else if (path.includes('/products')) title = 'Бүтээгдэхүүн';
        else if (path.includes('/customers')) title = 'Харилцагч';
        else if (path.includes('/reports')) title = 'Тайлан';
        else if (path.includes('/settings')) title = 'Тохиргоо';
        else if (path.includes('/inbox')) title = 'Идэвхтэй Сагс';
        else if (path.includes('/ai-settings')) title = 'AI Тохиргоо';
        else if (path.includes('/subscription')) title = 'Төлбөр & Эрх';

        return (
            <motion.h1
                key={title}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold text-white"
            >
                {title}
            </motion.h1>
        );
    };

    return (
        <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40"
            style={{
                background: 'rgba(10, 10, 10, 0.8)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
        >
            {/* Left: Title or Greeting */}
            <div className="flex-1 min-w-0">
                {getHeaderTitle()}
                {shop && (pathname === '/dashboard' || pathname === '/dashboard/') && (
                    <p className="text-xs text-zinc-500 truncate hidden sm:block mt-0.5">
                        {shop.name}
                    </p>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 md:gap-3">
                {/* Shop Switcher - show if user has multiple shops */}
                {shops.length > 1 && <ShopSwitcher />}

                {/* Notifications */}
                <NotificationButton />

                {/* Profile Dropdown */}
                <div className="relative">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-2 hover:bg-zinc-800/50 rounded-xl transition-colors p-1.5 md:px-3 md:py-2 border border-transparent hover:border-zinc-700/50"
                    >
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-indigo-500/20">
                            {firstName[0]?.toUpperCase()}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 hidden md:block transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </motion.button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                        {showDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowDropdown(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-2xl z-50 overflow-hidden"
                                    style={{
                                        background: 'rgba(24, 24, 27, 0.95)',
                                        backdropFilter: 'blur(20px)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                    }}
                                >
                                    <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/50">
                                        <p className="font-medium text-white truncate">{fullName}</p>
                                        <p className="text-sm text-zinc-500 truncate">{displayEmail}</p>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        <button
                                            onClick={() => {
                                                setShowDropdown(false);
                                                router.push('/dashboard/settings');
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
                                        >
                                            <Settings className="w-4 h-4" />
                                            Тохиргоо
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            disabled={loggingOut}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            {loggingOut ? 'Гарч байна...' : 'Гарах'}
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.header>
    );
}
