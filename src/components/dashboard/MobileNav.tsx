'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    BarChart3,
    Menu,
    X,
    Users,
    Settings,
    Bot,
    CreditCard,
    AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryNavItems = [
    { name: 'Нүүр', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Захиалга', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Тайлан', href: '/dashboard/reports', icon: BarChart3 },
];

const secondaryNavItems = [
    { name: 'Бүтээгдэхүүн', href: '/dashboard/products', icon: Package },
    { name: 'Харилцагч', href: '/dashboard/customers', icon: Users },
    { name: 'Гомдол', href: '/dashboard/complaints', icon: AlertTriangle },
    { name: 'Сагс', href: '/dashboard/inbox', icon: ShoppingCart },
    { name: 'AI Тохиргоо', href: '/dashboard/ai-settings', icon: Bot },
    { name: 'Төлбөр', href: '/dashboard/subscription', icon: CreditCard },
    { name: 'Тохиргоо', href: '/dashboard/settings', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();
    const [showMore, setShowMore] = useState(false);

    const isActiveItem = (href: string) => {
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    };

    const isMoreActive = secondaryNavItems.some((item) => isActiveItem(item.href));

    return (
        <>
            {/* More Menu Overlay */}
            {showMore && (
                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                    <div
                        className="absolute bottom-20 left-3 right-3 rounded-2xl overflow-hidden animate-fade-in-up bg-[#1a1a20]/90 backdrop-blur-2xl border border-white/[0.08] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-2">
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="font-bold text-foreground text-sm tracking-[-0.03em]">Бусад</span>
                                <button
                                    onClick={() => setShowMore(false)}
                                    className="p-2 rounded-xl hover:bg-[#151040] transition-colors"
                                >
                                    <X className="w-4 h-4 text-white/40" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 p-3 pt-0">
                                {secondaryNavItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setShowMore(false)}
                                        className={cn(
                                            'flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all duration-200',
                                            isActiveItem(item.href)
                                                ? 'bg-gradient-to-b from-blue-500/10 to-violet-500/5 text-foreground border border-blue-500/20'
                                                : 'hover:bg-[#0F0B2E] text-white/40'
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                'w-5 h-5',
                                                isActiveItem(item.href) && 'text-blue-500'
                                            )}
                                            strokeWidth={isActiveItem(item.href) ? 2 : 1.5}
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

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-3 left-3 right-3 z-50 block md:hidden">
                <div className="bg-[#141418]/70 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-lg">
                    <ul className="flex justify-around items-stretch h-[58px]">
                        {primaryNavItems.map((item) => {
                            const isActive = isActiveItem(item.href);
                            return (
                                <li key={item.href} className="flex-1">
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-90',
                                            isActive ? 'text-foreground' : 'text-white/30'
                                        )}
                                    >
                                        <div className="relative">
                                            {isActive && (
                                                <span className="absolute inset-[-6px] bg-blue-500/10 rounded-xl" />
                                            )}
                                            <item.icon
                                                className={cn('w-5 h-5 relative', isActive && 'text-blue-500')}
                                                strokeWidth={isActive ? 2 : 1.5}
                                            />
                                        </div>
                                        <span className={cn(
                                            'text-[10px] tracking-[-0.01em]',
                                            isActive ? 'font-bold text-blue-600 text-blue-400' : 'font-medium'
                                        )}>
                                            {item.name}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}

                        {/* More Button */}
                        <li className="flex-1">
                            <button
                                onClick={() => setShowMore(!showMore)}
                                className={cn(
                                    'flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-90',
                                    showMore || isMoreActive ? 'text-foreground' : 'text-white/30'
                                )}
                            >
                                <div className="relative">
                                    {(showMore || isMoreActive) && (
                                        <span className="absolute inset-[-6px] bg-blue-500/10 rounded-xl" />
                                    )}
                                    <Menu
                                        className={cn('w-5 h-5 relative', (showMore || isMoreActive) && 'text-blue-500')}
                                        strokeWidth={showMore || isMoreActive ? 2 : 1.5}
                                    />
                                </div>
                                <span className={cn(
                                    'text-[10px] tracking-[-0.01em]',
                                    (showMore || isMoreActive) ? 'font-bold text-blue-600 text-blue-400' : 'font-medium'
                                )}>
                                    Бусад
                                </span>
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>
        </>
    );
}
