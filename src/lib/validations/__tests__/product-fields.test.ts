import { describe, it, expect } from 'vitest';
import { createProductSchema, updateProductSchema } from '@/lib/validations';

// Regression guard: ProductForm used to submit discount / delivery / appointment
// fields in snake_case, but the schema defines them in camelCase. Because
// parseWithErrors uses safeParse (which strips unknown keys), those fields were
// silently dropped and never persisted. The fix makes the form send camelCase;
// these tests pin the keys that must survive parsing.
describe('Product field validation (camelCase persistence)', () => {
    const APPOINTMENT_DAYS = ['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа'];

    it('keeps discount / delivery / appointment fields through createProductSchema', () => {
        const parsed = createProductSchema.parse({
            name: 'Үс засалт',
            price: 30000,
            type: 'appointment',
            discountPercent: 15,
            deliveryType: 'pickup_only',
            deliveryFee: 5000,
            durationMinutes: 45,
            availableDays: APPOINTMENT_DAYS,
            startTime: '09:00',
            endTime: '18:00',
            maxBookingsPerDay: 8,
        });

        expect(parsed).toMatchObject({
            discountPercent: 15,
            deliveryType: 'pickup_only',
            deliveryFee: 5000,
            durationMinutes: 45,
            availableDays: APPOINTMENT_DAYS,
            startTime: '09:00',
            endTime: '18:00',
            maxBookingsPerDay: 8,
        });
    });

    it('keeps the same fields through updateProductSchema (partial PATCH)', () => {
        const parsed = updateProductSchema.parse({
            id: '11111111-1111-4111-8111-111111111111',
            discountPercent: 10,
            deliveryType: 'included',
            deliveryFee: 0,
            durationMinutes: 60,
            availableDays: ['Бям', 'Ням'],
            startTime: '10:00',
            endTime: '16:00',
            maxBookingsPerDay: 5,
        });

        expect(parsed).toMatchObject({
            discountPercent: 10,
            deliveryType: 'included',
            deliveryFee: 0,
            durationMinutes: 60,
            availableDays: ['Бям', 'Ням'],
            startTime: '10:00',
            endTime: '16:00',
            maxBookingsPerDay: 5,
        });
    });

    // Documents the original bug: snake_case keys are unknown to the schema, so
    // safeParse drops them and the camelCase fields fall back to their defaults.
    // This is exactly why the form had to be switched to camelCase.
    it('drops snake_case keys (the original bug) — they fall back to defaults', () => {
        const result = createProductSchema.safeParse({
            name: 'X',
            price: 1000,
            discount_percent: 20,
            delivery_type: 'pickup_only',
            delivery_fee: 5000,
        });

        expect(result.success).toBe(true);
        if (result.success) {
            // Schema defaults win because the snake_case input was stripped.
            expect(result.data.discountPercent).toBe(0);
            expect(result.data.deliveryType).toBe('included');
            expect(result.data.deliveryFee).toBe(0);
        }
    });

    describe('availableDays enum (Mongolian labels)', () => {
        it('accepts the Mongolian short weekday labels the form submits', () => {
            const parsed = createProductSchema.parse({
                name: 'Маникюр',
                price: 20000,
                type: 'appointment',
                availableDays: ['Ням'],
            });
            expect(parsed.availableDays).toEqual(['Ням']);
        });

        it('rejects the old mon–sun codes (guards the chosen storage format)', () => {
            const result = createProductSchema.safeParse({
                name: 'Маникюр',
                price: 20000,
                type: 'appointment',
                availableDays: ['mon', 'tue'],
            });
            expect(result.success).toBe(false);
        });
    });
});
