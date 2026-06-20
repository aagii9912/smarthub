/**
 * Dashboard archetypes — business-model-aware dashboard composition.
 *
 * The main dashboard (`src/app/dashboard/page.tsx`) used to render the same
 * KPIs / tables for every shop. Instead we derive a *dashboard archetype* from
 * the shop's AI agent capabilities (the same discriminator `Sidebar.tsx` uses
 * to show/hide nav items) and render the matching view. `business_type` then
 * supplies the right noun ("Захиалга" / "Цаг захиалга" / "Зар").
 *
 * Three archetypes cover all 9 business types:
 *   - commerce → has `sales`         (retail, ecommerce, restaurant-hybrid, other)
 *   - booking  → has `booking`       (service, beauty, healthcare)
 *   - lead     → has `lead_capture`  (realestate_auto, education)
 */

import { BUSINESS_TYPES, isBusinessType, type BusinessType } from '@/lib/constants/business-types';

export type DashboardArchetype = 'commerce' | 'booking' | 'lead';

/**
 * Resolve the dashboard archetype from a shop's AI agent capabilities.
 *
 * Priority order matters for hybrid shops (which carry several capabilities):
 * a restaurant has `['sales','booking','information']` → commerce, while a
 * clinic has `['booking','information']` → booking. Falls back to `commerce`
 * for information/support-only shops or when capabilities are missing.
 */
export function resolveArchetype(capabilities: string[] | null | undefined): DashboardArchetype {
    const caps = capabilities ?? [];
    if (caps.includes('sales')) return 'commerce';
    if (caps.includes('booking')) return 'booking';
    if (caps.includes('lead_capture')) return 'lead';
    return 'commerce';
}

/**
 * The noun a shop uses for its catalog items, derived from `business_type`.
 * Reuses the Mongolian `productNoun` from `BUSINESS_TYPES`
 * (e.g. "Бараа" / "Меню" / "Үйлчилгээ" / "Зар"). Falls back to a generic noun.
 */
export function itemNoun(businessType: BusinessType | string | null | undefined): string {
    if (isBusinessType(businessType)) {
        return BUSINESS_TYPES[businessType].productNoun;
    }
    return 'Бараа';
}
