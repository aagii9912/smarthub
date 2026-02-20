
import { describe, it, expect } from 'vitest';
import { checkShopLimit } from '../config/plans';

describe('Shop Limits', () => {
    describe('checkShopLimit', () => {


        it('should allow 1 shop for starter plan', () => {
            const check = checkShopLimit('starter', 0);
            expect(check.allowed).toBe(true);
            expect(check.limit).toBe(1);
        });

        it('should block 2nd shop for starter plan', () => {
            const check = checkShopLimit('starter', 1);
            expect(check.allowed).toBe(false);
            expect(check.limit).toBe(1);
        });

        it('should allow 3 shops for pro plan', () => {
            expect(checkShopLimit('pro', 0).allowed).toBe(true);
            expect(checkShopLimit('pro', 1).allowed).toBe(true);
            expect(checkShopLimit('pro', 2).allowed).toBe(true);
        });

        it('should block 4th shop for pro plan', () => {
            expect(checkShopLimit('pro', 3).allowed).toBe(false);
            expect(checkShopLimit('pro', 3).limit).toBe(3);
        });

        it('should allow many shops for enterprise plan', () => {
            expect(checkShopLimit('enterprise', 50).allowed).toBe(true);
            expect(checkShopLimit('enterprise', 999).allowed).toBe(true);
        });
    });
});
