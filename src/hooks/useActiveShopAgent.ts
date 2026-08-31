'use client';

import { useEffect, useState } from 'react';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { BusinessType } from '@/lib/constants/business-types';

interface ActiveShopAgent {
    role: AgentRole;
    capabilities: AgentCapability[];
    businessType: BusinessType | null;
    /**
     * `business_setup_data.category` for a realestate_auto shop:
     * 'realestate' | 'auto' | 'both'. Decides which attribute field set a NEW
     * listing defaults to. Null for every other business type.
     */
    listingCategory: 'realestate' | 'auto' | 'both' | null;
    name: string | null;
    isActive: boolean;
    loading: boolean;
}

const DEFAULT: ActiveShopAgent = {
    role: 'sales',
    capabilities: ['sales'],
    businessType: null,
    listingCategory: null,
    name: null,
    isActive: true,
    loading: true,
};

function readListingCategory(setup: unknown): ActiveShopAgent['listingCategory'] {
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return null;
    const c = (setup as Record<string, unknown>).category;
    return c === 'realestate' || c === 'auto' || c === 'both' ? c : null;
}

/**
 * Hook to read the current shop's AI agent role + capabilities.
 * Used by Sidebar / dashboard surfaces to conditionally render
 * capability-specific menu items.
 */
export function useActiveShopAgent(): ActiveShopAgent {
    const [state, setState] = useState<ActiveShopAgent>(DEFAULT);

    useEffect(() => {
        let cancelled = false;
        const shopId =
            typeof window !== 'undefined'
                ? localStorage.getItem('smarthub_active_shop_id') || ''
                : '';

        const fetchShop = async () => {
            try {
                const headers: Record<string, string> = {};
                if (shopId) headers['x-shop-id'] = shopId;
                const res = await fetch('/api/shop', { headers });
                const data = await res.json();
                if (cancelled) return;
                const s = data?.shop ?? {};
                setState({
                    role: (s.ai_agent_role as AgentRole) || 'sales',
                    capabilities:
                        (s.ai_agent_capabilities as AgentCapability[]) ||
                        ['sales'],
                    businessType: (s.business_type as BusinessType) || null,
                    listingCategory: readListingCategory(s.business_setup_data),
                    name: (s.ai_agent_name as string) || null,
                    isActive: s.is_ai_active !== false,
                    loading: false,
                });
            } catch {
                if (!cancelled) setState({ ...DEFAULT, loading: false });
            }
        };

        fetchShop();

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
