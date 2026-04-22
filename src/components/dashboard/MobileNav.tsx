'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ShoppingCart,
    Inbox,
    MoreHorizontal,
    Plus,
    X,
    Package,
    Users,
    AlertTriangle,
    Bot,
    MessageSquareMore,
    BarChart3,
    Sparkles,
    Shield,
    CreditCard,
    Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [showMore, setShowMore] = useState(false);

    const tabs = [
        { id: 'home', href: '/dashboard', icon: LayoutDashboard, label: t.mobileNav.home },
        { id: 'orders', href: '/dashboard/orders', icon: ShoppingCart, label: t.mobileNav.orders },
        { id: 'inbox', href: '/dashboard/inbox', icon: Inbox, label: t.mobileNav.inbox },
    ];

    const moreItems = [
        { name: t.sidebar.products, href: '/dashboard/products', icon: Package },
        { name: t.sidebar.customers, href: '/dashboard/customers', icon: Users },
        { name: t.sidebar.complaints, href: '/dashboard/complaints', icon: AlertTriangle },
        { name: t.sidebar.cart, href: '/dashboard/cart', icon: ShoppingCart },
        { name: t.sidebar.aiSettings, href: '/dashboard/ai-settings', icon: Bot },
        { name: t.sidebar.commentMgmt, href: '/dashboard/comment-automation', icon: MessageSquareMore },
        { name: t.sidebar.reports, href: '/dashboard/reports', icon: BarChart3 },
        { name: t.sidebar.aiReport, href: '/dashboard/reports/ai', icon: Sparkles },
        { name: t.sidebar.paymentAudit, href: '/dashboard/payment-audit', icon: Shield },
        { name: t.setup.subscription.title, href: '/dashboard/subscription', icon: CreditCard },
        { name: t.sidebar.settings, href: '/dashboard/settings', icon: Settings },
    ];

    useEffect(() => {
        if (!showMore) return;
        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowMore(false);
        };
        document.addEventListener('keydown', onEscape);
        return () => document.removeEventListener('keydown', onEscape);
    }, [showMore]);

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
        return pathname === href || (pathname?.startsWith(href + '/') ?? false);
    };

    const isMoreActive = moreItems.some((item) => isActive(item.href));

    return (
        <>
            {showMore && (
                <div className="fixed inset-0 z-40 block md:hidden" onClick={() => setShowMore(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
                    <div
                        className="absolute bottom-24 left-3 right-3 rounded-2xl overflow-hidden animate-fade-in-up bg-[#1a1a20]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-2">
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="font-bold text-foreground text-sm tracking-[-0.03em]">
                                    {t.mobileNav.more}
                                </span>
                                <button
                                    onClick={() => setShowMore(false)}
                                    aria-label={t.mobileNav.closeMenu}
                                    className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                                >
                                    <X className="h-4 w-4 text-white/40" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 p-3 pt-0">
                                {moreItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setShowMore(false)}
                                        className={cn(
                                            'flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all duration-200',
                                            isActive(item.href)
                                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-foreground border border-[color-mix(in_oklab,var(--brand-indigo)_30%,transparent)]'
                                                : 'hover:bg-white/[0.06] text-white/50'
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                'h-5 w-5',
                                                isActive(item.href) && 'text-[var(--brand-indigo)]'
                                            )}
                                            strokeWidth={isActive(item.href) ? 2 : 1.5}
                                        />
                                        <span className="text-[10px] font-medium text-center leading-tight tracking-[-0.01em]">
                                            {item.name}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating tab bar + inline FAB (matches prototype .syn-tabs layout) */}
            <div
                className="fixed bottom-3 left-3 right-3 z-40 flex md:hidden items-center justify-center gap-2.5"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <button
                    onClick={() => router.push('/dashboard/orders?new=1')}
                    aria-label={t.mobileNav.newAction}
                    className="shrink-0 h-[60px] w-[60px] rounded-full pill-cta flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Plus className="h-[22px] w-[22px]" strokeWidth={2.4} />
                </button>

                <nav
                    aria-label={t.mobileNav.mobileNavigation}
                    className="flex-1 bg-[#141418]/80 backdrop-blur-2xl rounded-full border border-white/[0.08] shadow-lg"
                >
                    <ul className="flex items-stretch justify-around h-[58px] px-2">
                        {tabs.map((tab) => {
                            const active = isActive(tab.href);
                            const Icon = tab.icon;
                            return (
                                <li key={tab.id} className="flex-1">
                                    <Link
                                        href={tab.href}
                                        className={cn(
                                            'flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-90',
                                            active ? 'text-foreground' : 'text-white/40'
                                        )}
                                    >
                                        <div className="relative">
                                            {active && (
                                                <span className="absolute inset-[-8px] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] rounded-full" />
                                            )}
                                            <Icon
                                                className={cn(
                                                    'h-[22px] w-[22px] relative',
                                                    active && 'text-[var(--brand-indigo)]'
                                                )}
                                                strokeWidth={active ? 2.1 : 1.7}
                                            />
                                        </div>
                                        {active && (
                                            <span className="text-[10px] font-semibold tracking-[-0.01em] text-[var(--brand-indigo)]">
                                                {tab.label}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                        <li className="flex-1">
                            <button
                                onClick={() => setShowMore((v) => !v)}
                                aria-label={t.mobileNav.additionalMenu}
                                aria-expanded={showMore}
                                className={cn(
                                    'flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-90',
                                    showMore || isMoreActive ? 'text-foreground' : 'text-white/40'
                                )}
                            >
                                <div className="relative">
                                    {(showMore || isMoreActive) && (
                                        <span className="absolute inset-[-8px] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] rounded-full" />
                                    )}
                                    <MoreHorizontal
                                        className={cn(
                                            'h-[22px] w-[22px] relative',
                                            (showMore || isMoreActive) && 'text-[var(--brand-indigo)]'
                                        )}
                                        strokeWidth={showMore || isMoreActive ? 2.1 : 1.7}
                                    />
                                </div>
                                {(showMore || isMoreActive) && (
                                    <span className="text-[10px] font-semibold tracking-[-0.01em] text-[var(--brand-indigo)]">
                                        {t.mobileNav.more}
                                    </span>
                                )}
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
        </>
    );
}
