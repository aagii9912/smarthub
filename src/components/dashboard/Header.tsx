'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, LogOut, Settings, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth/supabase-auth';
import { NotificationButton } from '@/components/NotificationButton';

export function Header() {
    const router = useRouter();
    const { user, shop } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setLoggingOut(true);
        await signOut();
        router.push('/auth/login');
        router.refresh();
    };

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';

    return (
        <header className="h-14 md:h-16 bg-white border-b border-[#dee2e6] flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
            {/* Left: Page title or breadcrumb space */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* This space is for page-level content */}
            </div>

            {/* Center: Search */}
            <div className="flex-1 max-w-md mx-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c757d]" />
                    <input
                        type="text"
                        placeholder="Search"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#f1f3f5] border border-transparent focus:border-[#65c51a] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#65c51a]/20 transition-all placeholder:text-[#6c757d] text-[#111111]"
                    />
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                {/* Notifications */}
                <NotificationButton />

                {/* Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-3 hover:bg-[#f1f3f5] rounded-lg transition-colors px-2 py-1.5"
                    >
                        <div className="w-9 h-9 rounded-full bg-[#f1f3f5] flex items-center justify-center overflow-hidden border-2 border-[#dee2e6]">
                            <User className="w-5 h-5 text-[#6c757d]" />
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-[#111111] truncate max-w-[120px]">{displayName}</p>
                            <p className="text-xs text-[#6c757d]">Sales manager</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-[#6c757d] hidden md:block" />
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#dee2e6] z-50 overflow-hidden">
                                <div className="p-4 border-b border-[#dee2e6]">
                                    <p className="font-medium text-[#111111] truncate">{displayName}</p>
                                    <p className="text-sm text-[#6c757d] truncate">{displayEmail}</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => {
                                            setShowDropdown(false);
                                            router.push('/dashboard/settings');
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#111111] hover:bg-[#f1f3f5] rounded-lg transition-colors"
                                    >
                                        <Settings className="w-4 h-4 text-[#6c757d]" />
                                        Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loggingOut}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {loggingOut ? 'Logging out...' : 'Log out'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
