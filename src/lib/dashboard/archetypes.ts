/**
 * Dashboard archetypes — business-model-aware dashboard composition.
 *
 * The dashboard archetype is driven primarily by the shop's `business_type`
 * (set in the setup wizard). Legacy shops created before the business_type
 * column existed have it NULL — for those we fall back to the AI agent
 * capabilities so they keep rendering a sensible dashboard with no data
 * migration required.
 *
 * Three archetypes cover all 9 business types:
 *   - commerce → retail, ecommerce, other, restaurant   (orders / revenue)
 *   - booking  → service, beauty, healthcare             (appointments)
 *   - lead     → education, realestate_auto              (lead pipeline)
 *
 * `business_type` then also supplies the catalog noun
 * (Бараа / Үйлчилгээ / Зар / Сургалт / Меню).
 */

import { BUSINESS_TYPES, isBusinessType, type BusinessType } from '@/lib/constants/business-types';

export type DashboardArchetype = 'commerce' | 'booking' | 'lead';

/** Primary dashboard layout per business_type. */
export const BUSINESS_TYPE_ARCHETYPE: Record<BusinessType, DashboardArchetype> = {
    retail: 'commerce',
    ecommerce: 'commerce',
    other: 'commerce',
    restaurant: 'commerce', // sales-first; appointments surface as a secondary block
    service: 'booking',
    beauty: 'booking',
    healthcare: 'booking',
    education: 'lead',
    realestate_auto: 'lead',
};

/**
 * Resolve the primary dashboard archetype from a shop's `business_type`.
 * Falls back to AI agent capabilities when business_type is unset (legacy
 * shops), then to `commerce` as a last resort.
 */
export function resolveArchetype(
    businessType: BusinessType | string | null | undefined,
    capabilities?: string[] | null,
): DashboardArchetype {
    if (isBusinessType(businessType)) return BUSINESS_TYPE_ARCHETYPE[businessType];
    const caps = capabilities ?? [];
    if (caps.includes('sales')) return 'commerce';
    if (caps.includes('booking')) return 'booking';
    if (caps.includes('lead_capture')) return 'lead';
    return 'commerce';
}

export interface DashboardBlocks {
    commerce: boolean;
    booking: boolean;
    lead: boolean;
}

/** Which capability blocks a business_type implies (hybrids get several). */
const BUSINESS_TYPE_BLOCKS: Record<BusinessType, DashboardBlocks> = {
    retail: { commerce: true, booking: false, lead: false },
    ecommerce: { commerce: true, booking: false, lead: false },
    other: { commerce: true, booking: false, lead: false },
    restaurant: { commerce: true, booking: true, lead: false },
    service: { commerce: false, booking: true, lead: false },
    beauty: { commerce: false, booking: true, lead: false },
    healthcare: { commerce: false, booking: true, lead: false },
    education: { commerce: false, booking: false, lead: true },
    realestate_auto: { commerce: false, booking: false, lead: true },
};

/**
 * The set of dashboard data blocks (cart funnel / appointments / leads) a shop
 * should compute, driven by business_type with a capability fallback for
 * legacy shops. The primary archetype always has its block enabled; hybrids
 * (e.g. restaurant) get extra secondary blocks.
 */
export function dashboardBlocks(
    businessType: BusinessType | string | null | undefined,
    capabilities?: string[] | null,
): DashboardBlocks {
    if (isBusinessType(businessType)) return BUSINESS_TYPE_BLOCKS[businessType];
    const caps = capabilities ?? [];
    return {
        commerce: caps.includes('sales'),
        booking: caps.includes('booking'),
        lead: caps.includes('lead_capture'),
    };
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
