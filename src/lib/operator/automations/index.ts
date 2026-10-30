/**
 * Pack бүрийн automation-уудын SERVER-талын registry.
 *
 * `INDUSTRY_PACKS` (client-д ч импортлогддог) дотор биш тусад нь байлгана:
 * automation-ууд supabaseAdmin, deliver() зэрэг зөвхөн сервер код ашиглана.
 */

import type { BusinessType } from '@/lib/industry-packs/registry';
import type { AutomationDef } from '../types';
import { dailyOwnerSummary, reminder24h, reminder2h } from './booking';
import { abandonedCart, dailySalesSummary, paymentReminder } from './commerce';
import { dailyPipelineSummary, leadFollowup } from './lead';

export type AutomationRegistry = Partial<Record<BusinessType, AutomationDef[]>>;

// Archetype бүрийн суурь багц. Pack нь өөрийн салбарт тохирохыг сонгоно.
const BOOKING = [reminder24h, reminder2h, dailyOwnerSummary];
const COMMERCE = [paymentReminder, abandonedCart, dailySalesSummary];
const LEAD = [leadFollowup, dailyPipelineSummary];

// Бүх pack-ийг заавал жагсаана (Record) — шинэ pack нэмэхэд TypeScript сануулна.
export const PACK_AUTOMATIONS: Record<BusinessType, AutomationDef[]> = {
    retail: COMMERCE,
    ecommerce: COMMERCE,
    other: COMMERCE,
    // Ресторан: захиалга + ширээ захиалгын (appointments) сануулга. Тойм нь борлуулалтынх.
    restaurant: [...COMMERCE, reminder24h, reminder2h],
    service: BOOKING,
    beauty: BOOKING,
    healthcare: BOOKING,
    realestate_auto: LEAD,
    education: LEAD,
};

export function automationSlug(packId: string, key: string): string {
    return `${packId}.${key}`;
}

export function findAutomation(
    registry: AutomationRegistry,
    slug: string,
): { packId: BusinessType; def: AutomationDef } | null {
    const dot = slug.indexOf('.');
    if (dot <= 0) return null;
    const packId = slug.slice(0, dot) as BusinessType;
    const key = slug.slice(dot + 1);
    const def = registry[packId]?.find((d) => d.key === key);
    return def ? { packId, def } : null;
}
