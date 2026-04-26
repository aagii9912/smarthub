'use client';

/**
 * MobileNav — Mobile V1 "Glass pill"
 *
 * Floating dark glass pill at the bottom of the screen with 4 tabs.
 * The active tab expands (flex 2.4) and reveals an indigo→violet gradient
 * pill containing both icon and label. Inactive tabs collapse to icon-only.
 *
 * Reference: 01-syncly-nav.png
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Inbox, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileTab {
    id: string;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const TABS: MobileTab[] = [
    { id: 'home', label: 'Нүүр', href: '/dashboard', icon: Home },
    { id: 'orders', label: 'Захиалга', href: '/dashboard/orders', icon: Package },
    { id: 'chat', label: 'Чат', href: '/dashboard/inbox', icon: Inbox },
    { id: 'reports', label: 'Тайлан', href: '/dashboard/reports', icon: LineChart },
];

export function MobileNav() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
        return pathname === href || (pathname?.startsWith(href + '/') ?? false);
    };

    return (
        <nav
            aria-label="Үндсэн навигаци"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {/* Glass pill container */}
            <ul
                className={cn(
                    'flex items-stretch gap-1 p-1.5',
                    'rounded-full',
                    'bg-[#1a1a20]/85 backdrop-blur-2xl',
                    'border border-white/[0.06]',
                    'shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]',
                    'min-w-[280px]',
                )}
            >
                {TABS.map((tab) => {
                    const active = isActive(tab.href);
                    const Icon = tab.icon;

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
                                aria-label={tab.label}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'group relative flex items-center justify-center gap-2 h-11 w-full',
                                    'rounded-full transition-all duration-300 ease-out',
                                    'active:scale-95',
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
                                        {tab.label}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
