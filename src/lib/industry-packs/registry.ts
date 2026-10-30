/**
 * Industry Pack registry — `business_type` бүрийн цорын ганц эх сурвалж.
 *
 * Түлхүүрийн дараалал нь UI дахь салбарын жагсаалтын дараалал (setup wizard,
 * тохиргоо). `business_type`-ийн зөвшөөрөгдсөн утга, dashboard archetype, AI
 * role-ийн санал, prompt-ын салбарын хэсэг бүгд эндээс үүсвэрлэгдэнэ.
 */

import type { IndustryPack } from './types';
import { retailPack } from './builtin/retail';
import { restaurantPack } from './builtin/restaurant';
import { servicePack } from './builtin/service';
import { ecommercePack } from './builtin/ecommerce';
import { beautyPack } from './builtin/beauty';
import { healthcarePack } from './builtin/healthcare';
import { educationPack } from './builtin/education';
import { realestateAutoPack } from './builtin/realestate_auto';
import { otherPack } from './builtin/other';

export const INDUSTRY_PACKS = {
    retail: retailPack,
    restaurant: restaurantPack,
    service: servicePack,
    ecommerce: ecommercePack,
    beauty: beautyPack,
    healthcare: healthcarePack,
    education: educationPack,
    realestate_auto: realestateAutoPack,
    other: otherPack,
} satisfies Record<string, IndustryPack>;

export type BusinessType = keyof typeof INDUSTRY_PACKS;

export const PACK_IDS = Object.keys(INDUSTRY_PACKS) as BusinessType[];

export function isBusinessType(value: unknown): value is BusinessType {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(INDUSTRY_PACKS, value);
}

/** Pack-ийг `business_type`-аар; мэдэгдэхгүй/хоосон утгад null. */
export function getPack(businessType: unknown): IndustryPack | null {
    return isBusinessType(businessType) ? INDUSTRY_PACKS[businessType] : null;
}

/** pack бүрээс нэг талбар авч `Record<BusinessType, T>` үүсгэнэ. */
export function mapPacks<T>(pick: (pack: IndustryPack) => T): Record<BusinessType, T> {
    return Object.fromEntries(PACK_IDS.map((id) => [id, pick(INDUSTRY_PACKS[id])])) as Record<BusinessType, T>;
}

/**
 * Каталог нь *зар* (үл хөдлөх байр, автомашин) эсэх — үлдэгдэл, хүргэлтгүй.
 * Бараа гэж тайлбарлавал AI байр бүрийг "(Дууссан)" гэж, байшинд
 * "🚚 Хүргэлт: Үнэгүй" гэж хэлдэг байсан.
 */
export function isListingCatalog(businessType: unknown): boolean {
    return getPack(businessType)?.catalog.mode === 'listing';
}
