/**
 * Structured attributes for listing catalogs (`business_type = 'realestate_auto'`).
 *
 * WHY THIS EXISTS: a үл хөдлөх / авто зар is defined by facts a shopper filters
 * on — өрөө, талбай, дүүрэг, давхар / марк, он, гүйлт. Before this, the only
 * structured extras on `products` were `colors` and `sizes` (clothing), so all
 * of that had to go into the free-text description. The AI could quote it back,
 * but nothing could count, filter or report on it.
 *
 * SINGLE SOURCE OF TRUTH: `LISTING_ATTRIBUTE_FIELDS` drives the product form,
 * the Zod schema's shape expectations and the system-prompt rendering. Adding a
 * field here surfaces it everywhere — the label can never drift between what the
 * broker typed and what the AI reads back.
 *
 * Stored in `products.attributes` (JSONB, `{}` default).
 */

/** Which half of a realestate_auto catalog a listing belongs to. */
export type ListingKind = 'realestate' | 'auto';

export interface RealestateAttributes {
    kind: 'realestate';
    /** Өрөөний тоо */
    rooms?: number;
    /** Ашигтай талбай, м² */
    area_m2?: number;
    /** Дүүрэг / хот / аймаг */
    district?: string;
    /** Хороо / хороолол / орчин */
    khoroo?: string;
    /** Хэддүгээр давхарт */
    floor?: number;
    /** Барилгын нийт давхар */
    total_floors?: number;
    /** Ашиглалтад орсон он */
    built_year?: number;
    /** Тавилгатай эсэх */
    is_furnished?: boolean;
    /** Ипотек / банкны зээлд тохирох эсэх */
    mortgage_available?: boolean;
}

export interface AutoAttributes {
    kind: 'auto';
    /** Марк (Toyota, Lexus, ...) */
    make?: string;
    /** Загвар (Prius 30, RX 350, ...) */
    model?: string;
    /** Үйлдвэрлэсэн он */
    year?: number;
    /** Гүйлт, км */
    mileage_km?: number;
    /** Хөдөлгүүрийн багтаамж, см³ */
    engine_cc?: number;
    /** Хурдны хайрцаг */
    transmission?: string;
    /** Түлш */
    fuel?: string;
    /** Жолооны байрлал */
    steering?: string;
    /** Өнгө */
    color?: string;
}

export type ListingAttributes = RealestateAttributes | AutoAttributes;

export type AttributeFieldKind = 'text' | 'number' | 'select' | 'boolean';

export interface AttributeField {
    key: string;
    /** Монгол шошго — маягт болон prompt хоёулаа үүнийг ашиглана. */
    label: string;
    kind: AttributeFieldKind;
    /** Утгын ард залгах нэгж ("м²", "км"). */
    unit?: string;
    placeholder?: string;
    options?: string[];
    min?: number;
    max?: number;
    /**
     * `<input type="number" step>`. Omitted → 1 (бүхэл тоо), which is what every
     * `.int()` field wants. `'any'` for the one field the server schema allows
     * to be fractional — without it the browser blocks submit on "78.5".
     */
    step?: number | 'any';
}

export const LISTING_KIND_LABELS: Record<ListingKind, string> = {
    realestate: 'Үл хөдлөх',
    auto: 'Автомашин',
};

export const LISTING_ATTRIBUTE_FIELDS: Record<ListingKind, AttributeField[]> = {
    realestate: [
        { key: 'rooms', label: 'Өрөөний тоо', kind: 'number', min: 0, max: 30, placeholder: '2' },
        { key: 'area_m2', label: 'Талбай', kind: 'number', unit: 'м²', min: 0, max: 100000, step: 'any', placeholder: '78' },
        { key: 'district', label: 'Дүүрэг / хот', kind: 'text', placeholder: 'ХУД' },
        { key: 'khoroo', label: 'Хороо / хороолол', kind: 'text', placeholder: '11-р хороо, Зайсан' },
        { key: 'floor', label: 'Давхар', kind: 'number', min: -5, max: 200, placeholder: '5' },
        { key: 'total_floors', label: 'Нийт давхар', kind: 'number', min: 0, max: 200, placeholder: '12' },
        { key: 'built_year', label: 'Ашиглалтад орсон он', kind: 'number', min: 1900, max: 2100, placeholder: '2019' },
        { key: 'is_furnished', label: 'Тавилгатай', kind: 'boolean' },
        { key: 'mortgage_available', label: 'Ипотекийн зээлд тохирно', kind: 'boolean' },
    ],
    auto: [
        { key: 'make', label: 'Марк', kind: 'text', placeholder: 'Toyota' },
        { key: 'model', label: 'Загвар', kind: 'text', placeholder: 'Prius 30' },
        { key: 'year', label: 'Үйлдвэрлэсэн он', kind: 'number', min: 1900, max: 2100, placeholder: '2015' },
        { key: 'mileage_km', label: 'Гүйлт', kind: 'number', unit: 'км', min: 0, max: 3000000, placeholder: '145000' },
        { key: 'engine_cc', label: 'Хөдөлгүүр', kind: 'number', unit: 'см³', min: 0, max: 20000, placeholder: '1800' },
        { key: 'transmission', label: 'Хурдны хайрцаг', kind: 'select', options: ['автомат', 'механик', 'вариатор'] },
        { key: 'fuel', label: 'Түлш', kind: 'select', options: ['бензин', 'дизель', 'хайбрид', 'цахилгаан', 'хий'] },
        { key: 'steering', label: 'Жолоо', kind: 'select', options: ['зөв (зүүн)', 'буруу (баруун)'] },
        { key: 'color', label: 'Өнгө', kind: 'text', placeholder: 'цагаан' },
    ],
};

