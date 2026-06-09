/**
 * CheckoutService unit tests.
 *
 * Covers calculateCartDelivery (per-product fees, pickup_only, included,
 * shop delivery_policy override), performCheckout (empty cart,
 * awaitingDeliveryInfo, COD / QPay / bank-fallback message flows), and
 * getCheckoutSummary (unknown token, item mapping, totals, needsDeliveryInfo).
 *
 * @/lib/utils/delivery runs for real (pure); everything else is mocked
 * following the canonical pattern in src/lib/ai/__tests__/handler-order.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Dependencies ──────────────────────────────────────────
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
    getCartFromDB: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/payment/qpay', () => ({
    createShopOrderInvoice: vi.fn(),
}));

import {
    calculateCartDelivery,
    performCheckout,
    getCheckoutSummary,
} from '@/lib/services/CheckoutService';
import { getCartFromDB } from '@/lib/ai/helpers/stockHelpers';
import { createShopOrderInvoice } from '@/lib/payment/qpay';
import { sendOrderNotification } from '@/lib/notifications';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

// ─── Table-aware Supabase mock builder ──────────────────────────
type ProductRow = { id: string; delivery_type: string | null; delivery_fee: number | null };

interface BuildOpts {
    customer?: { phone: string | null; address: string | null } | null;
    productsById?: Record<string, ProductRow>;
    /** Full shop payment config (also carries delivery_policy). */
    shop?: Record<string, unknown> | null;
    orderId?: string;
    paymentId?: string;
    /** Rows returned for getCheckoutSummary's cart_items query. */
    cartRow?: Record<string, unknown> | null;
    cartItems?: Array<Record<string, unknown>>;
    /** Capture inserted payment rows for assertions. */
    paymentInserts?: Array<Record<string, unknown>>;
}

function buildSupabase(opts: BuildOpts) {
    const {
        customer = null,
        productsById = {},
        shop = null,
        orderId = 'order-1',
        paymentId = 'pay-1',
        cartRow = null,
        cartItems = [],
        paymentInserts,
    } = opts;
    const productsList = Object.values(productsById);

    mockSupabase.from.mockImplementation((table: string) => {
        switch (table) {
            case 'products': {
                let capturedId: string | null = null;
                const chain: Record<string, unknown> = {};
                chain.select = vi.fn(() => chain);
                chain.eq = vi.fn((_col: string, val: string) => { capturedId = val; return chain; });
                chain.in = vi.fn(() => Promise.resolve({ data: productsList, error: null }));
                chain.single = vi.fn(() => Promise.resolve({
                    data: capturedId ? productsById[capturedId] ?? null : null,
                    error: null,
                }));
                return chain;
            }
            case 'customers': {
                const chain: Record<string, unknown> = {};
                chain.select = vi.fn(() => chain);
                chain.eq = vi.fn(() => chain);
                chain.single = vi.fn(() => Promise.resolve({ data: customer, error: null }));
                return chain;
            }
            case 'shops': {
                // calculateCartDelivery asks only for delivery_policy;
                // performCheckout / getCheckoutSummary want other columns.
                return {
                    select: vi.fn((cols: string) => {
                        const data = cols === 'delivery_policy'
                            ? (shop ? { delivery_policy: (shop as Record<string, unknown>).delivery_policy ?? null } : null)
                            : shop;
                        return { eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data, error: null })) })) };
                    }),
                };
            }
            case 'carts': {
                const chain: Record<string, unknown> = {};
                chain.select = vi.fn(() => chain);
                chain.eq = vi.fn(() => chain);
                chain.single = vi.fn(() => Promise.resolve({ data: cartRow, error: null }));
                return chain;
            }
            case 'cart_items': {
                const chain: Record<string, unknown> = {};
                chain.select = vi.fn(() => chain);
                chain.eq = vi.fn(() => Promise.resolve({ data: cartItems, error: null }));
                return chain;
            }
            case 'orders':
                return { update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) };
            case 'payments':
                return {
                    insert: vi.fn((row: Record<string, unknown>) => {
                        paymentInserts?.push(row);
                        return {
                            select: vi.fn(() => ({
                                single: vi.fn(() => Promise.resolve({ data: { id: paymentId }, error: null })),
                            })),
                        };
                    }),
                };
            default: {
                const chain: Record<string, unknown> = {};
                chain.select = vi.fn(() => chain);
                chain.eq = vi.fn(() => chain);
                chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
                return chain;
            }
        }
    });
    mockSupabase.rpc.mockResolvedValue({ data: orderId, error: null });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReset();
    mockSupabase.rpc.mockReset();
    vi.mocked(getCartFromDB).mockReset();
    vi.mocked(createShopOrderInvoice).mockReset();
    vi.mocked(sendOrderNotification).mockResolvedValue({ success: 1, failed: 0 } as never);
});

