import { describe, it, expect } from 'vitest';
import { INDUSTRY_PACKS, PACK_IDS, getPack, isBusinessType, isListingCatalog } from '../registry';

// Must match the DB CHECK in 20261010140000_relax_business_type_check.sql
const DB_ID_FORMAT = /^[a-z][a-z0-9_]{1,39}$/;

describe('industry pack registry', () => {
    it('every pack id equals its registry key and fits the DB format', () => {
        for (const id of PACK_IDS) {
            expect(INDUSTRY_PACKS[id].id).toBe(id);
            expect(id).toMatch(DB_ID_FORMAT);
        }
    });

    it('hasOperations matches whether the pack defines a setup step', () => {
        for (const id of PACK_IDS) {
            const pack = INDUSTRY_PACKS[id];
            expect(pack.meta.hasOperations).toBe(pack.operations !== null);
        }
    });

    it('the primary archetype block is always enabled', () => {
        for (const id of PACK_IDS) {
            const pack = INDUSTRY_PACKS[id];
            expect(pack.blocks[pack.archetype]).toBe(true);
        }
    });

    it('rejects unknown and prototype keys', () => {
        expect(isBusinessType('beauty')).toBe(true);
        expect(isBusinessType('toString')).toBe(false);
        expect(isBusinessType('unknown')).toBe(false);
        expect(isBusinessType(null)).toBe(false);
        expect(getPack('constructor')).toBeNull();
    });

    it('only realestate_auto is a listing catalog today', () => {
        expect(PACK_IDS.filter(isListingCatalog)).toEqual(['realestate_auto']);
        expect(isListingCatalog(undefined)).toBe(false);
    });
});
