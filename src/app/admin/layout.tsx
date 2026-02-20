'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import {
    LayoutDashboard, Users, CreditCard, Package,
    FileText, Settings, LogOut, ChevronRight, Menu, X, Globe
} from 'lucide-react';

const isDev = process.env.NODE_ENV === 'development';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/shops', label: 'Shops', icon: Users },
    { href: '/admin/plans', label: 'Plans', icon: Package },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { href: '/admin/invoices', label: 'Invoices', icon: FileText },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/admin/landing', label: 'Landing Page', icon: Globe },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { isSignedIn, isLoaded } = useAuth();
    const [loading, setLoading] = useState(true);
    const [admin, setAdmin] = useState<{ email: string; role: string } | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Allow login page to render without auth check
    const isLoginPage = pathname?.startsWith('/admin/login');

    useEffect(() => {
        if (isLoginPage) {
            setLoading(false);
            return;
        }

        if (!isLoaded) return;

        if (!isSignedIn) {
            router.push('/admin/login');
            return;
        }

        // Check if user is admin
        checkAdmin();
    }, [isLoaded, isSignedIn, isLoginPage]);

    async function checkAdmin() {
        try {
            const res = await fetch('/api/admin/dashboard', {
                credentials: 'include',
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (res.ok) {
                const data = await res.json();
                if (isDev) console.log('Admin verified:', data.admin?.email);
                setAdmin(data.admin);
            } else {
                if (isDev) console.log('Not an admin, redirecting');
                // Not an admin - redirect to regular dashboard
                router.push('/dashboard');
            }
        } catch (error) {
            if (isDev) console.error('Admin check error:', error);
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    }

    // Login page renders without layout
    if (isLoginPage) {
        return <>{children}</>;
    }

    if (loading || !isLoaded) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!admin) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-violet-100 selection:text-violet-900">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40 lg:hidden transition-all"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-100 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.05)]
                transform transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 flex flex-col
            `}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-50/80">
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 tracking-tight">
                        Syncle Admin
                    </span>
                    <button
                        className="lg:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    <div className="mb-4 px-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Overview</p>
                    </div>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-violet-50 text-violet-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-violet-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                <span className="text-[15px]">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Admin info */}
                <div className="p-4 border-t border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm ring-2 ring-white">
                            {admin.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate leading-tight">{admin.email}</p>
                            <p className="text-xs text-gray-500 capitalize leading-tight mt-0.5">{admin.role.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <Link
                        href="/dashboard"
                        className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all shadow-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Exit Admin</span>
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64 flex flex-col min-h-screen">
                {/* Top bar */}
                <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.01)]">
                    <div className="flex items-center gap-3">
                        <button
                            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <div className="hidden sm:flex items-center gap-2 text-sm">
                            <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition-colors font-medium">Admin</Link>
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                            <span className="text-gray-900 font-semibold tracking-tight">
                                {navItems.find(n => pathname?.startsWith(n.href))?.label || 'Dashboard'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-gray-600">
                                {new Date().toLocaleDateString('mn-MN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
