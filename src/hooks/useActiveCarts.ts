'use client';

import { useQuery } from '@tanstack/react-query';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
}

export interface ActiveCart {
    id: string; // Customer ID
    cartId: string;
    customer: {
        id: string;
        name: string;
        facebookId?: string;
        isVip?: boolean;
    };
    lastActive: string;
    itemCount: number;
    totalAmount: number;
    items: CartItem[];
}

async function fetchActiveCarts(): Promise<ActiveCart[]> {
    const res = await fetch('/api/dashboard/active-carts');
    if (!res.ok) {
        throw new Error('Failed to fetch active carts');
    }
    const data = await res.json();
    return data.carts || [];
}

export function useActiveCarts() {
    return useQuery({
        queryKey: ['active-carts'],
        queryFn: fetchActiveCarts,
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // Refetch every minute
    });
}