// ────────────────────────────────────────────────────────────────
describe('calculateCartDelivery', () => {
    it('accumulates per-product paid delivery fees and marks delivery method', async () => {
        buildSupabase({
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 5000 },
                'p2': { id: 'p2', delivery_type: 'paid', delivery_fee: 3000 },
            },
            shop: { delivery_policy: null },
        });

        const result = await calculateCartDelivery(
            'shop-1',
            [{ product_id: 'p1', quantity: 1 }, { product_id: 'p2', quantity: 2 }],
            100000,
            'БЗД 3-р хороо',
        );

        expect(result.totalDeliveryFee).toBe(8000);
        expect(result.deliveryMethod).toBe('delivery');
        expect(result.hasDeliveryItems).toBe(true);
        expect(result.hasPickupOnly).toBe(false);
    });

    it('returns pickup method when only pickup_only items exist', async () => {
        buildSupabase({
            productsById: {
                'p1': { id: 'p1', delivery_type: 'pickup_only', delivery_fee: null },
            },
            shop: { delivery_policy: null },
        });

        const result = await calculateCartDelivery(
            'shop-1',
            [{ product_id: 'p1', quantity: 1 }],
            50000,
            null,
        );

        expect(result.totalDeliveryFee).toBe(0);
        expect(result.deliveryMethod).toBe('pickup');
        expect(result.hasDeliveryItems).toBe(false);
        expect(result.hasPickupOnly).toBe(true);
    });

    it("treats 'included' as a deliverable item (no fee, delivery method)", async () => {
        buildSupabase({
            productsById: {
                'p1': { id: 'p1', delivery_type: 'included', delivery_fee: null },
                'p2': { id: 'p2', delivery_type: 'pickup_only', delivery_fee: null },
            },
            shop: { delivery_policy: null },
        });

        const result = await calculateCartDelivery(
            'shop-1',
            [{ product_id: 'p1', quantity: 1 }, { product_id: 'p2', quantity: 1 }],
            50000,
            null,
        );

        expect(result.totalDeliveryFee).toBe(0);
        // Has both a deliverable (included) and pickup_only -> delivery wins.
        expect(result.deliveryMethod).toBe('delivery');
        expect(result.hasDeliveryItems).toBe(true);
        expect(result.hasPickupOnly).toBe(true);
    });

    it('applies shop delivery_policy override (UB fee replaces per-product fees)', async () => {
        buildSupabase({
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 5000 },
            },
            shop: {
                delivery_policy: { ub_delivery_fee: 8000, province_delivery_fee: 20000, free_delivery_threshold: null },
            },
        });

        const result = await calculateCartDelivery(
            'shop-1',
            [{ product_id: 'p1', quantity: 1 }],
            100000,
            'Улаанбаатар, БЗД',
        );

        // Per-product 5000 is overridden by the policy's UB fee 8000.
        expect(result.totalDeliveryFee).toBe(8000);
        expect(result.deliveryMethod).toBe('delivery');
    });

    it('waives the override fee when cart subtotal meets free_delivery_threshold', async () => {
        buildSupabase({
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 5000 },
            },
            shop: {
                delivery_policy: { ub_delivery_fee: 8000, province_delivery_fee: 20000, free_delivery_threshold: 50000 },
            },
        });

        const result = await calculateCartDelivery(
            'shop-1',
            [{ product_id: 'p1', quantity: 1 }],
            100000, // >= threshold -> free
            'Улаанбаатар',
        );

        expect(result.totalDeliveryFee).toBe(0);
        expect(result.hasDeliveryItems).toBe(true);
    });

    it('does not query the shop policy when there are no deliverable items', async () => {
        buildSupabase({
            productsById: {
                'p1': { id: 'p1', delivery_type: 'pickup_only', delivery_fee: null },
            },
            shop: { delivery_policy: { ub_delivery_fee: 8000 } },
        });

        const result = await calculateCartDelivery(
            'shop-1',
            [{ product_id: 'p1', quantity: 1 }],
            100000,
            null,
        );

        expect(result.totalDeliveryFee).toBe(0);
        expect(result.deliveryMethod).toBe('pickup');
        // shops table should never be touched without delivery items.
        expect(mockSupabase.from).not.toHaveBeenCalledWith('shops');
    });
});

