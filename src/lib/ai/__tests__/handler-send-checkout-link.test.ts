/**
 * Send Checkout Link Handler Tests
 * Tests: executeSendCheckoutLink — emits an editable checkout-review link
 * for the customer's current cart.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext, createMockCart } from './fixtures';

// ─── Mock Dependencies ──────────────────────────────────────────
const mockChain: any = {};
const mockSupabase = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => mockSupabase),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/lib/notifications', () => ({
    sendOrderNotification: vi.fn().mockResolvedValue({ success: 1, failed: 0 }),
    sendPushNotification: vi.fn().mockResolvedValue({ success: 1, failed: 0 }),
}));
vi.mock('@/lib/ai/helpers/stockHelpers', () => ({
    getProductFromDB: vi.fn().mockResolvedValue(null),
    getCartFromDB: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/payment/qpay', () => ({
    createQPayInvoice: vi.fn(),
    createShopOrderInvoice: vi.fn(),
}));

import { executeSendCheckoutLink } from '@/lib/ai/tools/handlers/CartHandlers';
import { getCartFromDB } from '@/lib/ai/helpers/stockHelpers';

// Mirror the module-level constant the handler captures at import time.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

describe('executeSendCheckoutLink', () => {
    const ctx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();

        mockChain.select = vi.fn().mockReturnValue(mockChain);
        mockChain.eq = vi.fn().mockReturnValue(mockChain);
        mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        mockSupabase.from.mockReturnValue(mockChain);
        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    });

    it('fails when there is no customer context', async () => {
        const result = await executeSendCheckoutLink(
            createMockContext({ customerId: undefined })
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('No customer context');
        // Must short-circuit before ever touching the cart.
        expect(getCartFromDB).not.toHaveBeenCalled();
    });

    it('returns an empty-cart message and no link when the cart is null', async () => {
        vi.mocked(getCartFromDB).mockResolvedValueOnce(null);

        const result = await executeSendCheckoutLink(ctx);

        expect(getCartFromDB).toHaveBeenCalledWith(ctx.shopId, ctx.customerId);
        expect(result.success).toBe(true);
        expect(result.message).toContain('хоосон');
        // No checkout link should be produced for an empty cart.
        expect(result.message).not.toContain('/checkout/');
        expect(result.data).toEqual({ items: [], total: 0 });
        expect(result.data?.checkout_link).toBeUndefined();
    });

    it('returns an empty-cart message when the cart has no items', async () => {
        vi.mocked(getCartFromDB).mockResolvedValueOnce({
            id: 'cart-empty-001',
            items: [],
            total_amount: 0,
        } as any);

        const result = await executeSendCheckoutLink(ctx);

        expect(result.success).toBe(true);
        expect(result.message).toContain('хоосон');
        expect(result.message).not.toContain('/checkout/');
        expect(result.data).toEqual({ items: [], total: 0 });
    });

    it('returns a /checkout/<cart.id> link and checkout_link data when the cart has items', async () => {
        const cart = createMockCart();
        vi.mocked(getCartFromDB).mockResolvedValueOnce(cart);

        const result = await executeSendCheckoutLink(ctx);

        const expectedLink = `${SITE_URL}/checkout/${cart.id}`;
        expect(result.success).toBe(true);
        expect(result.message).toContain(`/checkout/${cart.id}`);
        expect(result.message).toContain(expectedLink);
        expect(result.data).toEqual({
            checkout_link: expectedLink,
            cart_id: cart.id,
            total: cart.total_amount,
        });
    });

    it('embeds the actual cart id in the link (not a hardcoded value)', async () => {
        const cart = createMockCart();
        cart.id = 'cart-custom-xyz';
        vi.mocked(getCartFromDB).mockResolvedValueOnce(cart);

        const result = await executeSendCheckoutLink(ctx);

        expect(result.success).toBe(true);
        expect(result.message).toContain(`${SITE_URL}/checkout/cart-custom-xyz`);
        expect(result.data?.checkout_link).toBe(`${SITE_URL}/checkout/cart-custom-xyz`);
        expect(result.data?.cart_id).toBe('cart-custom-xyz');
    });
});
