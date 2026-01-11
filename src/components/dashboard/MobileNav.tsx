'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
} from 'lucide-react';

const mobileNavItems = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Products', href: '/dashboard/products', icon: Package },
    { name: 'Customers', href: '/dashboard/customers', icon: Users },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#111111] border-t border-[#2a2d2b] pb-safe block md:hidden">
            <ul className="flex justify-around items-center h-16">
                {mobileNavItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                        <li key={item.name} className="flex-1">
                            <Link
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 pt-2 pb-2 transition-all duration-200 ${isActive
                                    ? 'text-[#65c51a]'
                                    : 'text-[#a1a1aa]'
                                    }`}
                            >
                                <item.icon
                                    className={`w-6 h-6 transition-all duration-200 ${isActive ? 'text-[#65c51a]' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                />
                                <span className={`text-[10px] font-medium ${isActive ? 'font-semibold text-[#65c51a]' : 'text-[#a1a1aa]'}`}>
                                    {item.name}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