// ────────────────────────────────────────────────────────────────
describe('performCheckout', () => {
    function cart() {
        return {
            id: 'cart-1',
            items: [
                { product_id: 'p1', quantity: 1 },
                { product_id: 'p2', quantity: 2 },
            ],
            total_amount: 100000,
        };
    }

    it('returns success:false for an empty cart', async () => {
        vi.mocked(getCartFromDB).mockResolvedValueOnce({ id: 'cart-1', items: [], total_amount: 0 } as never);
        buildSupabase({});

        const result = await performCheckout({ shopId: 'shop-1', customerId: 'cust-1' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Сагс хоосон');
        expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns success:false when getCartFromDB returns null', async () => {
        vi.mocked(getCartFromDB).mockResolvedValueOnce(null as never);
        buildSupabase({});

        const result = await performCheckout({ shopId: 'shop-1', customerId: 'cust-1' });

        expect(result.success).toBe(false);
        expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns awaitingDeliveryInfo when delivery items exist but phone/address missing', async () => {
        vi.mocked(getCartFromDB).mockResolvedValueOnce(cart() as never);
        buildSupabase({
            customer: { phone: null, address: null },
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 5000 },
                'p2': { id: 'p2', delivery_type: null, delivery_fee: null },
            },
            shop: { name: 'Дэлгүүр', delivery_policy: null, accepted_payment_methods: { cod: true } },
        });

        const result = await performCheckout({ shopId: 'shop-1', customerId: 'cust-1' });

        expect(result.success).toBe(true);
        expect(result.awaitingDeliveryInfo).toBe(true);
        expect(result.cartId).toBe('cart-1');
        expect(result.itemCount).toBe(2);
        expect(result.cartAmount).toBe(100000);
        expect(result.deliveryFee).toBe(5000);
        expect(result.missingPhone).toBe(true);
        expect(result.missingAddress).toBe(true);
        // Order RPC must NOT fire while contact info is missing.
        expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('COD path: messageFlow cod, payment inserted, no payment link', async () => {
        const paymentInserts: Array<Record<string, unknown>> = [];
        vi.mocked(getCartFromDB).mockResolvedValueOnce(cart() as never);
        buildSupabase({
            customer: { phone: '99112233', address: 'БЗД 3-р хороо' },
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 5000 },
                'p2': { id: 'p2', delivery_type: null, delivery_fee: null },
            },
            shop: {
                name: 'Дэлгүүр',
                delivery_policy: null,
                accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                account_number: null,
            },
            orderId: 'order-cod-1',
            paymentId: 'pay-cod-1',
            paymentInserts,
        });

        const result = await performCheckout({
            shopId: 'shop-1',
            customerId: 'cust-1',
            paymentType: 'cod',
        });

        expect(result.success).toBe(true);
        expect(result.messageFlow).toBe('cod');
        expect(result.orderId).toBe('order-cod-1');
        expect(result.paymentId).toBe('pay-cod-1');
        expect(result.paymentLink).toBeNull();
        expect(result.qpay).toBe(false);
        expect(result.paymentMethod).toBe('cod');
        expect(result.cartAmount).toBe(100000);
        expect(result.deliveryFee).toBe(5000);
        expect(result.totalWithDelivery).toBe(105000);
        expect(result.deliveryMethod).toBe('delivery');
        // A COD payment row was inserted with the delivery-inclusive total.
        expect(paymentInserts).toHaveLength(1);
        expect(paymentInserts[0]).toMatchObject({
            payment_method: 'cod',
            amount: 105000,
            status: 'pending',
        });
        // QPay must never be attempted for a COD checkout.
        expect(createShopOrderInvoice).not.toHaveBeenCalled();
        expect(sendOrderNotification).toHaveBeenCalledWith('shop-1', 'new', expect.objectContaining({
            orderId: 'order-cod-1',
            totalAmount: 105000,
        }));
    });

    it('QPay path: messageFlow qpay with payment link when invoice succeeds', async () => {
        const paymentInserts: Array<Record<string, unknown>> = [];
        vi.mocked(getCartFromDB).mockResolvedValueOnce(cart() as never);
        vi.mocked(createShopOrderInvoice).mockResolvedValueOnce({
            invoice_id: 'inv-1',
            qr_text: 'QR',
            qr_image: 'IMG',
            urls: [],
            expiry_date: new Date(Date.now() + 900000).toISOString(),
        } as never);
        buildSupabase({
            customer: { phone: '99112233', address: 'БЗД' },
            productsById: {
                'p1': { id: 'p1', delivery_type: null, delivery_fee: null },
                'p2': { id: 'p2', delivery_type: null, delivery_fee: null },
            },
            shop: {
                name: 'Дэлгүүр',
                delivery_policy: null,
                accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                qpay_merchant_id: 'merch-1',
                qpay_status: 'active',
                qpay_bank_code: 'BANK',
                qpay_account_number: '0001',
                qpay_account_name: 'Shop',
                account_number: null,
            },
            orderId: 'order-qpay-1',
            paymentId: 'pay-qpay-1',
            paymentInserts,
        });

        const result = await performCheckout({
            shopId: 'shop-1',
            customerId: 'cust-1',
            paymentType: 'qpay',
        });

        expect(createShopOrderInvoice).toHaveBeenCalledTimes(1);
        expect(createShopOrderInvoice).toHaveBeenCalledWith(expect.objectContaining({
            shopMerchantId: 'merch-1',
            orderId: 'order-qpay-1',
            amount: 100000,
        }));
        expect(result.success).toBe(true);
        expect(result.messageFlow).toBe('qpay');
        expect(result.qpay).toBe(true);
        expect(result.paymentId).toBe('pay-qpay-1');
        expect(result.paymentLink).toBe(`${SITE_URL}/pay/pay-qpay-1`);
        expect(result.paymentMethod).toBe('qpay');
        expect(result.totalWithDelivery).toBe(100000);
        // The inserted payment carried the QPay invoice data.
        expect(paymentInserts).toHaveLength(1);
        expect(paymentInserts[0]).toMatchObject({
            payment_method: 'qpay',
            qpay_invoice_id: 'inv-1',
            amount: 100000,
        });
    });

    it('bank fallback: messageFlow bank when QPay unavailable but bank account set', async () => {
        const paymentInserts: Array<Record<string, unknown>> = [];
        vi.mocked(getCartFromDB).mockResolvedValueOnce(cart() as never);
        buildSupabase({
            customer: { phone: '99112233', address: 'БЗД' },
            productsById: {
                'p1': { id: 'p1', delivery_type: null, delivery_fee: null },
                'p2': { id: 'p2', delivery_type: null, delivery_fee: null },
            },
            shop: {
                name: 'Дэлгүүр',
                delivery_policy: null,
                accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                // No qpay_merchant_id / qpay_status -> QPay branch is skipped.
                bank_name: 'Хаан банк',
                account_number: '5001234567',
                account_name: 'Мөнх ХХК',
            },
            orderId: 'order-bank-1',
            paymentId: 'pay-bank-1',
            paymentInserts,
        });

        const result = await performCheckout({
            shopId: 'shop-1',
            customerId: 'cust-1',
            paymentType: 'qpay', // requested QPay, but merchant not configured
        });

        expect(createShopOrderInvoice).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.messageFlow).toBe('bank');
        expect(result.qpay).toBe(false);
        expect(result.paymentLink).toBeNull();
        expect(result.paymentId).toBe('pay-bank-1');
        expect(result.paymentMethod).toBe('bank_transfer');
        expect(result.shop).toMatchObject({
            bank_name: 'Хаан банк',
            account_number: '5001234567',
            account_name: 'Мөнх ХХК',
        });
        expect(paymentInserts).toHaveLength(1);
        expect(paymentInserts[0]).toMatchObject({
            payment_method: 'bank_transfer',
            amount: 100000,
        });
    });
});

