import { describe, it, expect } from 'vitest';
import { resolveArchetype, itemNoun } from './archetypes';

describe('resolveArchetype', () => {
    it('maps sales-bearing capability sets to commerce', () => {
        expect(resolveArchetype(['sales'])).toBe('commerce');
        expect(resolveArchetype(['sales', 'support'])).toBe('commerce');
        // restaurant hybrid keeps commerce because it carries `sales`
        expect(resolveArchetype(['sales', 'booking', 'information'])).toBe('commerce');
    });

    it('maps booking (without sales) to booking', () => {
        expect(resolveArchetype(['booking'])).toBe('booking');
        expect(resolveArchetype(['booking', 'information'])).toBe('booking');
    });

    it('maps lead_capture (without sales/booking) to lead', () => {
        expect(resolveArchetype(['lead_capture'])).toBe('lead');
        expect(resolveArchetype(['lead_capture', 'information'])).toBe('lead');
    });

    it('falls back to commerce for information/support-only or empty/missing', () => {
        expect(resolveArchetype(['information'])).toBe('commerce');
        expect(resolveArchetype(['support'])).toBe('commerce');
        expect(resolveArchetype([])).toBe('commerce');
        expect(resolveArchetype(null)).toBe('commerce');
        expect(resolveArchetype(undefined)).toBe('commerce');
    });
});

describe('itemNoun', () => {
    it('returns the business-type noun', () => {
        expect(itemNoun('retail')).toBe('Бараа');
        expect(itemNoun('restaurant')).toBe('Меню');
        expect(itemNoun('realestate_auto')).toBe('Зар');
    });

    it('falls back to a generic noun for unknown/null', () => {
        expect(itemNoun(null)).toBe('Бараа');
        expect(itemNoun('nonexistent')).toBe('Бараа');
    });
});
