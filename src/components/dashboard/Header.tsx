'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { LogOut, Settings, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationButton } from '@/components/NotificationButton';
import { ShopSwitcher } from '@/components/dashboard/ShopSwitcher';
import { useFeatures } from '@/hooks/useFeatures';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/logger';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

export function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createSupabaseBrowserClient();
    const { user, shops } = useAuth();
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
            logger.error('Logout error:', { error });
            if (typeof window !== 'undefined') window.location.href = '/auth/login';
        }
    };

    const fullName = user?.fullName || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';

    const crumbs = buildBreadcrumbs(pathname || '/dashboard', t);

    return (
        <header
            className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06]"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div className="flex items-center gap-3 md:gap-4 h-14 px-4 md:px-6">
                {/* Breadcrumbs */}
                <nav aria-label="breadcrumb" className="flex items-center gap-1.5 min-w-0">
                    {crumbs.map((c, i) => {
                        const last = i === crumbs.length - 1;
                        return (
                            <div key={i} className="flex items-center gap-1.5 min-w-0">
                                {i > 0 && <ChevronRight className="h-3 w-3 text-white/30 shrink-0" />}
                                {c.href && !last ? (
                                    <Link
                                        href={c.href}
                                        className="text-[12px] text-white/50 hover:text-white/80 transition-colors truncate"
                                    >
                                        {c.label}
                                    </Link>
                                ) : (
                                    <span
                                        className={cn(
                                            'text-[12px] truncate tracking-[-0.01em]',
                                            last ? 'font-semibold text-white' : 'text-white/50'
                                        )}
                                    >
                                        {c.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Search — hidden on mobile */}
                <div className="hidden lg:flex items-center gap-2 mx-auto max-w-md flex-1">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                        <input
                            type="text"
                            placeholder={t.common.search}
                            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--brand-indigo)]/50 focus:bg-white/[0.06] transition-colors"
                        />
                    </div>
                </div>

                {/* Right actions */}
                <div className="ml-auto flex items-center gap-1.5">
                    <ShopSwitcher
                        onAddShop={
                            limits?.max_shops === -1 || shops.length < (limits?.max_shops || 1)
                                ? () => router.push('/setup?new=true')
                                : undefined
                        }
                    />

                    <NotificationButton />

                    <div ref={dropdownRef} className="relative">
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            aria-label={t.header.userMenu}
                            aria-expanded={showDropdown}
                            aria-haspopup="true"
                            className={cn(
                                'flex items-center gap-2 rounded-xl transition-all duration-200 p-1.5 md:px-2 md:py-1.5',
                                'hover:bg-white/[0.06]',
                                showDropdown && 'bg-white/[0.06]'
                            )}
                        >
                            <Avatar fallback={fullName} size="sm" tone="indigo" />
                            <ChevronDown
                                className={cn(
                                    'h-3 w-3 text-white/30 hidden md:block transition-transform duration-200',
                                    showDropdown && 'rotate-180'
                                )}
                            />
                        </button>

                        {showDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50 animate-fade-in-down bg-[#1a1a20]/95 backdrop-blur-2xl border border-white/[0.08] shadow-xl">
                                <div className="p-4 border-b border-white/[0.06]">
                                    <div className="flex items-center gap-3">
                                        <Avatar fallback={fullName} size="md" tone="indigo" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground text-sm tracking-[-0.02em] truncate">
                                                {fullName}
                                            </p>
                                            <p className="text-[11px] text-white/40 truncate">{displayEmail}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-1.5">
                                    <button
                                        onClick={() => {
                                            setShowDropdown(false);
                                            router.push('/dashboard/settings');
                                        }}
                                        aria-label={t.header.goToSettings}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-foreground hover:bg-white/[0.06] rounded-xl transition-colors"
                                    >
                                        <Settings className="h-4 w-4 text-white/30" strokeWidth={1.5} />
                                        {t.sidebar.settings}
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loggingOut}
                                        aria-label={t.header.logoutSystem}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-[var(--status-danger)] hover:bg-[color-mix(in_oklab,var(--status-danger)_12%,transparent)] rounded-xl transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" strokeWidth={1.5} />
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
