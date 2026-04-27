'use client';

/**
 * MobileNav — Mobile V1 "Glass pill" + More sheet
 *
 * Floating bottom dark glass pill. The 4 primary tabs (Нүүр / Захиалга /
 * Чат / Тайлан) follow the reference design — active tab grows to flex-2.4
 * with an indigo→violet gradient + label; inactive tabs collapse to icon
 * only. A 5th "Бусад" (More) icon opens a sheet that exposes the rest of
 * the navigation (customers, AI settings, cart, complaints, settings, etc.)
 * so no surface is lost on small screens.
 *
 * Reference: 01-syncly-nav.png (style)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    Package,
    Inbox,
    LineChart,
    MoreHorizontal,
    Users,
    Bot,
    MessageSquareMore,
    ShoppingCart,
    Shield,
    AlertTriangle,
    HelpCircle,
    Settings,
    CreditCard,
    Box,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface PillTab {
    id: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    labelKey: 'home' | 'orders' | 'inbox' | 'reports';
}

const PILL_TABS: PillTab[] = [
    { id: 'home', href: '/dashboard', icon: Home, labelKey: 'home' },
    { id: 'orders', href: '/dashboard/orders', icon: Package, labelKey: 'orders' },
    { id: 'inbox', href: '/dashboard/inbox', icon: Inbox, labelKey: 'inbox' },
    { id: 'reports', href: '/dashboard/reports', icon: LineChart, labelKey: 'reports' },
];

interface MoreItem {
    nameKey: string;
    fallback: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const MORE_ITEMS: MoreItem[] = [
    { nameKey: 'products', fallback: 'Бүтээгдэхүүн', href: '/dashboard/products', icon: Box },
    { nameKey: 'customers', fallback: 'Харилцагч', href: '/dashboard/customers', icon: Users },
    { nameKey: 'aiSettings', fallback: 'AI Тохиргоо', href: '/dashboard/ai-settings', icon: Bot },
    { nameKey: 'commentMgmt', fallback: 'Comment', href: '/dashboard/comment-automation', icon: MessageSquareMore },
    { nameKey: 'cart', fallback: 'Сагс', href: '/dashboard/cart', icon: ShoppingCart },
    { nameKey: 'paymentAudit', fallback: 'Audit', href: '/dashboard/payment-audit', icon: Shield },
    { nameKey: 'complaints', fallback: 'Гомдол', href: '/dashboard/complaints', icon: AlertTriangle },
    { nameKey: 'subscription', fallback: 'Багц', href: '/dashboard/subscription', icon: CreditCard },
    { nameKey: 'settings', fallback: 'Тохиргоо', href: '/dashboard/settings', icon: Settings },
    { nameKey: 'help', fallback: 'Тусламж', href: '/help', icon: HelpCircle },
];

export function MobileNav() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const [showMore, setShowMore] = useState(false);

    useEffect(() => {
        if (!showMore) return;
        const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setShowMore(false);
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [showMore]);

    // Hide on inbox thread routes so the chat input has full bottom space (Messenger-style).
    const isInboxThread =
        !!pathname?.startsWith('/dashboard/inbox/') && pathname !== '/dashboard/inbox';
    if (isInboxThread) return null;

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
        return pathname === href || (pathname?.startsWith(href + '/') ?? false);
    };

    const isMoreActive = MORE_ITEMS.some((m) => isActive(m.href));

    return (
        <>
            {/* ── More sheet (overlay) ──────────────────── */}
            {showMore && (
                <div
                    className="fixed inset-0 z-40 block md:hidden"
                    onClick={() => setShowMore(false)}
                >
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-md" />
                    <div
                        className="absolute bottom-24 left-3 right-3 rounded-2xl overflow-hidden bg-[#1a1a20]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl animate-fade-in-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                            <span className="text-[13.5px] font-semibold text-white/85 tracking-[-0.02em]">
                                {t.mobileNav.more}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowMore(false)}
                                aria-label={t.mobileNav.closeMenu}
                                className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                            >
                                <X className="h-4 w-4 text-white/45" strokeWidth={2} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 p-3">
                            {MORE_ITEMS.map((item) => {
                                const active = isActive(item.href);
                                const label = (t.sidebar as Record<string, string>)[item.nameKey] || item.fallback;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setShowMore(false)}
                                        className={cn(
                                            'group flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl transition-all',
                                            active
                                                ? 'bg-gradient-to-br from-[#4A7CE7]/15 to-[#8B5CF6]/15 border border-[#4A7CE7]/25'
                                                : 'hover:bg-white/[0.05] border border-transparent',
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                'h-5 w-5 transition-colors',
                                                active ? 'text-white' : 'text-white/55',
                                            )}
                                            strokeWidth={active ? 2 : 1.7}
                                        />
                                        <span
                                            className={cn(
                                                'text-[10.5px] text-center leading-tight tracking-[-0.005em] line-clamp-2',
                                                active ? 'text-white font-semibold' : 'text-white/55 font-medium',
                                            )}
                                        >
                                            {label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Glass pill ────────────────────────────── */}
            <nav
                aria-label={t.mobileNav.mobileNavigation}
                className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex md:hidden"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <ul
                    className={cn(
                        'flex items-stretch gap-1 p-1.5',
                        'rounded-full',
                        'bg-[#1a1a20]/85 backdrop-blur-2xl',
                        'border border-white/[0.06]',
                        'shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]',
                        'min-w-[320px]',
                    )}
                >
                    {PILL_TABS.map((tab) => {
                        const active = isActive(tab.href);
                        const Icon = tab.icon;
                        const label = t.mobileNav[tab.labelKey];
                        return (
                            <li
                                key={tab.id}
                                className={cn(
                                    'transition-[flex] duration-300 ease-out',
                                    active ? 'flex-[2.4]' : 'flex-1',
                                )}
                            >
                                <Link
                                    href={tab.href}
                                    aria-label={label}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'relative flex items-center justify-center gap-2 h-11 w-full rounded-full transition-all duration-300 ease-out active:scale-95',
                                        active
                                            ? 'bg-gradient-to-r from-[#4A7CE7] to-[#8B5CF6] shadow-[0_4px_16px_-2px_rgba(74,124,231,0.5)]'
                                            : 'hover:bg-white/[0.04]',
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            'h-[18px] w-[18px] shrink-0 transition-colors',
                                            active ? 'text-white' : 'text-white/55',
                                        )}
                                        strokeWidth={active ? 2.2 : 1.7}
                                    />
                                    {active && (
                                        <span className="text-[13px] font-semibold text-white tracking-[-0.01em] whitespace-nowrap">
                                            {label}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}

                    {/* More overflow — opens sheet with rest of the menu */}
                    <li className="flex-1">
                        <button
                            type="button"
                            onClick={() => setShowMore((v) => !v)}
                            aria-label={t.mobileNav.additionalMenu}
                            aria-expanded={showMore}
                            className={cn(
                                'flex items-center justify-center w-full h-11 rounded-full transition-all duration-300 ease-out active:scale-95',
                                showMore || isMoreActive
                                    ? 'bg-white/[0.08]'
                                    : 'hover:bg-white/[0.04]',
                            )}
                        >
                            <MoreHorizontal
                                className={cn(
                                    'h-[18px] w-[18px] transition-colors',
                                    showMore || isMoreActive ? 'text-white/85' : 'text-white/55',
                                )}
                                strokeWidth={showMore || isMoreActive ? 2.2 : 1.7}
                            />
                        </button>
                    </li>
                </ul>
            </nav>
        </>
    );
}
