/**
 * Order Flow Integration Tests
 * Tests the complete order creation and management flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool, ToolExecutionContext } from '@/lib/ai/services/ToolExecutor';

// Mock Supabase with more realistic behavior
const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('@/lib/notifications', () => ({
    sendOrderNotification: vi.fn().mockResolvedValue({ success: 1, failed: 0 }),
    sendPushNotification: vi.fn().mockResolvedValue({ success: 1, failed: 0 }),
}));

vi.mock('@/lib/ai/helpers/stockHelpers', () => ({
    checkProductStock: vi.fn().mockResolvedValue({ available: true, currentStock: 10 }),
    getProductFromDB: vi.fn().mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
        price: 50000,
        stock: 10,
        discount_percent: null,
    }),
    addItemToCart: vi.fn().mockResolvedValue({ success: true, newQuantity: 1 }),
    getCartFromDB: vi.fn().mockResolvedValue({
        id: 'cart-1',
        items: [
            { id: 'item-1', product_id: 'prod-1', name: 'Test Product', quantity: 2, unit_price: 50000 },
        ],
        total_amount: 100000,
    }),
}));

describe('Order Flow Integration', () => {
    const mockContext: ToolExecutionContext = {
        shopId: 'shop-123',
        customerId: 'customer-456',
        customerName: 'Test Customer',
        products: [
            {
                id: 'prod-1',
                name: 'Test Product',
                price: 50000,
                stock: 10,
                description: 'A test product',
                image_url: 'https://example.com/image.jpg',
            },
        ],
        notifySettings: {
            order: true,
            contact: true,
            support: true,
            cancel: true,
        },
    };

    // Generic chainable used for product/order/customer/payment style queries.
    // Mirrors handler-order.test.ts: every chain method returns the chain and
    // the terminal calls resolve to sensible defaults.
    function buildGenericChain() {
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'prod-1', stock: 10, reserved_stock: 0, price: 50000 },
                            error: null
                        }),
                        order: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                            }),
                        }),
                    }),
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'prod-1', stock: 10, reserved_stock: 0, price: 50000 },
                        error: null
                    }),
                }),
                // performCheckout looks up products in bulk via .in('id', ids)
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'order-123' },
                        error: null
                    }),
                }),
            }),
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
            }),
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();

        // Table-aware default: `shops` returns a real owner row + a valid
        // Mongolian phone so executeRequestSupport can surface its «Залгах»
        // button (it now reads shops.user_id/name and shops.phone, and bails
        // out with success:false when no business phone is configured).
        // Every other table falls back to the generic product/order chain so
        // the cart + checkout flows keep working unchanged.
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'shops') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    id: 'shop-123',
                                    user_id: 'user-789',
                                    name: 'Test Shop',
                                    phone: '99001122',
                                    accepted_payment_methods: { cod: true, qpay: true, bank_transfer: true },
                                    account_number: null,
                                },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'customer_complaints') {
                return {
                    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
            }
            return buildGenericChain();
        });

        // executeRequestSupport reads shop owner email via the admin auth API;
        // it is wrapped in try/catch but provide a benign stub so it doesn't
        // throw and we stay on the happy path.
        (mockSupabase as Record<string, unknown>).auth = {
            admin: {
                getUserById: vi.fn().mockResolvedValue({ data: { user: { email: null } }, error: null }),
            },
        };

        mockSupabase.rpc.mockResolvedValue({ data: 'cart-123', error: null });
    });

    describe('Add to Cart Flow', () => {
        it('should add product to cart successfully', async () => {
            const result = await executeTool(
                'add_to_cart',
                { product_name: 'Test Product', quantity: 1 },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('сагсанд нэмэгдлээ');
        });

        it('should handle adding with variants', async () => {
            const result = await executeTool(
                'add_to_cart',
                { product_name: 'Test Product', quantity: 1, color: 'Red', size: 'M' },
                mockContext
            );

            expect(result.success).toBe(true);
        });

        it('should fail without customer context', async () => {
            const contextWithoutCustomer = { ...mockContext, customerId: undefined };

            const result = await executeTool(
                'add_to_cart',
                { product_name: 'Test Product', quantity: 1 },
                contextWithoutCustomer
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('customer');
        });
    });

    describe('View Cart Flow', () => {
        it('should view cart with items', async () => {
            const result = await executeTool('view_cart', {}, mockContext);

            expect(result.success).toBe(true);
            expect(result.message).toContain('сагс');
        });

        it('should fail without customer context', async () => {
            const contextWithoutCustomer = { ...mockContext, customerId: undefined };

            const result = await executeTool('view_cart', {}, contextWithoutCustomer);

            expect(result.success).toBe(false);
        });
    });

    describe('Remove from Cart Flow', () => {
        it('should remove product from cart', async () => {
            const result = await executeTool(
                'remove_from_cart',
                { product_name: 'Test Product' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('хасагдлаа');
        });
    });

    describe('Checkout Flow', () => {
        it('should complete checkout successfully', async () => {
            mockSupabase.rpc.mockResolvedValue({ data: 'order-xyz-123', error: null });

            const result = await executeTool(
                'checkout',
                { notes: 'Please deliver ASAP' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('амжилттай');
        });
    });

    describe('Show Product Image Flow', () => {
        it('should show single product image', async () => {
            const result = await executeTool(
                'show_product_image',
                { product_names: ['Test Product'], mode: 'single' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.imageAction).toBeDefined();
            expect(result.imageAction?.type).toBe('single');
        });

        it('should show gallery for multiple products', async () => {
            const multiProductContext = {
                ...mockContext,
                products: [
                    ...mockContext.products,
                    {
                        id: 'prod-2',
                        name: 'Second Product',
                        price: 30000,
                        stock: 5,
                        image_url: 'https://example.com/image2.jpg',
                    },
                ],
            };

            const result = await executeTool(
                'show_product_image',
                { product_names: ['Test Product', 'Second Product'], mode: 'confirm' },
                multiProductContext
            );

            expect(result.success).toBe(true);
            expect(result.imageAction?.products).toHaveLength(2);
        });
    });

    describe('Collect Contact Info Flow', () => {
        it('should save contact info', async () => {
            const result = await executeTool(
                'collect_contact_info',
                { phone: '99001122', name: 'John Doe' },
                mockContext
            );

            expect(result.success).toBe(true);
        });
    });

    describe('Request Human Support Flow', () => {
        it('should request human support', async () => {
            const result = await executeTool(
                'request_human_support',
                { reason: 'Need help with complex order' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('Дэлгүүрийн эзэнд мэдэгдэл илгээлээ');
            // The configured shop phone (99001122 → +97699001122) must surface
            // as a tap-to-call «Залгах» button.
            expect(result.actions).toEqual([
                {
                    type: 'support_actions',
                    buttons: [
                        {
                            id: 'call_phone',
                            label: '📞 Залгах',
                            icon: 'phone',
                            variant: 'secondary',
                            payload: 'CALL:+97699001122',
                        },
                    ],
                },
            ]);
        });
    });

    describe('Unknown Tool Handling', () => {
        it('should return error for unknown tool', async () => {
            const result = await executeTool(
                'unknown_tool' as never,
                {},
                mockContext
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown tool');
        });
    });
});
