'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { InboxConversation } from './types';

interface InboxContextValue {
    conversations: InboxConversation[];
    loading: boolean;
    error: string | null;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    refreshConversations: () => Promise<void>;
    patchConversation: (
        customerId: string,
        patch: Partial<InboxConversation>
    ) => void;
    shopId: string;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function useInbox(): InboxContextValue {
    const ctx = useContext(InboxContext);
    if (!ctx) {
        throw new Error('useInbox must be used inside <InboxProvider>');
    }
    return ctx;
}

export function InboxProvider({ children }: { children: React.ReactNode }) {
    const [conversations, setConversations] = useState<InboxConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [shopId, setShopId] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setShopId(localStorage.getItem('smarthub_active_shop_id') || '');
        }
    }, []);

    const refreshConversations = useCallback(async () => {
        if (!shopId) {
            setLoading(false);
            return;
        }
        try {
            setError(null);
            const res = await fetch('/api/dashboard/conversations', {
                headers: { 'x-shop-id': shopId },
            });
            if (!res.ok) {
                throw new Error('Failed to fetch conversations');
            }
            const data = await res.json();
            setConversations((data.conversations || []) as InboxConversation[]);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [shopId]);

    useEffect(() => {
        if (shopId) {
            void refreshConversations();
        }
    }, [shopId, refreshConversations]);

    const patchConversation = useCallback(
        (customerId: string, patch: Partial<InboxConversation>) => {
            setConversations((prev) =>
                prev.map((c) => (c.id === customerId ? { ...c, ...patch } : c))
            );
        },
        []
    );

    const value = useMemo<InboxContextValue>(
        () => ({
            conversations,
            loading,
            error,
            searchQuery,
            setSearchQuery,
            refreshConversations,
            patchConversation,
            shopId,
        }),
        [conversations, loading, error, searchQuery, refreshConversations, patchConversation, shopId]
    );

    return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}
