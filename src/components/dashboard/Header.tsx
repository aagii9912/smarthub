'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LogOut, Settings, ChevronDown, Search, Command } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationButton } from '@/components/NotificationButton';
import { ShopSwitcher } from '@/components/dashboard/ShopSwitcher';
import { useFeatures } from '@/hooks/useFeatures';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/logger';

import type { Translations } from '@/i18n';

function getGreeting(t: Translations): string {
    const hour = new Date().getHours();
    if (hour < 6) return t.header.goodNight;
    if (hour < 12) return t.header.goodMorning;
    if (hour < 17) return t.header.goodAfternoon;
    if (hour < 21) return t.header.goodEvening;
    return t.header.goodNight;
}

export function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createSupabaseBrowserClient();
    const { user, shop, shops } = useAuth();
    const { t } = useLanguage();
    const { limits } = useFeatures();
    const [showDropdown, setShowDropdown] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') setShowDropdown(false);
        }
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [showDropdown]);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            if (typeof window !== 'undefined' && 'caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map((name) => caches.delete(name)));
            }
            await supabase.auth.signOut();
            router.push('/auth/login');
            router.refresh();
        } catch (error: unknown) {
            logger.error('Logout error:', { error: error });
            if (typeof window !== 'undefined') window.location.href = '/auth/login';
        }
    };

    const fullName = user?.fullName || user?.email?.split('@')[0] || 'User';
    const firstName = fullName.split(' ')[0];
    const displayEmail = user?.email || '';

    const pageTitles = t.header.pageTitles;
    const path = pathname || '';
    const matchedKey = Object.keys(pageTitles)
        .filter((k) => k !== '/dashboard')
        .find((k) => path.startsWith(k));
    const isDashboardRoot = path === '/dashboard' || path === '/dashboard/';

    return (
        <header className="sticky top-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Safe area background for Dynamic Island/notch */}
            <div className="absolute top-0 left-0 right-0 bg-[#09090b] md:hidden" style={{ height: 'env(safe-area-inset-top)' }} />
            {/* Glass bar */}
            <div className="mx-4 mt-3 px-4 md:px-5 h-14 rounded-2xl bg-[#141418]/70 backdrop-blur-2xl border border-white/[0.08] flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {/* Left: Title / Greeting */}
                <div className="flex-1 min-w-0">
                    {isDashboardRoot ? (
                        <div>
                            <h1 className="text-[15px] font-bold text-foreground truncate tracking-[-0.03em]">
                                <span className="hidden sm:inline">{getGreeting(t)}, {firstName}</span>
                                <span className="sm:hidden">{getGreeting(t)}</span>
                            </h1>
                            {shop && (
                                <p className="text-[11px] text-white/35 truncate hidden sm:block tracking-[-0.01em] mt-0.5">
                                    {shop.name} • {new Date().toLocaleDateString('mn-MN', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="text-[15px] font-bold text-foreground tracking-[-0.03em]">
                                {(matchedKey && pageTitles[matchedKey]) || t.header.fallbackTitle}
                            </h1>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5">
                    {/* Shop Switcher */}
                    <ShopSwitcher
                        onAddShop={
                            limits?.max_shops === -1 || shops.length < (limits?.max_shops || 1)
                                ? () => router.push('/setup?new=true')
                                : undefined
                        }
                    />

                    {/* Notifications */}
                    <NotificationButton />

                    {/* Profile */}
                    <div ref={dropdownRef} className="relative">
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            aria-label={t.header.userMenu}
                            aria-expanded={showDropdown}
                            aria-haspopup="true"
                            className={cn(
                                'flex items-center gap-2 rounded-xl transition-all duration-200 p-1.5 md:px-2.5 md:py-1.5',
                                'hover:bg-[#151040]',
                                showDropdown && 'bg-[#151040]'
                            )}
                        >
                            <div className="relative">
                                <Avatar fallback={fullName} size="sm" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#141418]" />
                            </div>
                            <ChevronDown
                                className={cn(
                                    'w-3 h-3 text-white/30 hidden md:block transition-transform duration-200',
                                    showDropdown && 'rotate-180'
                                )}
                            />
                        </button>

                        {showDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50 animate-fade-in-down bg-[#1a1a20]/90 backdrop-blur-2xl border border-white/[0.08] shadow-xl">
                                {/* User info */}
                                <div className="p-4 border-b border-white/[0.08]">
                                    <div className="flex items-center gap-3">
                                        <Avatar fallback={fullName} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground text-sm tracking-[-0.02em] truncate">
                                                {fullName}
                                            </p>
                                            <p className="text-[11px] text-white/40 truncate">{displayEmail}</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Actions */}
                                <div className="p-1.5">
                                    <button
                                        onClick={() => {
                                            setShowDropdown(false);
                                            router.push('/dashboard/settings');
                                        }}
                                        aria-label={t.header.goToSettings}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-foreground hover:bg-[#151040] rounded-xl transition-colors"
                                    >
                                        <Settings className="w-4 h-4 text-white/30" strokeWidth={1.5} />
                                        {t.sidebar.settings}
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loggingOut}
                                        aria-label={t.header.logoutSystem}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-red-500 hover:bg-red-900/10 rounded-xl transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" strokeWidth={1.5} />
                                        {loggingOut ? t.auth.loggingOut : t.auth.logout}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
