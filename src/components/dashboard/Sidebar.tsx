'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Settings,
    ChevronLeft,
    Bot,
    CreditCard,
    BarChart3,
    AlertTriangle,
    HelpCircle,
    Sparkles,
    Zap,
    ArrowUpRight,
    Globe,
    MessageSquareMore,
    Inbox,
    Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatures } from '@/hooks/useFeatures';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// ─── Menu Config ───
interface MenuItem {
    nameKey: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: string;
    feature?: string;
}

const mainMenuKeys: MenuItem[] = [
    { nameKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    { nameKey: 'products', href: '/dashboard/products', icon: Package },
    { nameKey: 'orders', href: '/dashboard/orders', icon: ShoppingCart, feature: 'payment_integration' },
    { nameKey: 'customers', href: '/dashboard/customers', icon: Users },
    { nameKey: 'complaints', href: '/dashboard/complaints', icon: AlertTriangle },
];

const toolsMenuKeys: MenuItem[] = [
    { nameKey: 'aiSettings', href: '/dashboard/ai-settings', icon: Bot },
    { nameKey: 'commentMgmt', href: '/dashboard/comment-automation', icon: MessageSquareMore },
    { nameKey: 'cart', href: '/dashboard/inbox', icon: ShoppingCart, feature: 'cart_system' },
    { nameKey: 'inbox', href: '/dashboard/inbox/messages', icon: Inbox },
    { nameKey: 'reports', href: '/dashboard/reports', icon: BarChart3, feature: 'crm_analytics' },
    { nameKey: 'aiReport', href: '/dashboard/reports/ai', icon: Sparkles },
    { nameKey: 'paymentAudit', href: '/dashboard/payment-audit', icon: Shield },
];

const bottomMenuKeys: MenuItem[] = [
    { nameKey: 'help', href: '/help', icon: HelpCircle },
    { nameKey: 'settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const { shop } = useAuth();
    const { t } = useLanguage();
    const { hasFeature, isPaidPlan, plan, usage, limits } = useFeatures();

    useEffect(() => setMounted(true), []);

    const getMenuName = (key: string) => {
        return (t.sidebar as Record<string, string>)[key] || key;
    };

    const getActiveHref = () => {
        if (pathname === '/dashboard' || pathname === '/dashboard/') return '/dashboard';
        const allHrefs = [...mainMenuKeys, ...toolsMenuKeys, ...bottomMenuKeys].map(item => item.href);
        const matches = allHrefs.filter(href => 
            pathname === href || pathname.startsWith(href + '/')
        );
        if (matches.length === 0) return null;
        return matches.reduce((a, b) => a.length > b.length ? a : b);
    };

    const activeHref = getActiveHref();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
        return href === activeHref;
    };

    const isLocked = (item: MenuItem) => {
        if (!item.feature) return false;
        // @ts-ignore
        const featureEnabled = hasFeature(item.feature);
        const isOnPaidPlan = (plan?.slug && plan.slug !== 'free') || isPaidPlan;
        return !featureEnabled && !isOnPaidPlan;
    };

    const msgUsage = usage?.messages_count || 0;
    const msgLimit = limits?.max_messages || 0;
    const msgPercent = msgLimit === -1 ? 5 : Math.min((msgUsage / (msgLimit || 1)) * 100, 100);

    const renderNavItem = (item: MenuItem) => {
        const active = isActive(item.href);
        const locked = isLocked(item);
        const name = getMenuName(item.nameKey);

        if (locked) {
            return (
                <li key={item.nameKey}>
                    <button
                        onClick={() =>
                            toast.error(t.sidebar.requiresUpgrade, {
                                action: {
                                    label: t.sidebar.upgrade,
                                    onClick: () => (window.location.href = '/dashboard/subscription'),
                                },
                            })
                        }
                        className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                            'text-white/20 cursor-not-allowed',
                            collapsed && 'justify-center px-0'
                        )}
                    >
                        <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                        {!collapsed && (
                            <span className="text-[13px] font-medium truncate">{name}</span>
                        )}
                    </button>
                </li>
            );
        }

        return (
            <li key={item.nameKey}>
                <Link
                    href={item.href}
                    className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                        active
                            ? 'bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                            : 'text-white/50 hover:text-white/80 hover:bg-[#151040]',
                        collapsed && 'justify-center px-0'
                    )}
                >
                    {/* Glow effect for active */}
                    {active && (
                        <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-transparent to-transparent pointer-events-none" />
                    )}
                    {/* Gold left accent */}
                    {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-blue-400 to-violet-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    )}
                    <item.icon
                        className={cn(
                            'w-[18px] h-[18px] shrink-0 transition-all duration-200 relative z-10',
                            active ? 'text-blue-400' : 'group-hover:text-white/70'
                        )}
                        strokeWidth={active ? 2 : 1.5}
                    />
                    {!collapsed && (
                        <span className={cn(
                            'text-[13px] truncate relative z-10 transition-all duration-200',
                            active ? 'font-semibold text-white' : 'font-medium'
                        )}>
                            {name}
                        </span>
                    )}
                    {!collapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md relative z-10">
                            {item.badge}
                        </span>
                    )}
                </Link>
            </li>
        );
    };

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 h-screen z-50 hidden md:flex flex-col',
                'bg-[#0c0c0f]/95 backdrop-blur-2xl border-r border-white/[0.08]',
                'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                collapsed ? 'w-[72px]' : 'w-[260px]'
            )}
            style={{
                background: 'linear-gradient(180deg, rgba(12,12,15,0.98) 0%, rgba(8,8,12,0.99) 100%)',
            }}
            role="navigation"
            aria-label={t.sidebar.main}
        >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.02] via-transparent to-violet-500/[0.02] pointer-events-none rounded-r-2xl" aria-hidden="true" />

            {/* ─── Logo ─── */}
            <div className="relative flex items-center h-16 px-5 shrink-0">
                {!collapsed ? (
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Image src="/logo.png" alt="Syncly" width={30} height={30} className="rounded-lg" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#0c0c0f] shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                        </div>
                        <div>
                            <span className="font-bold text-[16px] text-white tracking-[-0.03em]">Syncly</span>
                            <span className="text-[10px] text-blue-400/80 font-medium ml-1.5 bg-blue-400/10 px-1.5 py-0.5 rounded-md">AI</span>
                        </div>
                    </div>
                ) : (
                    <div className="relative mx-auto">
                        <Image src="/logo.png" alt="Syncly" width={28} height={28} className="rounded-lg" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-[#0c0c0f]" />
                    </div>
                )}
            </div>

            {/* ─── Language Switcher ─── */}
            {!collapsed && (
                <div className="relative mx-4 mb-2">
                    <LanguageSwitcher />
                </div>
            )}

            {/* ─── Chatbot Status ─── */}
            {!collapsed && shop && (
                <div className="relative mx-4 mt-1 mb-3 px-3.5 py-3 rounded-xl bg-[#0F0B2E] border border-white/[0.08]">
                    <div className="flex items-center gap-2.5">
                        {shop.facebook_page_id ? (
                            <>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                                </span>
                                <span className="text-[12px] text-emerald-400 font-medium">{t.sidebar.chatbotActive}</span>
                                <Zap className="w-3 h-3 text-emerald-400/60 ml-auto" />
                            </>
                        ) : (
                            <>
                                <span className="h-2 w-2 rounded-full bg-blue-400/80" />
                                <span className="text-[12px] text-blue-400/80 font-medium">{t.sidebar.fbNotConnected}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Main Navigation ─── */}
            <nav className="relative flex-1 overflow-y-auto px-3 scrollbar-hide">
                {/* Section: Main */}
                {!collapsed && (
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em] px-3 mb-2 mt-2">
                        {t.sidebar.main}
                    </p>
                )}
                <ul className="space-y-0.5">{mainMenuKeys.map(renderNavItem)}</ul>

                {/* Section: Tools */}
                {!collapsed && (
                    <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.12em] px-3 mb-2 mt-6">
                        {t.sidebar.tools}
                    </p>
                )}
                {collapsed && <div className="my-4 mx-3 h-px bg-[#151040]" />}
                <ul className="space-y-0.5">{toolsMenuKeys.map(renderNavItem)}</ul>
            </nav>

            {/* ─── Plan Card ─── */}
            {!collapsed && (
                <div className="relative mx-4 mb-3">
                    {isPaidPlan ? (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-[0.1em]">
                                        {plan?.slug?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="mb-1.5 flex justify-between text-[11px]">
                                <span className="text-white/40">{t.sidebar.messages}</span>
                                <span className="text-white/60 tabular-nums font-medium">
                                    {msgUsage} / {msgLimit === -1 ? '∞' : msgLimit}
                                </span>
                            </div>
                            <div className="h-1.5 bg-[#151040] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
                                    style={{ width: `${msgPercent}%` }}
                                />
                            </div>
                            <Link
                                href="/dashboard/subscription"
                                className="mt-3 flex items-center gap-1 text-[11px] font-medium text-blue-400/80 hover:text-blue-400 transition-colors"
                            >
                                {t.sidebar.manage} <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>
                    ) : (
                        <div className="relative p-4 rounded-xl overflow-hidden border border-blue-500/20">
                            {/* Gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-violet-500/5 to-transparent" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-blue-400" />
                                    <span className="text-[13px] font-bold text-white">{t.sidebar.upgradeToPro}</span>
                                </div>
                                <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
                                    {t.sidebar.upgradeDesc}
                                </p>
                                <Link href="/dashboard/subscription">
                                    <button className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold rounded-lg text-[12px] hover:from-blue-400 hover:to-violet-400 transition-all duration-200 shadow-[0_2px_12px_rgba(245,158,11,0.3)]">
                                        {t.sidebar.upgrade}
                                    </button>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Bottom Menu ─── */}
            <div className="relative px-3 pb-4 pt-2 border-t border-white/[0.04] shrink-0">
                <ul className="space-y-0.5">{bottomMenuKeys.map(renderNavItem)}</ul>
            </div>

            {/* ─── Collapse Toggle ─── */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                    'absolute -right-3 top-20 z-10 h-6 w-6 rounded-full',
                    'bg-[#1a1a20] border border-white/[0.1] flex items-center justify-center',
                    'hover:bg-[#252530] hover:border-white/[0.15] transition-all duration-200',
                    'shadow-lg'
                )}
                aria-label={collapsed ? t.sidebar.expandMenu : t.sidebar.collapseMenu}
            >
                <ChevronLeft
                    className={cn(
                        'w-3 h-3 text-white/50 transition-transform duration-300',
                        collapsed && 'rotate-180'
                    )}
                />
            </button>
        </aside>
    );
}
