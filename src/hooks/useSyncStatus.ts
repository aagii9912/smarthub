'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type SyncStatus = 'connected' | 'connecting' | 'disconnected' | 'syncing';

interface SyncState {
    status: SyncStatus;
    lastSyncTime: Date | null;
    error: string | null;
}

/**
 * Hook to track realtime sync connection status
 * Used by Header to show connection indicator
 */
export function useSyncStatus() {
    const { shop } = useAuth();
    const [state, setState] = useState<SyncState>({
        status: 'connecting',
        lastSyncTime: null,
        error: null,
    });

    useEffect(() => {
        if (!shop?.id) {
            setState(prev => ({ ...prev, status: 'disconnected' }));
            return;
        }

        // Create a health check channel
        const channel = supabase
            .channel(`sync-status-${shop.id}`)
            .on('system', { event: 'SUBSCRIBED' }, () => {
                setState({
                    status: 'connected',
                    lastSyncTime: new Date(),
                    error: null,
                });
            })
            .on('system', { event: 'CHANNEL_ERROR' }, (error) => {
                setState({
                    status: 'disconnected',
                    lastSyncTime: null,
                    error: error?.message || 'Connection error',
                });
            })
            .on('system', { event: 'CLOSED' }, () => {
                setState(prev => ({ ...prev, status: 'disconnected' }));
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setState(prev => ({
                        ...prev,
                        status: 'connected',
                        lastSyncTime: new Date()
                    }));
                } else if (status === 'CHANNEL_ERROR') {
                    setState(prev => ({ ...prev, status: 'disconnected' }));
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shop?.id]);

    const markAsSyncing = useCallback(() => {
        setState(prev => ({ ...prev, status: 'syncing' }));
        // Auto-reset to connected after 1 second
        setTimeout(() => {
            setState(prev => ({
                ...prev,
                status: 'connected',
                lastSyncTime: new Date()
            }));
        }, 1000);
    }, []);

    return {
        ...state,
        markAsSyncing,
        isConnected: state.status === 'connected' || state.status === 'syncing',
    };
}
