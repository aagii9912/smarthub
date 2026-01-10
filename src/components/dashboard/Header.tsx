'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, LogOut, Settings, Store, ChevronDown } from 'lucide-react';
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

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Хэрэглэгч';
    const displayEmail = user?.email || '';

    return (
        <header className="h-14 md:h-16 bg-background/95 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-40">
            {/* Left: Shop name */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                {shop && (
                    <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 bg-secondary rounded-lg min-w-0">
                        <Store className="w-3.5 h-3.5 md:w-4 md:h-4 text-foreground flex-shrink-0" />
                        <span className="font-medium text-xs md:text-sm text-foreground truncate max-w-[100px] sm:max-w-none">{shop.name}</span>
                        {shop.facebook_page_id && (
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" title="Facebook холбогдсон"></span>
                        )}
                    </div>
                )}
            </div>

            {/* Center: Search (Hidden on mobile) */}
            <div className="hidden md:block flex-1 max-w-md mx-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Хайх..."
                        className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-transparent focus:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1 sm:gap-3">
                {/* Search Toggle (Mobile) */}
                <button className="md:hidden p-2 text-muted-foreground hover:bg-secondary rounded-xl transition-colors touch-target">
                    <Search className="w-5 h-5" />
                </button>

                {/* Push Notifications Toggle */}
                {/* Push Notifications - Temporarily disabled
                <NotificationButton /> 
                */}

                {/* Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-border hover:bg-secondary/50 rounded-lg transition-colors pr-1 sm:pr-2 py-1 touch-target"
                    >
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border">
                            <User className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="hidden sm:block text-left">
                            <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{displayName}</p>
                            <p className="text-xs text-muted-foreground">Эзэмшигч</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-64 bg-popover rounded-xl shadow-lg border border-border z-50 overflow-hidden text-popover-foreground">
                                <div className="p-4 border-b border-border">
                                    <p className="font-medium truncate">{displayName}</p>
                                    <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => {
                                            setShowDropdown(false);
                                            router.push('/setup');
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary rounded-lg transition-colors touch-target"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Дэлгүүр тохиргоо
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loggingOut}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors touch-target"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {loggingOut ? 'Гарч байна...' : 'Гарах'}
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
