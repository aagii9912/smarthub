import { describe, it, expect } from 'vitest';
import { createProductSchema, updateProductSchema } from '@/lib/validations';

// Regression guard for #6 (variant creation not saving). The product form sends
// `has_variants` + `variants` in snake_case; before the fix the schema had no
// such fields so Zod's safeParse silently stripped them and nothing persisted.
describe('Product variant validation (#6)', () => {
    it('keeps has_variants + variants through createProductSchema', () => {
        const parsed = createProductSchema.parse({
            name: 'Гутал',
            price: 50000,
            has_variants: true,
            variants: [
                {
                    name: 'Улаан / 37',
                    options: { Өнгө: 'Улаан', Хэмжээ: '37' },
                    price: 55000,
                    stock: 3,
                    is_active: true,
                },
            ],
        });

        expect(parsed.has_variants).toBe(true);
        expect(parsed.variants).toHaveLength(1);
        expect(parsed.variants?.[0]).toMatchObject({
            name: 'Улаан / 37',
            options: { Өнгө: 'Улаан', Хэмжээ: '37' },
            price: 55000,
            stock: 3,
            is_active: true,
        });
    });

    it('applies defaults to sparse variant rows (options/stock/is_active)', () => {
        const parsed = createProductSchema.parse({
            name: 'X',
            price: 1000,
            has_variants: true,
            variants: [{ name: 'Default' }],
        });

        expect(parsed.variants?.[0]).toMatchObject({
            name: 'Default',
            options: {},
            stock: 0,
            is_active: true,
        });
    });

    it('leaves variants/has_variants undefined on update when not provided', () => {
        // Critical: an unrelated PATCH (e.g. a price tweak) must NOT carry an
        // empty variants array, or the route would wipe every saved variant.
        const parsed = updateProductSchema.parse({
            id: '11111111-1111-4111-8111-111111111111',
            price: 9999,
        });

        expect(parsed.variants).toBeUndefined();
        expect(parsed.has_variants).toBeUndefined();
    });

    it('preserves an explicit empty variants array so PATCH can clear them', () => {
        const parsed = updateProductSchema.parse({
            id: '11111111-1111-4111-8111-111111111111',
            has_variants: false,
            variants: [],
        });

        expect(parsed.variants).toEqual([]);
        expect(parsed.has_variants).toBe(false);
    });
});
