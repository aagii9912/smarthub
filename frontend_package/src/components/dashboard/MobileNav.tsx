'use client';

import React, { useState } from 'react';
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
    Megaphone,
    Bot,
    CreditCard,
    FileText,
} from 'lucide-react';

// Main nav items (4 essential)
const primaryNavItems = [
    { name: 'Нүүр', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Захиалга', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Тайлан', href: '/dashboard/reports', icon: BarChart3 },
];

// Secondary nav items (in More menu)
const secondaryNavItems = [
    { name: 'Бүтээгдэхүүн', href: '/dashboard/products', icon: Package },
    { name: 'Харилцагч', href: '/dashboard/customers', icon: Users },
    { name: 'Маркетинг', href: '/dashboard/marketing', icon: Megaphone },
    { name: 'AI Тохиргоо', href: '/dashboard/ai-settings', icon: Bot },
    { name: 'Захиалга', href: '/dashboard/subscription', icon: CreditCard },
    { name: 'Тохиргоо', href: '/dashboard/settings', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();
    const [showMore, setShowMore] = useState(false);

    const isActiveItem = (href: string) => {
        return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    };

    const isMoreActive = secondaryNavItems.some(item => isActiveItem(item.href));

    return (
        <>
            {/* More Menu Overlay */}
            {showMore && (
                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div
                        className="absolute bottom-[72px] left-4 right-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-2">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <span className="font-semibold text-gray-900">Бусад</span>
                                <button
                                    onClick={() => setShowMore(false)}
                                    className="p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 p-3">
                                {secondaryNavItems.map((item) => (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setShowMore(false)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${isActiveItem(item.href)
                                                ? 'bg-[#65c51a]/10 text-[#65c51a]'
                                                : 'hover:bg-gray-50 text-gray-600'
                                            }`}
                                    >
                                        <item.icon className="w-6 h-6" />
                                        <span className="text-xs font-medium text-center">{item.name}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe block md:hidden">
                <ul className="flex justify-around items-stretch h-[72px]">
                    {primaryNavItems.map((item) => {
                        const isActive = isActiveItem(item.href);
                        return (
                            <li key={item.name} className="flex-1">
                                <Link
                                    href={item.href}
                                    className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-all active:scale-95 ${isActive
                                            ? 'text-[#65c51a]'
                                            : 'text-gray-500'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-[#65c51a]/10' : ''}`}>
                                        <item.icon
                                            className="w-6 h-6"
                                            strokeWidth={isActive ? 2.5 : 2}
                                        />
                                    </div>
                                    <span className={`text-xs font-medium ${isActive ? 'text-[#65c51a]' : ''}`}>
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
                            className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-all active:scale-95 ${showMore || isMoreActive
                                    ? 'text-[#65c51a]'
                                    : 'text-gray-500'
                                }`}
                        >
                            <div className={`p-2 rounded-xl transition-all ${showMore || isMoreActive ? 'bg-[#65c51a]/10' : ''}`}>
                                <Menu className="w-6 h-6" strokeWidth={showMore || isMoreActive ? 2.5 : 2} />
                            </div>
                            <span className={`text-xs font-medium ${showMore || isMoreActive ? 'text-[#65c51a]' : ''}`}>
                                Бусад
                            </span>
                        </button>
                    </li>
                </ul>
            </nav>
        </>
    );
}
