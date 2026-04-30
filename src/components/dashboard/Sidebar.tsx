'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Settings,
    Bot,
    BarChart3,
    AlertTriangle,
    HelpCircle,
    MessageSquareMore,
    Inbox,
    Shield,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatures } from '@/hooks/useFeatures';
import { useActiveShopAgent } from '@/hooks/useActiveShopAgent';
import type { AgentCapability } from '@/lib/ai/agents/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RailItem {
    nameKey: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    feature?: string;
    comingSoon?: boolean;
    /**
     * Capability gates: the menu item is shown only if the shop's agent
     * has at least one of these capabilities. Items with no gate are
     * always visible.
     */
    requiresAnyCapability?: AgentCapability[];
}

const primaryItems: RailItem[] = [
    { nameKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
        nameKey: 'orders',
        href: '/dashboard/orders',
        icon: ShoppingCart,
        requiresAnyCapability: ['sales', 'support'],
    },
    { nameKey: 'inbox', href: '/dashboard/inbox', icon: Inbox },
    {
        nameKey: 'products',
        href: '/dashboard/products',
        icon: Package,
        requiresAnyCapability: ['sales', 'booking'],
    },
    { nameKey: 'customers', href: '/dashboard/customers', icon: Users },
    { nameKey: 'aiSettings', href: '/dashboard/ai-settings', icon: Bot },
    { nameKey: 'reports', href: '/dashboard/reports', icon: BarChart3, feature: 'crm_analytics' },
];

const secondaryItems: RailItem[] = [
    { nameKey: 'commentMgmt', href: '/dashboard/comment-automation', icon: MessageSquareMore, comingSoon: true },
    {
        nameKey: 'cart',
        href: '/dashboard/cart',
        icon: ShoppingCart,
        feature: 'cart_system',
        requiresAnyCapability: ['sales'],
    },
    {
        nameKey: 'paymentAudit',
        href: '/dashboard/payment-audit',
        icon: Shield,
        requiresAnyCapability: ['sales'],
    },
    {
        nameKey: 'complaints',
        href: '/dashboard/complaints',
        icon: AlertTriangle,
        requiresAnyCapability: ['sales', 'support'],
    },
];

const bottomItems: RailItem[] = [
    { nameKey: 'help', href: '/dashboard/help', icon: HelpCircle },
    { nameKey: 'settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const { hasFeature, isPaidPlan, plan } = useFeatures();
    const agent = useActiveShopAgent();

    const isCapabilityVisible = (item: RailItem) => {
        if (!item.requiresAnyCapability || item.requiresAnyCapability.length === 0) return true;
        // While loading, show everything to avoid layout flicker.
        if (agent.loading) return true;
        return item.requiresAnyCapability.some((c) => agent.capabilities.includes(c));
    };

    const getLabel = (key: string) => (t.sidebar as Record<string, string>)[key] || key;

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
        return pathname === href || (pathname?.startsWith(href + '/') ?? false);
    };

    const isLocked = (item: RailItem) => {
        if (!item.feature) return false;
        const onPaid = (plan?.slug && plan.slug !== 'free') || isPaidPlan;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — dynamic feature key
        return !hasFeature(item.feature) && !onPaid;
    };

    const renderItem = (item: RailItem) => {
        const active = isActive(item.href);
        const locked = isLocked(item);
        const label = getLabel(item.nameKey);
        const Icon = item.icon;

        const rowBase = cn(
            'relative flex items-center gap-3 h-11 px-3 mx-2 rounded-xl transition-all duration-200',
            active
                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_20%,transparent)] text-[var(--brand-indigo)] before:absolute before:-left-2 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-r-full before:bg-[var(--brand-indigo)] before:shadow-[0_0_10px_var(--brand-indigo)]'
                : 'text-white/60 hover:text-white hover:bg-white/[0.06]',
            locked && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-white/60'
        );

        const content = (
            <>
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span
                    className={cn(
                        'text-[13px] font-medium tracking-[-0.01em] whitespace-nowrap',
                        'opacity-0 group-hover/rail:opacity-100 -translate-x-1 group-hover/rail:translate-x-0 transition-all duration-200 delay-[30ms]'
                    )}
                >
                    {label}
                </span>
                {item.comingSoon && (
                    <span
                        className={cn(
                            'ml-auto px-1.5 py-0.5 rounded-md whitespace-nowrap',
                            'text-[9px] font-semibold uppercase tracking-wider',
                            'bg-amber-500/15 text-amber-300 border border-amber-500/25',
                            'opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[30ms]'
                        )}
                    >
                        {getLabel('comingSoonBadge')}
                    </span>
                )}
            </>
        );

        if (locked) {
            return (
                <li key={item.nameKey}>
                    <button
                        aria-label={label}
                        onClick={() =>
                            toast.error(t.sidebar.requiresUpgrade, {
                                action: {
                                    label: t.sidebar.upgrade,
                                    onClick: () => (window.location.href = '/dashboard/subscription'),
                                },
                            })
                        }
                        className={cn(rowBase, 'w-full')}
                    >
                        {content}
                    </button>
                </li>
            );
        }

        return (
            <li key={item.nameKey}>
                <Link href={item.href} aria-label={label} className={rowBase}>
                    {content}
                </Link>
            </li>
        );
    };

    return (
        <aside
            className={cn(
                'group/rail fixed left-0 top-0 z-50 hidden md:flex h-screen',
                'w-[72px] hover:w-[240px] transition-[width] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]',
                'bg-[#0c0c0f]/95 backdrop-blur-2xl border-r border-white/[0.06]',
                'py-3 flex-col overflow-hidden'
            )}
            role="navigation"
            aria-label={t.sidebar.main}
        >
            <Link
                href="/dashboard"
                className="mx-3 mb-3 flex h-11 items-center gap-3 px-2 rounded-xl"
                aria-label="Syncly"
            >
                <Image src="/logo.png" alt="Syncly" width={30} height={30} className="rounded-lg shrink-0" />
                <span className="text-[15px] font-bold text-foreground tracking-[-0.02em] whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[30ms]">
                    Syncly
                </span>
            </Link>

            <div className="mx-4 mb-2 h-px bg-white/[0.06]" />

            <nav className="flex-1 w-full overflow-y-auto overflow-x-hidden scrollbar-hide">
                <ul className="flex flex-col gap-1">{primaryItems.filter(isCapabilityVisible).map(renderItem)}</ul>
                <div className="mx-4 my-3 h-px bg-white/[0.06]" />
                <ul className="flex flex-col gap-1">{secondaryItems.filter(isCapabilityVisible).map(renderItem)}</ul>
            </nav>

            <div className="mt-auto flex flex-col gap-1 pt-3 border-t border-white/[0.04] w-full">
                <ul className="flex flex-col gap-1">{bottomItems.map(renderItem)}</ul>
            </div>
        </aside>
    );
}
