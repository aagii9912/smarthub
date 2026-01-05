'use client';

import React from 'react';
import { Bell, Search, User } from 'lucide-react';

export function Header() {
    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6">
            {/* Search */}
            <div className="flex-1 max-w-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Хайх..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Profile */}
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="hidden sm:block">
                        <p className="text-sm font-medium text-gray-900">Админ</p>
                        <p className="text-xs text-gray-500">Эзэмшигч</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
