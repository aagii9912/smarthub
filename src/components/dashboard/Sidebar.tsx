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
    Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/hooks/useFeatures';
import { toast } from 'sonner';

interface MenuItem {
    name: string;
    href: string;
    icon: any;
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
    const { hasFeature, isPaidPlan, isProOrHigher, plan, usage, limits } = useFeatures();

    // Debug: log plan info
    if (typeof window !== 'undefined') {
        console.log('[Sidebar DEBUG] plan:', plan, 'isPaidPlan:', isPaidPlan, 'hasFeature cart:', hasFeature('cart_system'));
    }

    return (
        <aside
            className={`fixed left-0 top-0 h-screen bg-neutral-950 text-white transition-all duration-300 z-50 hidden md:flex flex-col ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-800">
                {!collapsed && (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
                            <span className="text-neutral-900 font-bold text-lg">S</span>
                        </div>
                        <span className="font-semibold text-lg text-white">
                            Syncly
                        </span>
                    </div>
                )}
                {collapsed && (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center mx-auto">
                        <span className="text-neutral-900 font-bold text-lg">S</span>
                    </div>
                )}
            </div>

            {/* Shop Status */}
            {!collapsed && shop && (
                <div className="mx-3 mt-4 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                    <div className="flex items-center gap-2 text-sm">
                        {shop.facebook_page_id ? (
                            <>
                                <div className="w-2 h-2 bg-gold rounded-full"></div>
                                <span className="text-gold text-xs">Chatbot active</span>
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
                            className="mt-2 flex items-center gap-1 text-xs text-gold hover:text-gold-light"
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
                        // Features with locks: cart_system, crm_analytics
                        // Allow access if:
                        // 1. No feature requirement, OR
                        // 2. hasFeature returns true, OR  
                        // 3. User is on any paid plan (multiple checks)
                        // @ts-ignore
                        const featureEnabled = !item.feature || hasFeature(item.feature);
                        // Check if user is on a paid plan using multiple methods
                        const isOnPaidPlan = (plan?.slug && plan.slug !== 'free') || isPaidPlan;
                        const hasCartOrReportsFeature = item.feature === 'cart_system' || item.feature === 'crm_analytics';
                        // Never lock cart/reports for paid plan users
                        const isLocked = hasCartOrReportsFeature ? (!featureEnabled && !isOnPaidPlan) : !featureEnabled;

                        const LinkContent = (
                            <>
                                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-white'
                                    }`} />
                                {!collapsed && (
                                    <div className="flex-1 flex items-center justify-between">
                                        <span className="font-medium text-sm">{item.name}</span>
                                        {isLocked && <Lock className="w-3 h-3 text-neutral-500" />}
                                    </div>
                                )}
                            </>
                        );

                        if (isLocked) {
                            return (
                                <li key={item.name}>
                                    <button
                                        onClick={() => {
                                            toast.error(`This feature requires a higher plan`, {
                                                action: {
                                                    label: 'Upgrade',
                                                    onClick: () => window.location.href = '/dashboard/subscription'
                                                }
                                            });
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-neutral-400 hover:bg-neutral-800 cursor-not-allowed opacity-70"
                                    >
                                        {LinkContent}
                                    </button>
                                </li>
                            );
                        }

                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    data-tour={item.tour}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-gold text-neutral-900 font-medium'
                                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                                        }`}
                                >
                                    {LinkContent}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Pro Badge - Only show if on Free/Trial plans */}
            {!collapsed && !isPaidPlan && (
                <div className="mx-3 mb-4 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold text-sm">Syncly</span>
                        <span className="px-2 py-0.5 bg-gold text-neutral-900 text-xs font-bold rounded">Starter</span>
                    </div>
                    <ul className="text-xs text-neutral-400 space-y-1">
                        <li>• Basic analytics</li>
                        <li>• AI-assistant</li>
                        <li>• Email support</li>
                    </ul>
                    <div className="mt-3 text-gold font-semibold text-sm">
                        ₮149,000 / month
                    </div>
                    <Link href="/dashboard/subscription">
                        <button className="w-full mt-3 py-2 bg-gold text-neutral-900 font-semibold rounded-lg text-sm hover:bg-gold-light transition-colors">
                            Upgrade now
                        </button>
                    </Link>
                </div>
            )}

            {!collapsed && isPaidPlan && (
                <div className="mx-3 mb-4 p-4 bg-neutral-900 rounded-lg border border-gold/30">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-sm">Current Plan</span>
                        <span className="px-2 py-0.5 bg-gold text-neutral-900 text-xs font-bold rounded uppercase">{plan.slug}</span>
                    </div>

                    {/* Message Usage */}
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                            <span>Messages</span>
                            <span>
                                {usage?.messages_count || 0} / {
                                    limits?.max_messages === -1
                                        ? '∞'
                                        : (limits?.max_messages || 0)
                                }
                            </span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gold rounded-full transition-all duration-500"
                                style={{
                                    width: `${limits?.max_messages === -1 ? 5 : Math.min(
                                        ((usage?.messages_count || 0) / (limits?.max_messages || 1)) * 100,
                                        100
                                    )}%`
                                }}
                            />
                        </div>
                    </div>

                    <Link href="/dashboard/subscription" className="text-xs text-gold hover:text-gold-light hover:underline">
                        Manage subscription
                    </Link>
                </div>
            )}

            {/* Bottom Menu */}
            <div className="px-3 pb-4 border-t border-neutral-800 pt-4">
                <ul className="space-y-1">
                    {bottomMenuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-neutral-800 text-gold'
                                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
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
                className="absolute bottom-20 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors"
            >
                {collapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
            </button>
        </aside>
    );
}
