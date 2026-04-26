'use client';

/**
 * Sidebar — Web V1 "Hover-expand rail"
 *
 * Collapsed: 72px (icon-only). Expanded on hover: 248px (full labels,
 * search, sub-items, badges, footer). Pure CSS transition — no JS state.
 *
 * Reference: 05-syncly-nav.png
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    Home,
    Package,
    Inbox,
    Box,
    LineChart,
    Bot,
    Search,
    Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavLink {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: number;
    children?: { label: string; href: string; badge?: number }[];
}

const WORKSPACE: NavLink[] = [
    { label: 'Нүүр', href: '/dashboard', icon: Home },
    {
        label: 'Захиалга',
        href: '/dashboard/orders',
        icon: Package,
        badge: 8,
        children: [
            { label: 'Бүх захиалга', href: '/dashboard/orders' },
            { label: 'Шинэ', href: '/dashboard/orders?status=pending', badge: 8 },
            { label: 'Бэлдэж буй', href: '/dashboard/orders?status=processing' },
            { label: 'Илгээсэн', href: '/dashboard/orders?status=shipped' },
        ],
    },
    { label: 'Чат', href: '/dashboard/inbox', icon: Inbox, badge: 12 },
    { label: 'Бүтээгдэхүүн', href: '/dashboard/products', icon: Box },
];

const INSIGHTS: NavLink[] = [
    { label: 'Тайлан', href: '/dashboard/reports', icon: LineChart },
    { label: 'AI bot', href: '/dashboard/ai-settings', icon: Bot },
];

export function Sidebar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, shop } = useAuth();

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
            // No query in the child link — it's the "all" view; active when no
            // status filter is set on the parent route
            return childBase === parentBase && !searchParams?.get('status');
        }
        const params = new URLSearchParams(childQuery);
        for (const [key, value] of params.entries()) {
            if (searchParams?.get(key) !== value) return false;
        }
        return true;
    };

    const fullName = user?.fullName || 'Хэрэглэгч';
    const initials = fullName
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const renderLink = (item: NavLink) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        const hasChildren = !!item.children?.length;

        return (
            <li key={item.href} className="px-3">
                <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                        'group/item relative flex items-center h-10 rounded-lg px-3 transition-colors',
                        active
                            ? 'bg-white/[0.06] text-white'
                            : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85',
                    )}
                >
                    <Icon
                        className="h-[18px] w-[18px] shrink-0"
                        strokeWidth={active ? 2 : 1.7}
                    />
                    <span className="ml-3 text-[13.5px] font-medium tracking-[-0.01em] whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
                        {item.label}
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
                </Link>

                {/* Sub-items: only render in expanded state */}
                {hasChildren && active && (
                    <ul className="mt-1 ml-[26px] pl-3 border-l border-white/[0.06] flex flex-col gap-0.5 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[80ms]">
                        {item.children!.map((child) => {
                            const childActive = childIsActive(child.href, item.href);
                            return (
                                <li key={child.href}>
                                    <Link
                                        href={child.href}
                                        className={cn(
                                            'flex items-center h-8 rounded-md px-3 text-[12.5px] transition-colors whitespace-nowrap',
                                            childActive
                                                ? 'bg-white/[0.05] text-white font-medium'
                                                : 'text-white/45 hover:text-white/80 hover:bg-white/[0.03]',
                                        )}
                                    >
                                        <span className="flex-1">{child.label}</span>
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
    };

    return (
        <aside
            className={cn(
                'group/rail fixed left-0 top-0 z-50 hidden md:flex h-screen flex-col',
                'w-[72px] hover:w-[248px] transition-[width] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]',
                'bg-[#0d0d14] border-r border-white/[0.05]',
                'overflow-hidden',
            )}
            role="navigation"
            aria-label="Үндсэн навигаци"
        >
            {/* ── Brand header ─────────────────────────── */}
            <div className="flex items-center h-14 px-4 shrink-0">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-[#4A7CE7] to-[#8B5CF6] shrink-0">
                    <Image
                        src="/logo.png"
                        alt="Syncly"
                        width={20}
                        height={20}
                        className="opacity-95"
                    />
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
                        placeholder="Хайх..."
                        className="ml-2.5 flex-1 bg-transparent text-[12.5px] text-white/70 placeholder:text-white/30 outline-none whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]"
                    />
                </div>
            </div>

            {/* ── Sections ────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pb-3">
                <SectionLabel>Workspace</SectionLabel>
                <ul className="flex flex-col gap-0.5">{WORKSPACE.map(renderLink)}</ul>

                <div className="mt-5">
                    <SectionLabel>Insights</SectionLabel>
                    <ul className="flex flex-col gap-0.5">{INSIGHTS.map(renderLink)}</ul>
                </div>
            </nav>

            {/* ── Footer ──────────────────────────────── */}
            <div className="border-t border-white/[0.05] p-3 shrink-0">
                <div className="flex items-center h-11 rounded-lg px-2 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-[11px] font-bold text-white shrink-0">
                        {initials || 'МД'}
                    </div>
                    <div className="ml-2.5 flex-1 min-w-0 opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
                        <div className="text-[12.5px] font-semibold text-white/90 truncate tracking-[-0.01em]">
                            {fullName}
                        </div>
                        <div className="text-[10.5px] text-white/40 truncate">
                            UB · {shop?.name || 'Shop'}
                        </div>
                    </div>
                    <Link
                        href="/dashboard/settings"
                        aria-label="Тохиргоо"
                        className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors opacity-0 group-hover/rail:opacity-100 delay-[40ms]"
                    >
                        <Settings className="h-[15px] w-[15px]" strokeWidth={1.8} />
                    </Link>
                </div>
            </div>
        </aside>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-6 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200 delay-[40ms]">
            {children}
        </div>
    );
}
