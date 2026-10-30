/**
 * getActiveCartForAI — loads ChatContext.activeCart for routeToAI callers.
 * Without it the prompt always rendered "ОДООГИЙН САГС: Хоосон", even for
 * customers with items in their cart.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const tableResults: Record<string, { data: unknown; error: unknown }> = {};
const fromMock = vi.fn((table: string) => {
    const result = () => Promise.resolve(tableResults[table] ?? { data: null, error: null });
    const builder = {
        select: () => builder,
        eq: () => builder,
        single: result,
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            result().then(onFulfilled, onRejected),
    };
    return builder;
});

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => ({ from: fromMock })),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { getActiveCartForAI } from '@/lib/ai/helpers/stockHelpers';
import { buildSystemPrompt } from '@/lib/ai/services/PromptService';
import { logger } from '@/lib/utils/logger';

const MARKER = '=== ЭНЭ ХАРИЛЦАГЧ / ЭНЭ ЯРИА ===';

describe('getActiveCartForAI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(tableResults)) delete tableResults[key];
    });

    it('maps the active cart to ActiveCart and the prompt shows its items', async () => {
        tableResults.carts = { data: { id: 'cart-1' }, error: null };
        tableResults.cart_items = {
            data: [
                { id: 'i1', product_id: 'p1', quantity: 2, unit_price: '25000', variant_specs: { size: 'M' }, products: { name: 'Цамц' } },
                { id: 'i2', product_id: 'p2', quantity: 1, unit_price: 40000, variant_specs: null, products: [{ name: 'Өмд' }] },
            ],
            error: null,
        };

        const cart = await getActiveCartForAI('shop-1', 'cust-1');

        expect(cart).toEqual({
            id: 'cart-1',
            total_amount: 90000,
            items: [
                { id: 'i1', product_id: 'p1', name: 'Цамц', variant_specs: { size: 'M' }, quantity: 2, unit_price: 25000 },
                { id: 'i2', product_id: 'p2', name: 'Өмд', variant_specs: {}, quantity: 1, unit_price: 40000 },
            ],
        });

        const prompt = buildSystemPrompt({ shopId: 'shop-1', shopName: 'Shop', products: [], activeCart: cart });
        const conversation = prompt.slice(prompt.indexOf(MARKER));
        expect(prompt).not.toContain('ОДООГИЙН САГС: Хоосон');
        expect(conversation).toContain('- Цамц (x2): 50,000₮');
        expect(conversation).toContain('НИЙТ: 90,000₮');
    });

    it('returns undefined when the customer has no active cart', async () => {
        tableResults.carts = { data: null, error: { code: 'PGRST116' } };

        await expect(getActiveCartForAI('shop-1', 'cust-1')).resolves.toBeUndefined();
        expect(fromMock).not.toHaveBeenCalledWith('cart_items');
    });

    it('degrades to undefined instead of throwing when the lookup fails', async () => {
        fromMock.mockImplementationOnce(() => {
            throw new Error('network down');
        });

        await expect(getActiveCartForAI('shop-1', 'cust-1')).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(
            'Failed to load active cart for AI context',
            expect.objectContaining({ shopId: 'shop-1', customerId: 'cust-1' }),
        );
    });
});
