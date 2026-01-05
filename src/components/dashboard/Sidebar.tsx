'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    MessageSquare,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from 'lucide-react';

const menuItems = [
    { name: 'Хянах самбар', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Бүтээгдэхүүн', href: '/dashboard/products', icon: Package },
    { name: 'Захиалга', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Харилцагчид', href: '/dashboard/customers', icon: Users },
    { name: 'Чат түүх', href: '/dashboard/chats', icon: MessageSquare },
    { name: 'Тайлан', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Тохиргоо', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    return (
        <aside
            className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 z-50 ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-bold text-xl bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                            SmartHub
                        </span>
                    </div>
                )}
                {collapsed && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg mx-auto">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="mt-6 px-3">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25'
                                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                    {!collapsed && <span className="font-medium">{item.name}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Collapse button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
            >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
        </aside>
    );
}
