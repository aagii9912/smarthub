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
 *
 * The per-type archetype and blocks live on each Industry Pack
 * (`src/lib/industry-packs/builtin/*`); the maps below are derived from them.
 */

import { getPack, isBusinessType, mapPacks, type BusinessType } from '@/lib/industry-packs/registry';
import type { DashboardArchetype, DashboardBlocks } from '@/lib/industry-packs/types';

export type { DashboardArchetype, DashboardBlocks } from '@/lib/industry-packs/types';

/** Primary dashboard layout per business_type. */
export const BUSINESS_TYPE_ARCHETYPE: Record<BusinessType, DashboardArchetype> = mapPacks((pack) => pack.archetype);

/**
 * Resolve the primary dashboard archetype from a shop's `business_type`.
 * Falls back to AI agent capabilities when business_type is unset (legacy
 * shops), then to `commerce` as a last resort.
 *
 * In the capability fallback `lead_capture` outranks `booking`: for a
 * үл хөдлөх / авто broker a viewing is a STEP inside the lead pipeline, not the
 * business itself, so a legacy shop that switches on үзлэг товлох must not have
 * its lead dashboard swapped for a clinic's appointment dashboard. Shops that
 * do carry a business_type never reach this branch — realestate_auto maps
 * straight to 'lead' above.
 */
export function resolveArchetype(
    businessType: BusinessType | string | null | undefined,
    capabilities?: string[] | null,
): DashboardArchetype {
    if (isBusinessType(businessType)) return BUSINESS_TYPE_ARCHETYPE[businessType];
    const caps = capabilities ?? [];
    if (caps.includes('sales')) return 'commerce';
    if (caps.includes('lead_capture')) return 'lead';
    if (caps.includes('booking')) return 'booking';
    return 'commerce';
}

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
    const pack = getPack(businessType);
    if (pack) return { ...pack.blocks };
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
    return getPack(businessType)?.meta.productNoun ?? 'Бараа';
}
