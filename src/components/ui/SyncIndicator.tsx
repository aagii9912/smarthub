'use client';

import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Clock } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';

/**
 * Enhanced Sync Status Indicator
 * Shows real-time connection status with animations and tooltip
 */
export function SyncIndicator() {
    const { status, isConnected, lastSyncTime } = useSyncStatus();
    const [showTooltip, setShowTooltip] = useState(false);

    const getStatusInfo = () => {
        switch (status) {
            case 'connected':
                return {
                    icon: Wifi,
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-500/10',
                    label: 'Холбогдсон',
                    description: 'Realtime sync идэвхтэй'
                };
            case 'syncing':
                return {
                    icon: RefreshCw,
                    color: 'text-blue-500',
                    bgColor: 'bg-blue-500/10',
                    label: 'Синк хийж байна...',
                    description: 'Өгөгдөл шинэчлэгдэж байна',
                    animate: true
                };
            case 'connecting':
                return {
                    icon: RefreshCw,
                    color: 'text-yellow-500',
                    bgColor: 'bg-yellow-500/10',
                    label: 'Холбогдож байна...',
                    description: 'Server-тэй холбогдож байна',
                    animate: true
                };
            case 'disconnected':
            default:
                return {
                    icon: WifiOff,
                    color: 'text-red-400',
                    bgColor: 'bg-red-400/10',
                    label: 'Холбогдоогүй',
                    description: 'Offline горимд ажиллаж байна'
                };
        }
    };

    const statusInfo = getStatusInfo();
    const Icon = statusInfo.icon;

    const formatLastSync = () => {
        if (!lastSyncTime) return 'Мэдээлэл байхгүй';
        const now = new Date();
        const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);

        if (diff < 10) return 'Дөнгөж сая';
        if (diff < 60) return `${diff} секундын өмнө`;
        if (diff < 3600) return `${Math.floor(diff / 60)} минутын өмнө`;
        return lastSyncTime.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="relative">
            <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className={`hidden sm:flex items-center justify-center w-9 h-9 rounded-xl ${statusInfo.bgColor} hover:scale-105 transition-all duration-200`}
            >
                <Icon
                    className={`w-4 h-4 ${statusInfo.color} ${statusInfo.animate ? 'animate-spin' : ''}`}
                    style={statusInfo.animate ? { animationDuration: '1.5s' } : undefined}
                />
            </button>

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                    <div className={`px-4 py-3 ${statusInfo.bgColor} border-b border-gray-100 dark:border-gray-700`}>
                        <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${statusInfo.color}`} />
                            <span className={`font-medium text-sm ${statusInfo.color}`}>
                                {statusInfo.label}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {statusInfo.description}
                        </p>
                    </div>
                    <div className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>Сүүлд sync: {formatLastSync()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
