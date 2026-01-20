'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Settings,
    ChevronLeft,
    ChevronRight,
    Facebook,
    HelpCircle,
    Bot,
    CreditCard,
    BarChart3,
    MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, tour: 'dashboard' },
    { name: 'Products', href: '/dashboard/products', icon: Package, tour: 'products' },
    { name: 'Orders', href: '/dashboard/orders', icon: ShoppingCart, tour: 'orders' },
    { name: 'Customers', href: '/dashboard/customers', icon: Users, tour: 'customers' },

    { name: 'AI Settings', href: '/dashboard/ai-settings', icon: Bot, tour: 'ai-settings' },
    { name: 'Payments', href: '/dashboard/subscription', icon: CreditCard, tour: 'payments' },
    { name: 'Customer Carts', href: '/dashboard/inbox', icon: ShoppingCart, tour: 'carts' },
    { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, tour: 'reports' },
];

const bottomMenuItems = [
    { name: 'Help', href: '/help', icon: HelpCircle },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { shop } = useAuth();

    return (
        <aside
            className={`fixed left-0 top-0 h-screen bg-[#111111] text-white transition-all duration-300 z-50 hidden md:flex flex-col ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-[#2a2d2b]">
                {!collapsed && (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#65c51a] flex items-center justify-center">
                            <span className="text-white font-bold text-lg">S</span>
                        </div>
                        <span className="font-semibold text-lg text-white">
                            Syncly
                        </span>
                    </div>
                )}
                {collapsed && (
                    <div className="w-9 h-9 rounded-lg bg-[#65c51a] flex items-center justify-center mx-auto">
                        <span className="text-white font-bold text-lg">S</span>
                    </div>
                )}
            </div>

            {/* Shop Status */}
            {!collapsed && shop && (
                <div className="mx-3 mt-4 p-3 bg-[#2a2d2b] rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                        {shop.facebook_page_id ? (
                            <>
                                <div className="w-2 h-2 bg-[#65c51a] rounded-full"></div>
                                <span className="text-[#65c51a] text-xs">Chatbot active</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                <span className="text-yellow-400 text-xs">FB not connected</span>
                            </>
                        )}
                    </div>
                    {!shop.facebook_page_id && (
                        <Link
                            href="/setup"
                            className="mt-2 flex items-center gap-1 text-xs text-[#65c51a] hover:text-[#7dd93a]"
                        >
                            <Facebook className="w-3 h-3" />
                            Connect
                        </Link>
                    )}
                </div>
            )}

            {/* Navigation */}
            <nav className="mt-6 px-3 flex-1">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    data-tour={item.tour}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-[#65c51a] text-white'
                                        : 'text-[#a1a1aa] hover:bg-[#2a2d2b] hover:text-white'
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#a1a1aa] group-hover:text-white'
                                        }`} />
                                    {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Pro Badge */}
            {!collapsed && (
                <div className="mx-3 mb-4 p-4 bg-[#2a2d2b] rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold text-sm">Syncly</span>
                        <span className="px-2 py-0.5 bg-[#65c51a] text-white text-xs font-medium rounded">Pro</span>
                    </div>
                    <ul className="text-xs text-[#a1a1aa] space-y-1">
                        <li>• Advanced analytics</li>
                        <li>• AI-assistant</li>
                        <li>• 24/7 support</li>
                    </ul>
                    <div className="mt-3 text-[#65c51a] font-semibold text-sm">
                        ₮99,000 / month
                    </div>
                    <Link href="/dashboard/subscription">
                        <button className="w-full mt-3 py-2 bg-[#65c51a] text-white font-medium rounded-lg text-sm hover:bg-[#56a816] transition-colors">
                            Upgrade now
                        </button>
                    </Link>
                </div>
            )}

            {/* Bottom Menu */}
            <div className="px-3 pb-4 border-t border-[#2a2d2b] pt-4">
                <ul className="space-y-1">
                    {bottomMenuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-[#2a2d2b] text-white'
                                        : 'text-[#a1a1aa] hover:bg-[#2a2d2b] hover:text-white'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span className="text-sm">{item.name}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Collapse button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#2a2d2b] hover:bg-[#3a3d3b] flex items-center justify-center transition-colors"
            >
                {collapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
            </button>
        </aside>
    );
}
