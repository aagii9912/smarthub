/**
 * Checkout API route handler integration tests.
 *
 * Imports the exported route handlers directly and drives them with a fake
 * NextRequest (plain `Request` cast) + a params Promise, exactly as the App
 * Router would. CheckoutService, supabaseAdmin and the messenger module are
 * mocked so no network / DB is touched.
 *
 * Routes under test:
 *   GET    /api/checkout/[token]
 *   POST   /api/checkout/[token]/items
 *   PATCH  /api/checkout/[token]/items
 *   DELETE /api/checkout/[token]/items
 *   POST   /api/checkout/[token]/confirm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ─── Mock Dependencies ──────────────────────────────────────────
const mockChain: any = {};
const mockSupabase = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => mockSupabase),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/lib/services/CheckoutService', () => ({
    getCheckoutSummary: vi.fn(),
    performCheckout: vi.fn(),
}));
vi.mock('@/lib/facebook/messenger', () => ({
    sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET } from '@/app/api/checkout/[token]/route';
import { POST as ITEMS_POST, PATCH as ITEMS_PATCH, DELETE as ITEMS_DELETE } from '@/app/api/checkout/[token]/items/route';
import { POST as CONFIRM_POST } from '@/app/api/checkout/[token]/confirm/route';
import { getCheckoutSummary, performCheckout } from '@/lib/services/CheckoutService';

// ─── Helpers ────────────────────────────────────────────────────
const params = (token = 'cart-1') => ({ params: Promise.resolve({ token }) });

function req(url: string, init?: RequestInit): NextRequest {
    return new Request(url, init) as unknown as NextRequest;
}

function jsonReq(url: string, method: string, body: unknown): NextRequest {
    return req(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

const SUMMARY = {
    cartId: 'cart-1',
    shopId: 'shop-1',
    customerId: 'cust-1',
    status: 'active',
    shopName: 'Дэлгүүр',
    shopAddress: null,
    customerPhone: '99112233',
    customerAddress: 'БЗД',
    items: [{ id: 'ci-1', product_id: 'prod-1', name: 'Ноутбүүк', image: null, variant_specs: {}, quantity: 1, unit_price: 100, subtotal: 100, available_stock: 9 }],
    subtotal: 100,
    deliveryFee: 0,
    deliveryMethod: 'delivery' as const,
    total: 100,
    hasDeliveryItems: false,
    needsDeliveryInfo: false,
};

describe('Checkout API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultChain();
    });

    /**
     * Chainable Supabase mock matching the handler-order canonical style.
     * Defaults represent an active cart owned by shop-1 / cust-1.
     */
    function setupDefaultChain() {
        mockChain.select = vi.fn().mockReturnValue(mockChain);
        mockChain.eq = vi.fn().mockReturnValue(mockChain);
        mockChain.single = vi.fn().mockResolvedValue({
            data: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
            error: null,
        });
        mockChain.insert = vi.fn().mockResolvedValue({ error: null });
        mockChain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        });
        mockChain.delete = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        });
        mockSupabase.from.mockReturnValue(mockChain);
        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    }

    // ─── GET /api/checkout/[token] ───────────────────────────────
    describe('GET [token]', () => {
        it('returns 404 for an unknown token', async () => {
            vi.mocked(getCheckoutSummary).mockResolvedValueOnce(null);

            const res = await GET(req('http://localhost/api/checkout/nope'), params('nope'));

            expect(res.status).toBe(404);
            expect(vi.mocked(getCheckoutSummary)).toHaveBeenCalledWith('nope');
            const body = await res.json();
            expect(body.error).toBe('Сагс олдсонгүй');
        });

        it('returns 200 with the summary for a valid token', async () => {
            vi.mocked(getCheckoutSummary).mockResolvedValueOnce(SUMMARY);

            const res = await GET(req('http://localhost/api/checkout/cart-1'), params());

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual(SUMMARY);
            expect(body.cartId).toBe('cart-1');
            expect(body.total).toBe(100);
        });

        it('returns 500 when the service throws', async () => {
            vi.mocked(getCheckoutSummary).mockRejectedValueOnce(new Error('boom'));

            const res = await GET(req('http://localhost/api/checkout/cart-1'), params());

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toBe('Алдаа гарлаа');
        });
    });

    // ─── POST /api/checkout/[token]/items (add) ──────────────────
    describe('POST [token]/items', () => {
        it('returns 404 when the cart is not active', async () => {
            mockChain.single.mockResolvedValueOnce({
                data: { id: 'cart-1', shop_id: 'shop-1', status: 'converted' },
                error: null,
            });

            const res = await ITEMS_POST(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'POST', { product_id: 'prod-1' }),
                params(),
            );

            expect(res.status).toBe(404);
            expect(vi.mocked(performCheckout)).not.toHaveBeenCalled();
        });

        it('returns 400 when product_id is missing', async () => {
            const res = await ITEMS_POST(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'POST', {}),
                params(),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('product_id');
        });

        /**
         * Table-aware Supabase mock for the add-item path. `carts`, `products`
         * and `cart_items` each have distinct query shapes, so route them
         * separately instead of overloading the shared chain.
         */
        function buildAddItemSupabase(opts: {
            product: Record<string, unknown> | null;
            existingItems: Array<Record<string, unknown>>;
        }) {
            const insertSpy = vi.fn().mockResolvedValue({ error: null });
            const updateEqSpy = vi.fn().mockResolvedValue({ error: null });
            mockSupabase.from.mockImplementation((table: string) => {
                switch (table) {
                    case 'carts':
                        return {
                            select: vi.fn(() => ({
                                eq: vi.fn(() => ({
                                    single: vi.fn(() => Promise.resolve({
                                        data: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
                                        error: null,
                                    })),
                                })),
                            })),
                            update: vi.fn(() => ({ eq: updateEqSpy })),
                        };
                    case 'products':
                        return {
                            select: vi.fn(() => ({
                                eq: vi.fn(() => ({
                                    eq: vi.fn(() => ({
                                        single: vi.fn(() => Promise.resolve({ data: opts.product, error: null })),
                                    })),
                                })),
                            })),
                        };
                    case 'cart_items':
                        return {
                            select: vi.fn(() => ({
                                eq: vi.fn(() => ({
                                    eq: vi.fn(() => Promise.resolve({ data: opts.existingItems, error: null })),
                                })),
                            })),
                            insert: insertSpy,
                            update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
                        };
                    default:
                        return mockChain;
                }
            });
            return { insertSpy };
        }

        it('returns 400 when requested quantity exceeds available stock', async () => {
            buildAddItemSupabase({
                product: { id: 'prod-1', name: 'P', price: 100, stock: 2, reserved_stock: 0, discount_percent: null, is_active: true },
                existingItems: [],
            });

            const res = await ITEMS_POST(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'POST', { product_id: 'prod-1', quantity: 5 }),
                params(),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.available_stock).toBe(2);
        });

        it('inserts a new line and returns the fresh summary on success', async () => {
            const { insertSpy } = buildAddItemSupabase({
                product: { id: 'prod-1', name: 'P', price: 100, stock: 10, reserved_stock: 0, discount_percent: null, is_active: true },
                existingItems: [],
            });
            vi.mocked(getCheckoutSummary).mockResolvedValueOnce(SUMMARY);

            const res = await ITEMS_POST(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'POST', { product_id: 'prod-1', quantity: 1 }),
                params(),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.summary).toEqual(SUMMARY);
            expect(insertSpy).toHaveBeenCalledWith(
                expect.objectContaining({ cart_id: 'cart-1', product_id: 'prod-1', quantity: 1, unit_price: 100 }),
            );
        });
    });

    // ─── PATCH /api/checkout/[token]/items (set qty) ─────────────
    describe('PATCH [token]/items', () => {
        it('returns 400 when item_id or quantity is missing', async () => {
            const res = await ITEMS_PATCH(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'PATCH', { item_id: 'ci-1' }),
                params(),
            );

            expect(res.status).toBe(400);
        });

        it('deletes the line when quantity is 0 and returns the summary', async () => {
            // cart lookup (active), then item lookup belonging to the cart
            mockChain.single
                .mockResolvedValueOnce({
                    data: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { id: 'ci-1', cart_id: 'cart-1', products: { stock: 10, reserved_stock: 0 } },
                    error: null,
                });
            vi.mocked(getCheckoutSummary).mockResolvedValueOnce(SUMMARY);

            const res = await ITEMS_PATCH(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'PATCH', { item_id: 'ci-1', quantity: 0 }),
                params(),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(mockChain.delete).toHaveBeenCalled();
        });

        it('returns 404 when the item belongs to a different cart', async () => {
            mockChain.single
                .mockResolvedValueOnce({
                    data: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { id: 'ci-9', cart_id: 'other-cart', products: { stock: 10, reserved_stock: 0 } },
                    error: null,
                });

            const res = await ITEMS_PATCH(
                jsonReq('http://localhost/api/checkout/cart-1/items', 'PATCH', { item_id: 'ci-9', quantity: 2 }),
                params(),
            );

            expect(res.status).toBe(404);
        });
    });

    // ─── DELETE /api/checkout/[token]/items ──────────────────────
    describe('DELETE [token]/items', () => {
        it('returns 400 when item_id query param is missing', async () => {
            const res = await ITEMS_DELETE(
                req('http://localhost/api/checkout/cart-1/items', { method: 'DELETE' }),
                params(),
            );

            expect(res.status).toBe(400);
        });

        it('deletes a valid item and returns the fresh summary', async () => {
            mockChain.single
                .mockResolvedValueOnce({
                    data: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
                    error: null,
                })
                .mockResolvedValueOnce({ data: { id: 'ci-1', cart_id: 'cart-1' }, error: null });
            vi.mocked(getCheckoutSummary).mockResolvedValueOnce(SUMMARY);

            const res = await ITEMS_DELETE(
                req('http://localhost/api/checkout/cart-1/items?item_id=ci-1', { method: 'DELETE' }),
                params(),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.summary).toEqual(SUMMARY);
            expect(mockChain.delete).toHaveBeenCalled();
        });
    });

    // ─── POST /api/checkout/[token]/confirm ──────────────────────
    describe('POST [token]/confirm', () => {
        it('returns 404 for an unknown cart', async () => {
            mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

            const res = await CONFIRM_POST(
                jsonReq('http://localhost/api/checkout/cart-1/confirm', 'POST', {}),
                params(),
            );

            expect(res.status).toBe(404);
            expect(vi.mocked(performCheckout)).not.toHaveBeenCalled();
        });

        it('returns 409 when the cart is no longer active', async () => {
            mockChain.single.mockResolvedValueOnce({
                data: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'converted' },
                error: null,
            });

            const res = await CONFIRM_POST(
                jsonReq('http://localhost/api/checkout/cart-1/confirm', 'POST', {}),
                params(),
            );

            expect(res.status).toBe(409);
            const body = await res.json();
            expect(body.error).toContain('захиалга болсон');
            expect(vi.mocked(performCheckout)).not.toHaveBeenCalled();
        });

        it('returns 200 with paymentLink on a successful QPay checkout', async () => {
            vi.mocked(performCheckout).mockResolvedValueOnce({
                success: true,
                orderId: 'order-1',
                paymentId: 'pay-1',
                paymentLink: 'https://www.syncly.mn/pay/pay-1',
                qpay: true,
                paymentMethod: 'qpay',
                deliveryFee: 0,
                deliveryMethod: 'delivery',
                totalWithDelivery: 100,
                shop: null,
            });

            const res = await CONFIRM_POST(
                jsonReq('http://localhost/api/checkout/cart-1/confirm', 'POST', { payment_type: 'qpay' }),
                params(),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.orderId).toBe('order-1');
            expect(body.paymentLink).toBe('https://www.syncly.mn/pay/pay-1');
            expect(body.qpay).toBe(true);
            // paymentType from body flows through to the checkout core
            expect(vi.mocked(performCheckout)).toHaveBeenCalledWith(
                expect.objectContaining({ shopId: 'shop-1', customerId: 'cust-1', paymentType: 'qpay' }),
            );
        });

        it('persists phone/address before checkout when provided', async () => {
            vi.mocked(performCheckout).mockResolvedValueOnce({
                success: true,
                orderId: 'order-2',
                paymentId: 'pay-2',
                paymentLink: null,
                qpay: false,
                paymentMethod: 'cod',
                deliveryFee: 0,
                deliveryMethod: 'delivery',
                totalWithDelivery: 100,
                shop: null,
            });

            const res = await CONFIRM_POST(
                jsonReq('http://localhost/api/checkout/cart-1/confirm', 'POST', {
                    phone: ' 99112233 ',
                    address: 'БЗД 3-р хороо',
                    payment_type: 'cod',
                }),
                params(),
            );

            expect(res.status).toBe(200);
            // customers table updated with trimmed phone + address
            expect(mockSupabase.from).toHaveBeenCalledWith('customers');
            expect(mockChain.update).toHaveBeenCalledWith({ phone: '99112233', address: 'БЗД 3-р хороо' });
        });

        it('returns 422 when delivery info is still required', async () => {
            vi.mocked(performCheckout).mockResolvedValueOnce({
                success: true,
                awaitingDeliveryInfo: true,
                missingPhone: true,
                missingAddress: false,
                cartId: 'cart-1',
            });

            const res = await CONFIRM_POST(
                jsonReq('http://localhost/api/checkout/cart-1/confirm', 'POST', {}),
                params(),
            );

            expect(res.status).toBe(422);
            const body = await res.json();
            expect(body.needsDeliveryInfo).toBe(true);
            expect(body.missingPhone).toBe(true);
            expect(body.missingAddress).toBe(false);
        });

        it('returns 400 when the checkout core reports failure', async () => {
            vi.mocked(performCheckout).mockResolvedValueOnce({
                success: false,
                error: 'Сагс хоосон байна. Эхлээд бараа нэмнэ үү.',
            });

            const res = await CONFIRM_POST(
                jsonReq('http://localhost/api/checkout/cart-1/confirm', 'POST', {}),
                params(),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('хоосон');
        });
    });
});
