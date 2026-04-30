'use client';

/**
 * Sidebar — Web V1 "Hover-expand rail"
 *
 * Collapsed: 72px (icon-only). Expanded on hover: 248px (full labels,
 * search, sub-items, badges, footer). Pure CSS group transition.
 *
 * Visual: dark #0d0d14 surface, indigo→violet gradient brand glyph,
 * indigo→violet gradient badges, subtle white/5 hover/active states.
 *
 * Content: full original navigation preserved — Workspace + Tools +
 * Bottom utilities — with feature-gating from useFeatures().
 *
 * Reference: 05-syncly-nav.png (style)
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    Inbox,
    Box,
    Users,
    Bot,
    LineChart,
    MessageSquareMore,
    ShoppingCart,
    Shield,
    AlertTriangle,
    HelpCircle,
    Settings,
    Search,
    ChevronDown,
    Crown,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatures } from '@/hooks/useFeatures';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavLink {
    nameKey: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    feature?: string;
    badge?: number;
    children?: { nameKey: string; href: string; badge?: number }[];
}

/** Workspace-level navigation — primary day-to-day surfaces */
const WORKSPACE: NavLink[] = [
    { nameKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    { nameKey: 'orders', href: '/dashboard/orders', icon: Package },
    { nameKey: 'inbox', href: '/dashboard/inbox', icon: Inbox },
    { nameKey: 'products', href: '/dashboard/products', icon: Box },
    { nameKey: 'customers', href: '/dashboard/customers', icon: Users },
];

/** Tools — secondary surfaces (analytics, AI, automations) */
const INSIGHTS: NavLink[] = [
    { nameKey: 'reports', href: '/dashboard/reports', icon: LineChart, feature: 'crm_analytics' },
    { nameKey: 'aiSettings', href: '/dashboard/ai-settings', icon: Bot },
    { nameKey: 'commentMgmt', href: '/dashboard/comment-automation', icon: MessageSquareMore },
    { nameKey: 'cart', href: '/dashboard/cart', icon: ShoppingCart, feature: 'cart_system' },
    { nameKey: 'paymentAudit', href: '/dashboard/payment-audit', icon: Shield },
    { nameKey: 'complaints', href: '/dashboard/complaints', icon: AlertTriangle },
];

/** Bottom — system utilities. `subscription` carries an inline label since
 *  the existing t.sidebar dict has no key for it. */
const SYSTEM: NavLink[] = [
    { nameKey: 'subscription', href: '/dashboard/subscription', icon: Crown },
    { nameKey: 'help', href: '/dashboard/help', icon: HelpCircle },
    { nameKey: 'settings', href: '/dashboard/settings', icon: Settings },
];

const SYSTEM_LABELS: Record<string, string> = {
    subscription: 'Багц',
};

/** Translation keys for sub-items that aren't in the existing sidebar dict */
const ORDER_CHILD_LABELS: Record<string, string> = {
    ordersAll: 'Бүх захиалга',
    ordersPending: 'Шинэ',
    ordersProcessing: 'Бэлдэж буй',
    ordersShipped: 'Илгээсэн',
};

export function Sidebar() {
    return (
        <Suspense fallback={<aside className="hidden md:block fixed left-0 top-0 z-50 h-screen w-[72px] bg-[#0d0d14] border-r border-white/[0.05]" />}>
            <SidebarInner />
        </Suspense>
    );
}

function SidebarInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, shop } = useAuth();
    const { t } = useLanguage();
    const { hasFeature, isPaidPlan, plan } = useFeatures();

    const getLabel = (key: string) =>
        ORDER_CHILD_LABELS[key] ||
        SYSTEM_LABELS[key] ||
        (t.sidebar as Record<string, string>)[key] ||
        key;

    const isActive = (href: string) => {
        const [base] = href.split('?');
        if (base === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
        return pathname === base || (pathname?.startsWith(base + '/') ?? false);
    };

    const childIsActive = (childHref: string, parentHref: string) => {
        const [childBase, childQuery] = childHref.split('?');
        const [parentBase] = parentHref.split('?');
        if (pathname !== childBase) return false;
        if (!childQuery) {
            return childBase === parentBase && !searchParams?.get('status');
        }
        const params = new URLSearchParams(childQuery);
        for (const [key, value] of params.entries()) {
            if (searchParams?.get(key) !== value) return false;
        }
        return true;
    };

    const isLocked = (item: NavLink) => {
        if (!item.feature) return false;
        const onPaid = (plan?.slug && plan.slug !== 'free') || isPaidPlan;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — dynamic feature key
        return !hasFeature(item.feature) && !onPaid;
    };

    const fullName = user?.fullName || 'Хэрэглэгч';
    const initials =
        fullName
            .split(' ')
            .map((p) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'X';

    return (
        <aside
            className={cn(
                'group/rail fixed left-0 top-0 z-50 hidden md:flex h-screen flex-col',
                'w-[72px] hover:w-[248px] transition-[width] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]',
                'bg-[#0d0d14] border-r border-white/[0.05]',
                'overflow-hidden',
            )}
            role="navigation"
            aria-label={t.sidebar.main}
        >
            {/* ── Brand header ─────────────────────────── */}
            <div className="flex items-center h-14 px-4 shrink-0">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-[#4A7CE7] to-[#8B5CF6] shrink-0">
                    <Image src="/logo.png" alt="Syncly" width={20} height={20} className="opacity-95" />
                </div>
                <span className="ml-3 text-[15px] font-bold text-white tracking-[-0.02em] whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
                    Syncly
                </span>
                <kbd className="ml-auto text-[10.5px] font-medium text-white/35 px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03] whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
                    ⌘K
                </kbd>
            </div>

            {/* ── Search ──────────────────────────────── */}
            <div className="px-3 mb-3 shrink-0">
                <div className="flex items-center h-9 rounded-lg bg-white/[0.04] border border-white/[0.05] px-3">
                    <Search className="h-[14px] w-[14px] text-white/40 shrink-0" strokeWidth={2} />
                    <input
                        type="text"
                        placeholder={t.sidebar.expandMenu === 'Цэс дэлгэх' ? 'Хайх...' : 'Search...'}
                        className="ml-2.5 flex-1 bg-transparent text-[12.5px] text-white/70 placeholder:text-white/30 outline-none whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]"
                    />
                </div>
            </div>

            {/* ── Sections ────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-3">
                <SectionLabel>{t.sidebar.main}</SectionLabel>
                <ul className="flex flex-col gap-0.5">
                    {WORKSPACE.map((item) => (
                        <NavItem
                            key={item.nameKey}
                            item={item}
                            active={isActive(item.href)}
                            locked={isLocked(item)}
                            getLabel={getLabel}
                            childIsActive={childIsActive}
                            t={t}
                        />
                    ))}
                </ul>

                <div className="mt-5">
                    <SectionLabel>{t.sidebar.tools}</SectionLabel>
                    <ul className="flex flex-col gap-0.5">
                        {INSIGHTS.map((item) => (
                            <NavItem
                                key={item.nameKey}
                                item={item}
                                active={isActive(item.href)}
                                locked={isLocked(item)}
                                getLabel={getLabel}
                                childIsActive={childIsActive}
                                t={t}
                            />
                        ))}
                    </ul>
                </div>

                <div className="mt-5">
                    <ul className="flex flex-col gap-0.5">
                        {SYSTEM.map((item) => (
                            <NavItem
                                key={item.nameKey}
                                item={item}
                                active={isActive(item.href)}
                                locked={isLocked(item)}
                                getLabel={getLabel}
                                childIsActive={childIsActive}
                                t={t}
                            />
                        ))}
                    </ul>
                </div>
            </nav>

            {/* ── Footer ──────────────────────────────── */}
            <div className="border-t border-white/[0.05] p-3 shrink-0 flex flex-col gap-2">
                {/* Upgrade CTA — only for free plan, only visible expanded */}
                {!isPaidPlan && (
                    <Link
                        href="/dashboard/subscription"
                        className={cn(
                            'group/cta hidden group-hover/rail:flex items-center gap-2.5 px-3 py-2.5 rounded-lg',
                            'bg-gradient-to-br from-[#4A7CE7]/15 via-[#8B5CF6]/15 to-[#4A7CE7]/15',
                            'border border-[#8B5CF6]/25 hover:border-[#8B5CF6]/40 transition-all',
                        )}
                    >
                        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gradient-to-br from-[#4A7CE7] to-[#8B5CF6] shrink-0">
                            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-white tracking-[-0.01em]">
                                {t.sidebar.upgradeToPro}
                            </div>
                            <div className="text-[10.5px] text-white/55 truncate">
                                {plan?.name || 'Free'} → Pro
                            </div>
                        </div>
                    </Link>
                )}

                {/* User row */}
                <div className="flex items-center h-11 rounded-lg px-2 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-[11px] font-bold text-white shrink-0">
                        {initials}
                    </div>
                    <div className="ml-2.5 flex-1 min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
                        <div className="text-[12.5px] font-semibold text-white/90 truncate tracking-[-0.01em]">
                            {fullName}
                        </div>
                        <div className="text-[10.5px] text-white/40 truncate">
                            {shop?.name || 'Shop'} · {plan?.name || 'Free'}
                        </div>
                    </div>
                    <Link
                        href="/dashboard/settings"
                        aria-label={t.sidebar.settings}
                        className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors opacity-0 group-hover/rail:opacity-100 delay-[40ms]"
                    >
                        <Settings className="h-[15px] w-[15px]" strokeWidth={1.8} />
                    </Link>
                </div>
            </div>
        </aside>
    );
}

interface NavItemProps {
    item: NavLink;
    active: boolean;
    locked: boolean;
    getLabel: (k: string) => string;
    childIsActive: (childHref: string, parentHref: string) => boolean;
    t: ReturnType<typeof useLanguage>['t'];
}

function NavItem({ item, active, locked, getLabel, childIsActive, t }: NavItemProps) {
    const Icon = item.icon;
    const label = getLabel(item.nameKey);
    const hasChildren = !!item.children?.length;
    const [openOverride, setOpenOverride] = useState<boolean | null>(null);
    const open = openOverride ?? active;

    const baseRow = cn(
        'group/item relative flex items-center h-10 rounded-lg px-3 transition-colors w-full',
        active
            ? 'bg-white/[0.06] text-white'
            : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85',
        locked && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-white/55',
    );

    const rowContent = (
        <>
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} />
            <span className="ml-3 text-[13.5px] font-medium tracking-[-0.01em] whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
                {label}
            </span>
            {item.badge !== undefined && (
                <span
                    className={cn(
                        'ml-auto flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full',
                        'text-[11px] font-semibold text-white',
                        'bg-gradient-to-br from-[#4A7CE7] to-[#8B5CF6]',
                        'opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]',
                    )}
                >
                    {item.badge}
                </span>
            )}
            {hasChildren && (
                <ChevronDown
                    className={cn(
                        'ml-auto h-3.5 w-3.5 text-white/30 transition-transform duration-200',
                        open && 'rotate-180',
                        'opacity-0 group-hover/rail:opacity-100 delay-[40ms]',
                    )}
                    strokeWidth={2}
                />
            )}
        </>
    );

    return (
        <li className="px-3">
            {locked ? (
                <button
                    type="button"
                    aria-label={label}
                    onClick={() =>
                        toast.error(t.sidebar.requiresUpgrade, {
                            action: {
                                label: t.sidebar.upgrade,
                                onClick: () => (window.location.href = '/dashboard/subscription'),
                            },
                        })
                    }
                    className={baseRow}
                >
                    {rowContent}
                </button>
            ) : hasChildren ? (
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenOverride(!open)}
                    className={baseRow}
                >
                    {rowContent}
                </button>
            ) : (
                <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={baseRow}
                >
                    {rowContent}
                </Link>
            )}

            {hasChildren && open && (
                <ul className="mt-1 ml-[26px] pl-3 border-l border-white/[0.06] flex flex-col gap-0.5 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[80ms]">
                    {item.children!.map((child) => {
                        const cActive = childIsActive(child.href, item.href);
                        return (
                            <li key={child.href}>
                                <Link
                                    href={child.href}
                                    className={cn(
                                        'flex items-center h-8 rounded-md px-3 text-[12.5px] transition-colors whitespace-nowrap',
                                        cActive
                                            ? 'bg-white/[0.05] text-white font-medium'
                                            : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03]',
                                    )}
                                >
                                    <span className="flex-1">{getLabel(child.nameKey)}</span>
                                    {child.badge !== undefined && (
                                        <span className="text-[10.5px] text-white/40 tabular-nums">
                                            {child.badge}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-6 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
            {children}
        </div>
    );
}
