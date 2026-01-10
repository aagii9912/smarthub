'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users, // Customers icon
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
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border pb-safe block md:hidden shadow-lg">
            <ul className="flex justify-around items-center h-16">
                {mobileNavItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                        <li key={item.name} className="flex-1">
                            <Link
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 pt-2 pb-2 transition-all duration-200 tap-feedback touch-target ${isActive
                                    ? 'text-primary scale-105'
                                    : 'text-muted-foreground hover:text-foreground active:text-primary'
                                    }`}
                            >
                                <item.icon
                                    className={`w-6 h-6 transition-all duration-200 ${isActive ? 'fill-current scale-110' : 'stroke-current'}`}
                                    strokeWidth={isActive ? 0 : 2}
                                />
                                <span className={`text-[10px] font-medium transition-all duration-200 ${isActive ? 'font-semibold' : ''}`}>
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