export const LISTING_KINDS: ListingKind[] = ['realestate', 'auto'];

export function isListingKind(value: unknown): value is ListingKind {
    return value === 'realestate' || value === 'auto';
}

/**
 * Read the `kind` out of a stored attributes blob. Returns null when the blob is
 * empty or malformed, which is the "no structured data" case everywhere.
 */
export function listingKindOf(attributes: unknown): ListingKind | null {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return null;
    const kind = (attributes as Record<string, unknown>).kind;
    return isListingKind(kind) ? kind : null;
}

/**
 * A shop's `business_setup_data.category` ('realestate' | 'auto' | 'both')
 * decides which field set a NEW listing defaults to. 'both' has no single
 * answer, so the form lets the broker pick per listing.
 */
export function defaultListingKind(category: unknown): ListingKind {
    return category === 'auto' ? 'auto' : 'realestate';
}

function formatValue(field: AttributeField, raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null;

    if (field.kind === 'boolean') {
        // Only state the positive — "Тавилгатай: Үгүй" on every unfurnished flat
        // is noise in a prompt the model pays per token for.
        return raw === true ? 'Тийм' : null;
    }

    if (field.kind === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        // Years are read as plain digits; everything else gets thousands
        // separators so "145,000 км" is legible.
        const isYear = field.key.endsWith('year');
        const text = isYear ? String(Math.trunc(n)) : n.toLocaleString('en-US');
        return field.unit ? `${text} ${field.unit}` : text;
    }

    const text = String(raw).trim();
    if (!text) return null;
    return field.unit ? `${text} ${field.unit}` : text;
}

/**
 * Render stored attributes as Mongolian `Шошго: утга` lines for the AI prompt
 * and for compact UI summaries. Empty/absent values are skipped entirely, so a
 * half-filled listing produces a short block rather than a wall of blanks.
 *
 * Floor is collapsed into "5 / 12 давхар" when both numbers are present — that
 * is how a Mongolian ad actually writes it.
 */
export function formatListingAttributes(attributes: unknown): string[] {
    const kind = listingKindOf(attributes);
    if (!kind) return [];
    const data = attributes as Record<string, unknown>;
    const lines: string[] = [];

    for (const field of LISTING_ATTRIBUTE_FIELDS[kind]) {
        if (kind === 'realestate' && field.key === 'total_floors') continue; // folded into `floor`

        if (kind === 'realestate' && field.key === 'floor') {
            const floor = data.floor;
            const total = data.total_floors;
            const hasFloor = floor !== undefined && floor !== null && floor !== '';
            const hasTotal = total !== undefined && total !== null && total !== '';
            if (hasFloor && hasTotal) lines.push(`Давхар: ${floor} / ${total}`);
            else if (hasFloor) lines.push(`Давхар: ${floor}`);
            // Зөвхөн нийт давхар мэдэгдэж байвал ч хаяхгүй — эс бол брокерын
            // бөглөсөн утга DB-д хадгалагдаад AI-д хэзээ ч хүрэхгүй.
            else if (hasTotal) lines.push(`Нийт давхар: ${total}`);
            continue;
        }

        const value = formatValue(field, data[field.key]);
        if (value !== null) lines.push(`${field.label}: ${value}`);
    }

    return lines;
}

/**
 * One-line summary for a listing card ("2 өрөө · 78 м² · ХУД" / "Toyota Prius 30
 * · 2015 · 145,000 км"). Returns '' when there is nothing structured to show.
 */
export function summariseListingAttributes(attributes: unknown): string {
    const kind = listingKindOf(attributes);
    if (!kind) return '';
    const data = attributes as Record<string, unknown>;
    const parts: string[] = [];

    if (kind === 'realestate') {
        if (data.rooms) parts.push(`${data.rooms} өрөө`);
        if (data.area_m2) parts.push(`${Number(data.area_m2).toLocaleString('en-US')} м²`);
        if (data.district) parts.push(String(data.district));
    } else {
        const nameParts = [data.make, data.model].filter(Boolean).join(' ');
        if (nameParts) parts.push(nameParts);
        if (data.year) parts.push(String(data.year));
        if (data.mileage_km) parts.push(`${Number(data.mileage_km).toLocaleString('en-US')} км`);
    }

    return parts.join(' · ');
}
