import { describe, it, expect } from 'vitest';
import { resolveArchetype, dashboardBlocks, itemNoun } from './archetypes';

describe('resolveArchetype (business_type-driven)', () => {
    it('maps commerce business types', () => {
        expect(resolveArchetype('retail')).toBe('commerce');
        expect(resolveArchetype('ecommerce')).toBe('commerce');
        expect(resolveArchetype('other')).toBe('commerce');
        expect(resolveArchetype('restaurant')).toBe('commerce');
    });

    it('maps booking business types', () => {
        expect(resolveArchetype('service')).toBe('booking');
        expect(resolveArchetype('beauty')).toBe('booking');
        expect(resolveArchetype('healthcare')).toBe('booking');
    });

    it('maps lead business types', () => {
        expect(resolveArchetype('education')).toBe('lead');
        expect(resolveArchetype('realestate_auto')).toBe('lead');
    });

    it('business_type wins over capabilities', () => {
        // service shop whose caps somehow still say sales → still booking
        expect(resolveArchetype('service', ['sales'])).toBe('booking');
    });

    it('falls back to capabilities when business_type is unset (legacy shops)', () => {
        expect(resolveArchetype(null, ['booking', 'information'])).toBe('booking');
        expect(resolveArchetype(null, ['lead_capture'])).toBe('lead');
        expect(resolveArchetype(null, ['sales'])).toBe('commerce');
        expect(resolveArchetype(undefined, [])).toBe('commerce');
        expect(resolveArchetype('nonexistent')).toBe('commerce');
    });
});

describe('dashboardBlocks', () => {
    it('restaurant is a hybrid (commerce + booking)', () => {
        expect(dashboardBlocks('restaurant')).toEqual({ commerce: true, booking: true, lead: false });
    });

    it('single-archetype business types enable only their block', () => {
        expect(dashboardBlocks('retail')).toEqual({ commerce: true, booking: false, lead: false });
        expect(dashboardBlocks('beauty')).toEqual({ commerce: false, booking: true, lead: false });
        expect(dashboardBlocks('education')).toEqual({ commerce: false, booking: false, lead: true });
    });

    it('falls back to capabilities for legacy shops', () => {
        expect(dashboardBlocks(null, ['sales', 'booking'])).toEqual({ commerce: true, booking: true, lead: false });
        expect(dashboardBlocks(null, ['lead_capture'])).toEqual({ commerce: false, booking: false, lead: true });
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
