/**
 * Tests for delivery address classification + fee resolution.
 *
 * This logic is the single source of truth shared by checkout, the AI prompt,
 * and the dashboard. A misclassification charges the customer the wrong
 * delivery fee (UB vs province) or wrongly waives it, so the keyword routing
 * and the free-threshold math both need pinning down.
 */
import { describe, it, expect } from 'vitest';
import {
    classifyDeliveryAddress,
    resolveDeliveryFee,
    type DeliveryPolicy,
} from '@/lib/utils/delivery';

describe('classifyDeliveryAddress', () => {
    it('defaults to UB for empty/null/undefined addresses', () => {
        expect(classifyDeliveryAddress(null)).toBe('ub');
        expect(classifyDeliveryAddress(undefined)).toBe('ub');
        expect(classifyDeliveryAddress('')).toBe('ub');
    });

    it('detects province keywords (Cyrillic)', () => {
        expect(classifyDeliveryAddress('Дархан хот')).toBe('province');
        expect(classifyDeliveryAddress('Өвөрхангай аймаг')).toBe('province');
        expect(classifyDeliveryAddress('Эрдэнэт')).toBe('province');
    });

    it('detects province keywords (Latin transliteration)', () => {
        expect(classifyDeliveryAddress('Darkhan city')).toBe('province');
        expect(classifyDeliveryAddress('Khovd aimag')).toBe('province');
    });

    it('classifies clear UB addresses as ub', () => {
        expect(classifyDeliveryAddress('Улаанбаатар, СБД, 1-р хороо')).toBe('ub');
        expect(classifyDeliveryAddress('BZD 13-р хороо')).toBe('ub');
    });

    it('is case-insensitive', () => {
        expect(classifyDeliveryAddress('ДАРХАН')).toBe('province');
        expect(classifyDeliveryAddress('ulaanbaatar')).toBe('ub');
    });

    it('falls back to ub for unknown/ambiguous addresses (cheaper default)', () => {
        expect(classifyDeliveryAddress('гудамж 5')).toBe('ub');
    });

    it('prefers province when a province keyword appears before any UB keyword', () => {
        // Province keywords are checked first, so this resolves to province.
        expect(classifyDeliveryAddress('Дархан, хороо 2')).toBe('province');
    });
});

describe('resolveDeliveryFee', () => {
    const policy: DeliveryPolicy = {
        free_delivery_threshold: 100_000,
        ub_delivery_fee: 5_000,
        province_delivery_fee: 15_000,
        province_delivery_note: 'Аймагт 2-3 хоног',
    };

    it('charges the UB fee for a UB address below the free threshold', () => {
        const r = resolveDeliveryFee(policy, 'Улаанбаатар СБД', 50_000);
        expect(r.region).toBe('ub');
        expect(r.fee).toBe(5_000);
        expect(r.free).toBe(false);
        expect(r.note).toBeNull();
    });

    it('charges the province fee and attaches the province note', () => {
        const r = resolveDeliveryFee(policy, 'Дархан аймаг', 50_000);
        expect(r.region).toBe('province');
        expect(r.fee).toBe(15_000);
        expect(r.note).toBe('Аймагт 2-3 хоног');
    });

    it('waives the fee when subtotal meets the free threshold', () => {
        const r = resolveDeliveryFee(policy, 'Дархан аймаг', 100_000);
        expect(r.free).toBe(true);
        expect(r.fee).toBe(0);
        // region/note are still resolved even when free
        expect(r.region).toBe('province');
    });

    it('does NOT waive when subtotal is one tögrög short', () => {
        const r = resolveDeliveryFee(policy, 'Улаанбаатар', 99_999);
        expect(r.free).toBe(false);
        expect(r.fee).toBe(5_000);
    });

    it('treats a null threshold as "no free delivery"', () => {
        const noThreshold: DeliveryPolicy = { ...policy, free_delivery_threshold: null };
        const r = resolveDeliveryFee(noThreshold, 'Улаанбаатар', 10_000_000);
        expect(r.free).toBe(false);
        expect(r.fee).toBe(5_000);
    });

    it('defaults fees to 0 when policy is null/undefined', () => {
        const r = resolveDeliveryFee(null, 'Улаанбаатар', 50_000);
        expect(r.fee).toBe(0);
        expect(r.region).toBe('ub');
        expect(r.note).toBeNull();
    });

    it('coerces string fee values from the DB to numbers', () => {
        const stringy = {
            free_delivery_threshold: '100000',
            ub_delivery_fee: '5000',
            province_delivery_fee: '15000',
        } as unknown as DeliveryPolicy;
        const r = resolveDeliveryFee(stringy, 'Хөвсгөл аймаг', 50_000);
        expect(r.fee).toBe(15_000);
    });
});
