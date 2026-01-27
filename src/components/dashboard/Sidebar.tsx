'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    Lock,
    Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/hooks/useFeatures';
import { toast } from 'sonner';

interface MenuItem {
    name: string;
    href: string;
    icon: React.ElementType;
    tour: string;
    feature?: string;
}

const menuItems: MenuItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, tour: 'dashboard' },
    { name: 'Products', href: '/dashboard/products', icon: Package, tour: 'products' },
    { name: 'Orders', href: '/dashboard/orders', icon: ShoppingCart, tour: 'orders' },
    { name: 'Customers', href: '/dashboard/customers', icon: Users, tour: 'customers' },
    { name: 'AI Settings', href: '/dashboard/ai-settings', icon: Bot, tour: 'ai-settings' },
    { name: 'Payments', href: '/dashboard/subscription', icon: CreditCard, tour: 'payments' },
    { name: 'Customer Carts', href: '/dashboard/inbox', icon: ShoppingCart, tour: 'carts', feature: 'cart_system' },
    { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, tour: 'reports', feature: 'crm_analytics' },
];

const bottomMenuItems = [
    { name: 'Help', href: '/help', icon: HelpCircle },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { shop } = useAuth();
    const { hasFeature, isPaidPlan, plan, usage, limits } = useFeatures();

    return (
        <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed left-0 top-0 h-screen transition-all duration-300 z-50 hidden md:flex flex-col ${collapsed ? 'w-20' : 'w-64'
                }`}
            style={{
                background: 'linear-gradient(180deg, rgba(24, 24, 27, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(255, 255, 255, 0.06)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800/50">
                <AnimatePresence mode="wait">
                    {!collapsed ? (
                        <motion.div
                            key="full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3"
                        >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <span className="text-white font-bold text-lg">S</span>
                            </div>
                            <span className="font-semibold text-lg bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                                SmartHub
                            </span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20"
                        >
                            <span className="text-white font-bold text-lg">S</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Shop Status */}
            <AnimatePresence>
                {!collapsed && shop && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-3 mt-4"
                    >
                        <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                            <div className="flex items-center gap-2 text-sm">
                                {shop.facebook_page_id ? (
                                    <>
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                        <span className="text-emerald-400 text-xs">Chatbot active</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 bg-amber-400 rounded-full" />
                                        <span className="text-amber-400 text-xs">FB not connected</span>
                                    </>
                                )}
                            </div>
                            {!shop.facebook_page_id && (
                                <Link
                                    href="/setup"
                                    className="mt-2 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    <Facebook className="w-3 h-3" />
                                    Connect
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation */}
            <nav className="mt-6 px-3 flex-1 overflow-y-auto no-scrollbar">
                <ul className="space-y-1">
                    {menuItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        // @ts-ignore
                        const isLocked = item.feature && !hasFeature(item.feature);

                        const LinkContent = (
                            <>
                                <item.icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
                                    }`} />
                                {!collapsed && (
                                    <div className="flex-1 flex items-center justify-between">
                                        <span className={`font-medium text-sm transition-colors ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                                            }`}>
                                            {item.name}
                                        </span>
                                        {isLocked && <Lock className="w-3 h-3 text-zinc-600" />}
                                    </div>
                                )}
                            </>
                        );

                        if (isLocked) {
                            return (
                                <motion.li
                                    key={item.name}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <button
                                        onClick={() => {
                                            toast.error(`This feature requires a higher plan`, {
                                                action: {
                                                    label: 'Upgrade',
                                                    onClick: () => window.location.href = '/dashboard/subscription'
                                                }
                                            });
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-zinc-500 hover:bg-zinc-800/50 cursor-not-allowed opacity-60"
                                    >
                                        {LinkContent}
                                    </button>
                                </motion.li>
                            );
                        }

                        return (
                            <motion.li
                                key={item.name}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Link
                                    href={item.href}
                                    data-tour={item.tour}
                                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                            ? 'text-white'
                                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                                        }`}
                                >
                                    {/* Active indicator */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-3">
                                        {LinkContent}
                                    </span>
                                </Link>
                            </motion.li>
                        );
                    })}
                </ul>
            </nav>

            {/* Pro Badge - Only show if on Free/Trial plans */}
            <AnimatePresence>
                {!collapsed && !isPaidPlan && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mx-3 mb-4"
                    >
                        <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800/50 relative overflow-hidden">
                            {/* Glow effect */}
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl" />

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    <span className="text-white font-semibold text-sm">Upgrade to Pro</span>
                                </div>
                                <ul className="text-xs text-zinc-500 space-y-1">
                                    <li>• Unlimited AI messages</li>
                                    <li>• Advanced analytics</li>
                                    <li>• Priority support</li>
                                </ul>
                                <Link href="/dashboard/subscription">
                                    <button className="w-full mt-3 py-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20">
                                        Upgrade now
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!collapsed && isPaidPlan && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-3 mb-4"
                >
                    <div className="p-4 rounded-xl bg-zinc-900/50 border border-indigo-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm">Current Plan</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full uppercase">
                                {plan.slug}
                            </span>
                        </div>

                        {/* Message Usage */}
                        <div className="mb-3">
                            <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                <span>Messages</span>
                                <span>
                                    {usage?.messages_count || 0} / {
                                        limits?.max_messages === -1
                                            ? '∞'
                                            : (limits?.max_messages || 0)
                                    }
                                </span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${limits?.max_messages === -1 ? 5 : Math.min(
                                            ((usage?.messages_count || 0) / (limits?.max_messages || 1)) * 100,
                                            100
                                        )}%`
                                    }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                />
                            </div>
                        </div>

                        <Link href="/dashboard/subscription" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            Manage subscription
                        </Link>
                    </div>
                </motion.div>
            )}

            {/* Bottom Menu */}
            <div className="px-3 pb-4 border-t border-zinc-800/50 pt-4">
                <ul className="space-y-1">
                    {bottomMenuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group ${isActive
                                            ? 'bg-zinc-800/50 text-indigo-400'
                                            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
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
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCollapsed(!collapsed)}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors border border-zinc-700"
            >
                {collapsed ? <ChevronRight className="w-4 h-4 text-zinc-400" /> : <ChevronLeft className="w-4 h-4 text-zinc-400" />}
            </motion.button>
        </motion.aside>
    );
}
