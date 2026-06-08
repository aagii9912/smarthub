/**
 * Order Handler Tests
 * Tests: create_order, cancel_order, update_order, check_order_status, checkout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext, createMockOrder, createMockCart } from './fixtures';

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
    getProductFromDB: vi.fn().mockResolvedValue({
        id: 'prod-1', name: 'Ноутбүүк Pro 15', price: 2500000, stock: 10,
        discount_percent: null,
    }),
    getCartFromDB: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/payment/qpay', () => ({
    createQPayInvoice: vi.fn().mockResolvedValue({ qpay_shorturl: 'https://qpay.mn/test' }),
    createShopOrderInvoice: vi.fn(),
}));

import {
    executeCreateOrder,
    executeCancelOrder,
    executeCheckOrderStatus,
    executeCheckout,
    executeUpdateOrder,
} from '@/lib/ai/tools/handlers/OrderHandlers';
import { getCartFromDB } from '@/lib/ai/helpers/stockHelpers';
import { createShopOrderInvoice } from '@/lib/payment/qpay';

describe('OrderHandlers', () => {
    const ctx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
        setupDefaultChain();
    });

    function setupDefaultChain() {
        const singleFn = vi.fn().mockResolvedValue({
            data: { id: 'prod-1', stock: 10, reserved_stock: 0, price: 2500000 },
            error: null,
        });

        mockChain.select = vi.fn().mockReturnValue(mockChain);
        mockChain.eq = vi.fn().mockReturnValue(mockChain);
        mockChain.gt = vi.fn().mockReturnValue(mockChain);
        mockChain.order = vi.fn().mockReturnValue(mockChain);
        mockChain.limit = vi.fn().mockReturnValue(mockChain);
        mockChain.in = vi.fn().mockResolvedValue({ data: [], error: null });
        mockChain.single = singleFn;
        mockChain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'order-new-001' }, error: null }),
            }),
        });
        mockChain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        });
        mockChain.delete = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        });

        mockSupabase.from.mockReturnValue(mockChain);
        mockSupabase.rpc.mockResolvedValue({ data: 'checkout-order-001', error: null });
    }

    // ─── create_order ────────────────────────────────────────────
    describe('executeCreateOrder', () => {
        it('should create order for valid product', async () => {
            // No duplicate order found
            mockChain.single
                .mockResolvedValueOnce({ data: { id: 'prod-1', stock: 10, reserved_stock: 0, price: 2500000 }, error: null }) // product query
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }); // no duplicate

            const result = await executeCreateOrder(
                { product_name: 'Ноутбүүк', quantity: 1 },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('Success');
            expect(result.data?.orderId).toBeDefined();
        });

        it('should fail for unknown product', async () => {
            const result = await executeCreateOrder(
                { product_name: 'Байхгүй бараа', quantity: 1 },
                ctx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should fail when stock insufficient', async () => {
            mockChain.single.mockResolvedValueOnce({
                data: { id: 'prod-1', stock: 1, reserved_stock: 1, price: 2500000 },
                error: null,
            });

            const result = await executeCreateOrder(
                { product_name: 'Ноутбүүк', quantity: 5 },
                ctx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Үлдэгдэл');
        });

        it('should fail without shopId or customerId', async () => {
            const noCustomerCtx = createMockContext({ customerId: undefined });

            const result = await executeCreateOrder(
                { product_name: 'Ноутбүүк', quantity: 1 },
                noCustomerCtx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing');
        });
    });

    // ─── cancel_order ────────────────────────────────────────────
    describe('executeCancelOrder', () => {
        it('should cancel pending order', async () => {
            const order = createMockOrder();
            mockChain.single.mockResolvedValueOnce({ data: order, error: null });

            const result = await executeCancelOrder({ reason: 'Эргэж бодлоо' }, ctx);

            expect(result.success).toBe(true);
            expect(result.message).toContain('cancelled');
        });

        it('should fail without customer context', async () => {
            const result = await executeCancelOrder(
                { reason: 'test' },
                createMockContext({ customerId: undefined })
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('customer');
        });

        it('should fail when no pending order exists', async () => {
            mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

            const result = await executeCancelOrder({ reason: 'test' }, ctx);

            expect(result.success).toBe(false);
            expect(result.error).toContain('No pending order');
        });
    });

    // ─── check_order_status ──────────────────────────────────────
    describe('executeCheckOrderStatus', () => {
        it('should return order status list', async () => {
            // Override the terminal call to return an array (not .single())
            // check_order_status doesn't use .single(), it uses the query result directly
            const ordersData = [
                {
                    id: 'order-001-full-uuid',
                    status: 'pending',
                    total: 2500000,
                    created_at: new Date().toISOString(),
                    order_items: [{ product_name: 'Ноутбүүк Pro 15', quantity: 1, unit_price: 2500000 }],
                },
            ];

            // Override chain to act as non-single query
            mockChain.eq = vi.fn().mockReturnValue(mockChain);
            mockChain.order = vi.fn().mockReturnValue(mockChain);
            mockChain.limit = vi.fn().mockResolvedValue({ data: ordersData, error: null });

            const result = await executeCheckOrderStatus({}, ctx);

            expect(result.success).toBe(true);
            expect(result.message).toContain('захиалгууд');
            expect(result.data?.orders).toBeDefined();
        });

        it('should return empty message when no orders', async () => {
            mockChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
            mockChain.eq = vi.fn().mockReturnValue(mockChain);
            mockChain.order = vi.fn().mockReturnValue(mockChain);

            const result = await executeCheckOrderStatus({}, ctx);

            expect(result.success).toBe(true);
            expect(result.message).toContain('байхгүй');
        });
    });

    // ─── checkout ────────────────────────────────────────────────
    describe('executeCheckout', () => {
        const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

        /**
         * Table-aware Supabase mock that satisfies BOTH the legacy inline
         * executeCheckout queries and the `performCheckout` core it now
         * delegates to. Because the same mock + assertions stay green across
         * the refactor, these tests are the byte-for-byte regression guard for
         * the live checkout messages / data / actions.
         */
        function buildCheckoutSupabase(opts: {
            customer: { phone: string | null; address: string | null };
            productsById: Record<string, { id: string; delivery_type: string | null; delivery_fee: number | null }>;
            shop: Record<string, unknown> | null;
            orderId: string;
            paymentId: string;
        }) {
            const { customer, productsById, shop, orderId, paymentId } = opts;
            const productsList = Object.values(productsById);

            mockSupabase.from.mockImplementation((table: string) => {
                switch (table) {
                    case 'products': {
                        // Legacy path queries per-item (.eq('id').single());
                        // performCheckout queries in bulk (.in('id', ids)).
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
                        // every other caller wants the full payment config.
                        return {
                            select: vi.fn((cols: string) => {
                                const data = cols === 'delivery_policy'
                                    ? (shop ? { delivery_policy: (shop as Record<string, unknown>).delivery_policy ?? null } : null)
                                    : shop;
                                return { eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data, error: null })) })) };
                            }),
                        };
                    }
                    case 'orders':
                        return { update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) };
                    case 'payments':
                        return {
                            insert: vi.fn(() => ({
                                select: vi.fn(() => ({
                                    single: vi.fn(() => Promise.resolve({ data: { id: paymentId }, error: null })),
                                })),
                            })),
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

        it('should checkout with cart items', async () => {
            const cart = createMockCart();
            vi.mocked(getCartFromDB).mockResolvedValueOnce(cart);
            mockSupabase.rpc.mockResolvedValueOnce({ data: 'order-checkout-001', error: null });

            const result = await executeCheckout({ notes: 'Хурдан хүргээрэй' }, ctx);

            expect(result.success).toBe(true);
            expect(result.message).toContain('амжилттай');
            expect(result.data?.order_id).toBeDefined();
        });

        it('should fail with empty cart', async () => {
            vi.mocked(getCartFromDB).mockResolvedValueOnce(null);

            const result = await executeCheckout({}, ctx);

            expect(result.success).toBe(false);
            expect(result.error).toContain('хоосон');
        });

        it('should fail without customer', async () => {
            const result = await executeCheckout(
                {},
                createMockContext({ customerId: undefined })
            );

            expect(result.success).toBe(false);
        });

        // ─── COD success (with per-product delivery fee) ──────────
        it('COD success: builds delivery breakdown message + cod data', async () => {
            vi.mocked(getCartFromDB).mockResolvedValueOnce(createMockCart());
            buildCheckoutSupabase({
                customer: { phone: '99112233', address: 'БЗД 3-р хороо' },
                productsById: {
                    'prod-1': { id: 'prod-1', delivery_type: 'paid', delivery_fee: 5000 },
                    'prod-2': { id: 'prod-2', delivery_type: null, delivery_fee: null },
                },
                shop: {
                    name: 'Дэлгүүр',
                    delivery_policy: null,
                    accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                    account_number: null,
                },
                orderId: 'order-cod-001',
                paymentId: 'pay-cod-001',
            });

            const result = await executeCheckout({ notes: 'Хурдан хүргээрэй' }, ctx);

            const cartAmount = (2556000).toLocaleString();
            const totalAmount = (2561000).toLocaleString();
            const fee = (5000).toLocaleString();
            expect(result.success).toBe(true);
            expect(result.message).toBe(
                `✅ Захиалга #order-co амжилттай үүслээ!\n🛍️ Бараа: ${cartAmount}₮\n🚚 Хүргэлт: ${fee}₮\n💰 Нийт: ${totalAmount}₮\n\n📦 Төлбөрийн хэлбэр: Хүргэлтээр (бараа хүргэгдсэний дараа төлнө)\n\nХүргэлтийн ажилтан тантай удахгүй холбогдоно. Баярлалаа! 🙏`,
            );
            expect(result.data).toEqual({
                order_id: 'order-cod-001',
                payment_id: 'pay-cod-001',
                payment_link: null,
                qpay: false,
                payment_type: 'cod',
                delivery_fee: 5000,
                delivery_method: 'delivery',
            });
        });

        // ─── QPay success ─────────────────────────────────────────
        it('QPay success: builds payment-link message + qpay data', async () => {
            vi.mocked(getCartFromDB).mockResolvedValueOnce(createMockCart());
            vi.mocked(createShopOrderInvoice).mockResolvedValueOnce({
                invoice_id: 'inv-1',
                qr_text: 'QR',
                qr_image: 'IMG',
                urls: [],
                expiry_date: new Date(Date.now() + 900000).toISOString(),
            } as Awaited<ReturnType<typeof createShopOrderInvoice>>);
            buildCheckoutSupabase({
                customer: { phone: null, address: null },
                productsById: {
                    'prod-1': { id: 'prod-1', delivery_type: null, delivery_fee: null },
                    'prod-2': { id: 'prod-2', delivery_type: null, delivery_fee: null },
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
                orderId: 'order-qpay-01',
                paymentId: 'pay-qpay-01',
            });

            const result = await executeCheckout({ payment_type: 'qpay' }, ctx);

            const totalAmount = (2556000).toLocaleString();
            const link = `${SITE_URL}/pay/pay-qpay-01`;
            expect(result.success).toBe(true);
            expect(result.message).toBe(
                `Захиалга амжилттай үүслээ! 🎉\n\nНийт: ${totalAmount}₮\n\n💳 Төлбөр төлөх линк:\n${link}\n\n👆 Линк дээр дарж төлбөрөө төлнө үү`,
            );
            expect(result.data).toEqual({
                order_id: 'order-qpay-01',
                payment_id: 'pay-qpay-01',
                payment_link: link,
                qpay: true,
                delivery_fee: 0,
                delivery_method: 'delivery',
            });
        });

        // ─── Bank fallback ────────────────────────────────────────
        it('bank fallback: builds transfer instructions message + button action', async () => {
            vi.mocked(getCartFromDB).mockResolvedValueOnce(createMockCart());
            buildCheckoutSupabase({
                customer: { phone: null, address: null },
                productsById: {
                    'prod-1': { id: 'prod-1', delivery_type: null, delivery_fee: null },
                    'prod-2': { id: 'prod-2', delivery_type: null, delivery_fee: null },
                },
                shop: {
                    name: 'Дэлгүүр',
                    delivery_policy: null,
                    accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                    bank_name: 'Хаан банк',
                    account_number: '5001234567',
                    account_name: 'Мөнх ХХК',
                },
                orderId: 'order-bank-01',
                paymentId: 'pay-bank-01',
            });

            const result = await executeCheckout({ payment_type: 'bank' }, ctx);

            const totalAmount = (2556000).toLocaleString();
            expect(result.success).toBe(true);
            expect(result.message).toBe(
                `✅ Захиалга #order-ba амжилттай үүслээ!\nНийт дүн: ${totalAmount}₮\n\n💳 Дансаар шилжүүлэх:\nБанк: Хаан банк\nДанс: 5001234567\nНэр: Мөнх ХХК\nГүйлгээний утга: order-ba\n\n*Шилжүүлсэн бол баримтаа илгээнэ үү.`,
            );
            expect(result.data).toEqual({
                order_id: 'order-bank-01',
                payment_id: 'pay-bank-01',
                payment_link: null,
                qpay: false,
                delivery_fee: 0,
                delivery_method: 'delivery',
            });
            expect(result.actions).toEqual([
                {
                    type: 'payment_method',
                    buttons: [
                        { id: 'pay_bank', label: '💳 Дансаар шилжүүлэх', icon: 'bank', variant: 'primary', payload: 'PAY_BANK' },
                    ],
                    context: { order_id: 'order-bank-01' },
                },
            ]);
        });

        // ─── Awaiting delivery info (missing phone/address) ───────
        it('awaiting delivery info: blocks checkout and asks for contact', async () => {
            vi.mocked(getCartFromDB).mockResolvedValueOnce(createMockCart());
            buildCheckoutSupabase({
                customer: { phone: null, address: null },
                productsById: {
                    'prod-1': { id: 'prod-1', delivery_type: 'paid', delivery_fee: 5000 },
                    'prod-2': { id: 'prod-2', delivery_type: null, delivery_fee: null },
                },
                shop: {
                    name: 'Дэлгүүр',
                    delivery_policy: null,
                    accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                },
                orderId: 'order-should-not-be-used',
                paymentId: 'pay-x',
            });

            const result = await executeCheckout({}, ctx);

            const cartAmount = (2556000).toLocaleString();
            const fee = (5000).toLocaleString();
            expect(result.success).toBe(true);
            expect(result.message).toBe(
                `🛒 Сагсанд 2 бараа (${cartAmount}₮) + Хүргэлт ${fee}₮\n\nТөлбөр хийхийн өмнө дараах мэдээлэл хэрэгтэй:\n📱 Утасны дугаар\n📍 Хүргэх хаяг\n\nЖишээ: "99112233, БЗД 3-р хороо, 15-р байр"`,
            );
            expect(result.data).toEqual({ awaiting_delivery_info: true, cart_id: 'cart-test-001' });
            // checkout_cart RPC must NOT fire when contact info is missing
            expect(mockSupabase.rpc).not.toHaveBeenCalled();
        });
    });

    // ─── update_order ────────────────────────────────────────────
    describe('executeUpdateOrder', () => {
        it('should change quantity', async () => {
            const order = createMockOrder();
            mockChain.single.mockResolvedValueOnce({ data: order, error: null });

            const result = await executeUpdateOrder(
                { action: 'change_quantity', product_name: 'Ноутбүүк', new_quantity: 3 },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('өөрчиллөө');
            expect(result.data?.new_quantity).toBe(3);
        });

        it('should remove item from order', async () => {
            const order = createMockOrder({
                order_items: [
                    {
                        id: 'oi-1',
                        product_id: 'prod-1',
                        product_name: 'Ноутбүүк Pro 15',
                        products: { name: 'Ноутбүүк Pro 15' },
                        quantity: 1,
                        unit_price: 2500000,
                    },
                    {
                        id: 'oi-2',
                        product_id: 'prod-2',
                        product_name: 'Утасны гэр',
                        products: { name: 'Утасны гэр' },
                        quantity: 2,
                        unit_price: 28000,
                    },
                ],
            });
            mockChain.single.mockResolvedValueOnce({ data: order, error: null });

            const result = await executeUpdateOrder(
                { action: 'remove_item', product_name: 'Утасны гэр' },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('хасагдлаа');
        });

        it('should update notes', async () => {
            const order = createMockOrder();
            mockChain.single.mockResolvedValueOnce({ data: order, error: null });

            const result = await executeUpdateOrder(
                { action: 'update_notes', notes: 'Шинэ тэмдэглэл' },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('тэмдэглэл');
        });

        it('should fail when no pending order', async () => {
            mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

            const result = await executeUpdateOrder(
                { action: 'change_quantity', product_name: 'X', new_quantity: 1 },
                ctx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('олдсонгүй');
        });
    });
});
