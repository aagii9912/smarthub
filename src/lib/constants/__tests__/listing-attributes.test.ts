import { describe, it, expect } from 'vitest';
import {
    LISTING_ATTRIBUTE_FIELDS,
    defaultListingKind,
    formatListingAttributes,
    listingKindOf,
    summariseListingAttributes,
} from '../listing-attributes';

describe('listingKindOf', () => {
    it('reads a valid kind', () => {
        expect(listingKindOf({ kind: 'realestate' })).toBe('realestate');
        expect(listingKindOf({ kind: 'auto' })).toBe('auto');
    });

    it('returns null for the "no structured data" cases', () => {
        expect(listingKindOf({})).toBeNull();
        expect(listingKindOf(null)).toBeNull();
        expect(listingKindOf(undefined)).toBeNull();
        expect(listingKindOf('realestate')).toBeNull();
        expect(listingKindOf([])).toBeNull();
        expect(listingKindOf({ kind: 'boat' })).toBeNull();
    });
});

describe('defaultListingKind', () => {
    it('follows the shop category, defaulting to realestate', () => {
        expect(defaultListingKind('auto')).toBe('auto');
        expect(defaultListingKind('realestate')).toBe('realestate');
        // 'both' has no single answer — the form lets the broker pick.
        expect(defaultListingKind('both')).toBe('realestate');
        expect(defaultListingKind(null)).toBe('realestate');
    });
});

describe('formatListingAttributes', () => {
    it('renders a property with Mongolian labels', () => {
        const lines = formatListingAttributes({
            kind: 'realestate',
            rooms: 2,
            area_m2: 78,
            district: 'ХУД',
            khoroo: '11-р хороо',
            floor: 5,
            total_floors: 12,
            built_year: 2019,
            is_furnished: true,
        });

        expect(lines).toContain('Өрөөний тоо: 2');
        expect(lines).toContain('Талбай: 78 м²');
        expect(lines).toContain('Дүүрэг / хот: ХУД');
        // Давхар / нийт давхар нь Монгол зард нэг мөрөөр бичигддэг.
        expect(lines).toContain('Давхар: 5 / 12');
        expect(lines).not.toContain('Нийт давхар: 12');
        // Он тусгаарлагчгүй — "2,019" гэж уншигдах ёсгүй.
        expect(lines).toContain('Ашиглалтад орсон он: 2019');
        expect(lines).toContain('Тавилгатай: Тийм');
    });

    it('renders a car with thousands separators on mileage', () => {
        const lines = formatListingAttributes({
            kind: 'auto',
            make: 'Toyota',
            model: 'Prius 30',
            year: 2015,
            mileage_km: 145000,
            transmission: 'автомат',
        });

        expect(lines).toContain('Марк: Toyota');
        expect(lines).toContain('Загвар: Prius 30');
        expect(lines).toContain('Үйлдвэрлэсэн он: 2015');
        expect(lines).toContain('Гүйлт: 145,000 км');
        expect(lines).toContain('Хурдны хайрцаг: автомат');
    });

    it('skips blanks so a half-filled listing stays short', () => {
        const lines = formatListingAttributes({ kind: 'realestate', rooms: 3, district: '' });
        expect(lines).toEqual(['Өрөөний тоо: 3']);
    });

    it('omits false booleans rather than stating the negative', () => {
        const lines = formatListingAttributes({
            kind: 'realestate',
            rooms: 1,
            is_furnished: false,
            mortgage_available: false,
        });
        expect(lines).toEqual(['Өрөөний тоо: 1']);
    });

    it('renders "Давхар: 5" when only the floor is known', () => {
        expect(formatListingAttributes({ kind: 'realestate', floor: 5 })).toEqual(['Давхар: 5']);
    });

    // total_floors нь floor руу нийлдэг тул зөвхөн нийт давхрыг бөглөсөн зар
    // DB-д хадгалагдаад AI-д хэзээ ч хүрдэггүй байсан.
    it('still reports the building height when only «Нийт давхар» is filled', () => {
        expect(formatListingAttributes({ kind: 'realestate', total_floors: 12 }))
            .toEqual(['Нийт давхар: 12']);
        expect(formatListingAttributes({ kind: 'realestate', rooms: 2, total_floors: 12 }))
            .toEqual(['Өрөөний тоо: 2', 'Нийт давхар: 12']);
    });

    it('returns nothing when there is no structured data', () => {
        expect(formatListingAttributes({})).toEqual([]);
        expect(formatListingAttributes(null)).toEqual([]);
        expect(formatListingAttributes({ rooms: 2 })).toEqual([]); // kind байхгүй
    });
});

describe('summariseListingAttributes', () => {
    it('summarises a property and a car for the listing card', () => {
        expect(
            summariseListingAttributes({ kind: 'realestate', rooms: 2, area_m2: 78, district: 'ХУД' }),
        ).toBe('2 өрөө · 78 м² · ХУД');

        expect(
            summariseListingAttributes({ kind: 'auto', make: 'Toyota', model: 'Prius 30', year: 2015, mileage_km: 145000 }),
        ).toBe('Toyota Prius 30 · 2015 · 145,000 км');
    });

    it('is empty when nothing structured exists', () => {
        expect(summariseListingAttributes({})).toBe('');
        expect(summariseListingAttributes(null)).toBe('');
    });
});

describe('field table', () => {
    it('has unique keys per kind (the form renders these as React keys)', () => {
        for (const kind of ['realestate', 'auto'] as const) {
            const keys = LISTING_ATTRIBUTE_FIELDS[kind].map((f) => f.key);
            expect(new Set(keys).size).toBe(keys.length);
        }
    });

    it('marks the one non-integer field so the browser accepts decimals', () => {
        // area_m2 бол сервер талд `.int()` биш цорын ганц тоон талбар; step
        // байхгүй бол хөтөч 78.5-ыг stepMismatch гэж submit-ыг хаана.
        const area = LISTING_ATTRIBUTE_FIELDS.realestate.find((f) => f.key === 'area_m2');
        expect(area?.step).toBe('any');
        for (const kind of ['realestate', 'auto'] as const) {
            for (const field of LISTING_ATTRIBUTE_FIELDS[kind]) {
                if (field.kind === 'number' && field.key !== 'area_m2') {
                    expect(field.step).toBeUndefined(); // → step=1, бүхэл тоо
                }
            }
        }
    });

    it('keeps the two field sets key-disjoint so the kind toggle cannot mix them', () => {
        // ProductForm нь сэлгэхдээ утгыг цэвэрлэдэггүй тул хоёр багц түлхүүр
        // хуваалцвал машины утга байрны зар руу урсах эрсдэлтэй.
        const re = new Set(LISTING_ATTRIBUTE_FIELDS.realestate.map((f) => f.key));
        const auto = LISTING_ATTRIBUTE_FIELDS.auto.map((f) => f.key);
        expect(auto.filter((k) => re.has(k))).toEqual([]);
    });

    it('gives every select field its options', () => {
        for (const kind of ['realestate', 'auto'] as const) {
            for (const field of LISTING_ATTRIBUTE_FIELDS[kind]) {
                if (field.kind === 'select') {
                    expect(field.options?.length).toBeGreaterThan(0);
                }
            }
        }
    });
});