// ────────────────────────────────────────────────────────────────
describe('getCheckoutSummary', () => {
    it('returns null for an unknown token (cart not found)', async () => {
        buildSupabase({ cartRow: null });

        const result = await getCheckoutSummary('does-not-exist');

        expect(result).toBeNull();
    });

    it('maps items and computes subtotal/deliveryFee/total with needsDeliveryInfo false', async () => {
        buildSupabase({
            cartRow: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
            cartItems: [
                {
                    id: 'ci-1',
                    product_id: 'p1',
                    variant_specs: { color: 'хар' },
                    quantity: 2,
                    unit_price: 10000,
                    products: { name: 'Бараа A', image_url: 'a.jpg', stock: 10, reserved_stock: 3 },
                },
                {
                    id: 'ci-2',
                    product_id: 'p2',
                    variant_specs: null,
                    quantity: 1,
                    unit_price: 5000,
                    products: [{ name: 'Бараа B', image_url: null, stock: 4, reserved_stock: 0 }],
                },
            ],
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 3000 },
                'p2': { id: 'p2', delivery_type: null, delivery_fee: null },
            },
            shop: { name: 'Дэлгүүр', address: 'Хаяг', delivery_policy: null },
            customer: { phone: '99112233', address: 'БЗД 3-р хороо' },
        });

        const result = await getCheckoutSummary('cart-1');

        expect(result).not.toBeNull();
        expect(result!.cartId).toBe('cart-1');
        expect(result!.shopName).toBe('Дэлгүүр');
        expect(result!.customerPhone).toBe('99112233');
        expect(result!.items).toHaveLength(2);

        // Item 1: object-shaped products relation, available_stock = stock - reserved.
        expect(result!.items[0]).toMatchObject({
            id: 'ci-1',
            name: 'Бараа A',
            image: 'a.jpg',
            variant_specs: { color: 'хар' },
            quantity: 2,
            unit_price: 10000,
            subtotal: 20000,
            available_stock: 7,
        });
        // Item 2: array-shaped products relation, null image, empty variant_specs.
        expect(result!.items[1]).toMatchObject({
            id: 'ci-2',
            name: 'Бараа B',
            image: null,
            variant_specs: {},
            subtotal: 5000,
            available_stock: 4,
        });

        expect(result!.subtotal).toBe(25000);
        expect(result!.deliveryFee).toBe(3000);
        expect(result!.total).toBe(28000);
        expect(result!.hasDeliveryItems).toBe(true);
        expect(result!.needsDeliveryInfo).toBe(false);
    });

    it('sets needsDeliveryInfo true when delivery items exist but customer address is missing', async () => {
        buildSupabase({
            cartRow: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
            cartItems: [
                {
                    id: 'ci-1',
                    product_id: 'p1',
                    variant_specs: {},
                    quantity: 1,
                    unit_price: 10000,
                    products: { name: 'Бараа A', image_url: null, stock: 5, reserved_stock: 0 },
                },
            ],
            productsById: {
                'p1': { id: 'p1', delivery_type: 'paid', delivery_fee: 3000 },
            },
            shop: { name: 'Дэлгүүр', address: null, delivery_policy: null },
            customer: { phone: '99112233', address: null },
        });

        const result = await getCheckoutSummary('cart-1');

        expect(result).not.toBeNull();
        expect(result!.subtotal).toBe(10000);
        expect(result!.deliveryFee).toBe(3000);
        expect(result!.total).toBe(13000);
        expect(result!.hasDeliveryItems).toBe(true);
        expect(result!.needsDeliveryInfo).toBe(true);
    });

    it('falls back to defaults for missing shop name and empty items', async () => {
        buildSupabase({
            cartRow: { id: 'cart-1', shop_id: 'shop-1', customer_id: 'cust-1', status: 'active' },
            cartItems: [],
            productsById: {},
            shop: { name: null, address: null, delivery_policy: null },
            customer: { phone: null, address: null },
        });

        const result = await getCheckoutSummary('cart-1');

        expect(result).not.toBeNull();
        expect(result!.shopName).toBe('Дэлгүүр');
        expect(result!.items).toHaveLength(0);
        expect(result!.subtotal).toBe(0);
        // No deliverable items -> no fee, pickup-ish, and no delivery info needed.
        expect(result!.deliveryFee).toBe(0);
        expect(result!.total).toBe(0);
        expect(result!.hasDeliveryItems).toBe(false);
        expect(result!.needsDeliveryInfo).toBe(false);
    });
});
