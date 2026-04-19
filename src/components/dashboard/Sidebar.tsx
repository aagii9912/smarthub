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
    Sparkles,
    MessageSquareMore,
    Inbox,
    Shield,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatures } from '@/hooks/useFeatures';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RailItem {
    nameKey: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    feature?: string;
}

const primaryItems: RailItem[] = [
    { nameKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
    { nameKey: 'orders', href: '/dashboard/orders', icon: ShoppingCart, feature: 'payment_integration' },
    { nameKey: 'inbox', href: '/dashboard/inbox', icon: Inbox },
    { nameKey: 'products', href: '/dashboard/products', icon: Package },
    { nameKey: 'customers', href: '/dashboard/customers', icon: Users },
    { nameKey: 'aiSettings', href: '/dashboard/ai-settings', icon: Bot },
    { nameKey: 'reports', href: '/dashboard/reports', icon: BarChart3, feature: 'crm_analytics' },
];

const secondaryItems: RailItem[] = [
    { nameKey: 'commentMgmt', href: '/dashboard/comment-automation', icon: MessageSquareMore },
    { nameKey: 'cart', href: '/dashboard/cart', icon: ShoppingCart, feature: 'cart_system' },
    { nameKey: 'aiReport', href: '/dashboard/reports/ai', icon: Sparkles },
    { nameKey: 'paymentAudit', href: '/dashboard/payment-audit', icon: Shield },
    { nameKey: 'complaints', href: '/dashboard/complaints', icon: AlertTriangle },
];

const bottomItems: RailItem[] = [
    { nameKey: 'help', href: '/help', icon: HelpCircle },
    { nameKey: 'settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const { hasFeature, isPaidPlan, plan } = useFeatures();

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

        const base = cn(
            'relative group flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-200',
            active
                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_20%,transparent)] text-[var(--brand-indigo)] shadow-[var(--glow-active-rail,0_0_0_1px_rgba(74,124,231,0.4)),0_0_16px_rgba(74,124,231,0.25)]'
                : 'text-white/55 hover:text-white hover:bg-white/[0.06]',
            locked && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-white/55'
        );

        const tooltip = (
            <span
                role="tooltip"
                className="pointer-events-none absolute left-[52px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#141418] border border-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-50"
            >
                {label}
            </span>
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
                        className={base}
                    >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                        {tooltip}
                    </button>
                </li>
            );
        }

        return (
            <li key={item.nameKey}>
                <Link href={item.href} aria-label={label} className={base}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
                    {tooltip}
                </Link>
            </li>
        );
    };

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-50 hidden md:flex h-screen w-[72px] flex-col items-center',
                'bg-[#0c0c0f]/95 backdrop-blur-2xl border-r border-white/[0.06]',
                'py-3'
            )}
            role="navigation"
            aria-label={t.sidebar.main}
        >
            <Link
                href="/dashboard"
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                aria-label="Syncly"
            >
                <Image src="/logo.png" alt="Syncly" width={30} height={30} className="rounded-lg" />
            </Link>

            <div className="mx-auto mb-3 h-px w-8 bg-white/[0.06]" />

            <nav className="flex-1 w-full overflow-y-auto overflow-x-visible scrollbar-hide">
                <ul className="flex flex-col items-center gap-1.5">{primaryItems.map(renderItem)}</ul>
                <div className="mx-auto my-3 h-px w-8 bg-white/[0.06]" />
                <ul className="flex flex-col items-center gap-1.5">{secondaryItems.map(renderItem)}</ul>
            </nav>

            <div className="mt-auto flex flex-col items-center gap-1.5 pt-3 border-t border-white/[0.04] w-full">
                <ul className="flex flex-col items-center gap-1.5">{bottomItems.map(renderItem)}</ul>
            </div>
        </aside>
    );
}
