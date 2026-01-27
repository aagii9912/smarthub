'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    { name: 'Сагс', href: '/dashboard/inbox', icon: ShoppingCart },
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
            <AnimatePresence>
                {showMore && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 md:hidden"
                        onClick={() => setShowMore(false)}
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-[80px] left-4 right-4 rounded-2xl shadow-2xl overflow-hidden"
                            style={{
                                background: 'rgba(24, 24, 27, 0.95)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-2">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
                                    <span className="font-semibold text-white">Бусад</span>
                                    <button
                                        onClick={() => setShowMore(false)}
                                        className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-zinc-400" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 p-3">
                                    {secondaryNavItems.map((item, index) => (
                                        <motion.div
                                            key={item.name}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Link
                                                href={item.href}
                                                onClick={() => setShowMore(false)}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${isActiveItem(item.href)
                                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                                        : 'hover:bg-zinc-800 text-zinc-400'
                                                    }`}
                                            >
                                                <item.icon className="w-6 h-6" />
                                                <span className="text-xs font-medium text-center">{item.name}</span>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Navigation */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 pb-safe block md:hidden"
                style={{
                    background: 'rgba(10, 10, 10, 0.9)',
                    backdropFilter: 'blur(20px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
            >
                <ul className="flex justify-around items-stretch h-[72px]">
                    {primaryNavItems.map((item) => {
                        const isActive = isActiveItem(item.href);
                        return (
                            <li key={item.name} className="flex-1">
                                <Link
                                    href={item.href}
                                    className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-all active:scale-95 ${isActive ? 'text-indigo-400' : 'text-zinc-500'
                                        }`}
                                >
                                    <motion.div
                                        className={`p-2 rounded-xl transition-all ${isActive ? 'bg-indigo-500/20' : ''}`}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <item.icon
                                            className="w-6 h-6"
                                            strokeWidth={isActive ? 2.5 : 2}
                                        />
                                    </motion.div>
                                    <span className={`text-xs font-medium ${isActive ? 'text-indigo-400' : ''}`}>
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
                            className={`flex flex-col items-center justify-center w-full h-full gap-1.5 transition-all active:scale-95 ${showMore || isMoreActive ? 'text-indigo-400' : 'text-zinc-500'
                                }`}
                        >
                            <motion.div
                                className={`p-2 rounded-xl transition-all ${showMore || isMoreActive ? 'bg-indigo-500/20' : ''}`}
                                whileTap={{ scale: 0.9 }}
                            >
                                <Menu className="w-6 h-6" strokeWidth={showMore || isMoreActive ? 2.5 : 2} />
                            </motion.div>
                            <span className={`text-xs font-medium ${showMore || isMoreActive ? 'text-indigo-400' : ''}`}>
                                Бусад
                            </span>
                        </button>
                    </li>
                </ul>
            </nav>
        </>
    );
}
