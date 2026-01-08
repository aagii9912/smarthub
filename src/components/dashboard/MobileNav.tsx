'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Menu, // For "More" tab
} from 'lucide-react';

const mobileNavItems = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Products', href: '/dashboard/products', icon: Package },
    { name: 'Menu', href: '/dashboard/menu', icon: Menu }, // Replaced 'More' with 'Menu' linking to a menu page or triggering a drawer
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-safe block md:hidden">
            <ul className="flex justify-around items-center h-16">
                {mobileNavItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                        <li key={item.name} className="flex-1">
                            <Link
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 pt-2 pb-2 transition-colors ${isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-primary'
                                    }`}
                            >
                                <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : 'stroke-current'}`} strokeWidth={isActive ? 0 : 2} />
                                <span className="text-[10px] font-medium">{item.name}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
