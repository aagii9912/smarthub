'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useActiveShopAgent } from '@/hooks/useActiveShopAgent';
import { resolveArchetype } from '@/lib/dashboard/archetypes';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { CommerceDashboardView } from '@/components/dashboard/views/CommerceDashboardView';
import { BookingDashboardView } from '@/components/dashboard/views/BookingDashboardView';
import { LeadDashboardView } from '@/components/dashboard/views/LeadDashboardView';

/**
 * Main dashboard — picks a business-model-aware view from the shop's AI agent
 * capabilities (the same discriminator the sidebar uses). See
 * `src/lib/dashboard/archetypes.ts` for the mapping.
 */
export default function DashboardPage() {
    const { loading: authLoading } = useAuth();
    const agent = useActiveShopAgent();

    if (authLoading || agent.loading) {
        return <DashboardSkeleton />;
    }

    const archetype = resolveArchetype(agent.businessType, agent.capabilities);

    switch (archetype) {
        case 'booking':
            return <BookingDashboardView />;
        case 'lead':
            return <LeadDashboardView />;
        default:
            return <CommerceDashboardView />;
    }
}
