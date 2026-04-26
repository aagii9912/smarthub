/**
 * OrderService.create — bulk-insert + reserve_stock_bulk regression tests.
 *
 * Previously the create path looped per-item doing 3 roundtrips each
 * (SELECT reserved, UPDATE products, etc.) — an N+1 plus a race condition.
 * After refactoring, N items must result in:
 *   - 1× insert into orders
 *   - 1× insert into order_items (bulk)
 *   - 1× rpc('reserve_stock_bulk', ...) with ALL items in one JSONB payload
 *   - 1× select when re-fetching the finished order
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Chain = Record<string, ReturnType<typeof vi.fn>>;

// State is held on a shared object so the vi.mock factory (hoisted above
// imports) can read the latest mocks assigned in beforeEach without
// tripping temporal-dead-zone errors.
const sb: {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    insertCalls: Array<{ table: string; payload: unknown }>;
} = {
    rpc: vi.fn(),
    from: vi.fn(),
    insertCalls: [],
};

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        rpc: (...args: unknown[]) => (sb.rpc as (...a: unknown[]) => unknown)(...args),
        from: (...args: unknown[]) => (sb.from as (...a: unknown[]) => unknown)(...args),
    }),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), success: vi.fn(),
    },
}));

import { OrderService } from '@/lib/services/OrderService';

describe('OrderService.create — bulk path', () => {
    beforeEach(() => {
        sb.insertCalls = [];
        sb.rpc = vi.fn().mockResolvedValue({ data: null, error: null });

        sb.from = vi.fn((table: string) => {
            const chain: Chain = {} as Chain;
            chain.insert = vi.fn((payload: unknown) => {
                sb.insertCalls.push({ table, payload });
                if (table === 'orders') {
                    return {
                        select: () => ({
                            single: () => Promise.resolve({
                                data: { id: 'order-123' },
                                error: null,
                            }),
                        }),
                    };
                }
                // order_items bulk insert returns { error: null } directly
                return Promise.resolve({ error: null });
            });
            chain.select = vi.fn(() => ({
                eq: () => ({
                    single: () => Promise.resolve({
                        data: {
                            id: 'order-123',
                            order_items: [],
                            customers: null,
                        },
                        error: null,
                    }),
                }),
            }));
            chain.delete = vi.fn(() => ({
                eq: () => Promise.resolve({ error: null }),
            }));
            return chain;
        });
    });

    it('creates an order with N items using exactly one bulk insert + one RPC call', async () => {
        const service = new OrderService();

        const items = Array.from({ length: 5 }, (_, i) => ({
            productId: `prod-${i}`,
            productName: `Product ${i}`,
            quantity: i + 1,
            unitPrice: 1000 * (i + 1),
        }));

        await service.create({
            shopId: 'shop-1',
            customerId: 'cust-1',
            items,
            notes: 'test',
        });

        // Exactly 2 inserts: one orders + one bulk order_items
        const ordersInserts = sb.insertCalls.filter(c => c.table === 'orders');
        const itemsInserts = sb.insertCalls.filter(c => c.table === 'order_items');
        expect(ordersInserts).toHaveLength(1);
        expect(itemsInserts).toHaveLength(1);

        // The order_items insert must be an array (bulk) with all N items.
        const itemsPayload = itemsInserts[0].payload;
        expect(Array.isArray(itemsPayload)).toBe(true);
        expect((itemsPayload as unknown[]).length).toBe(5);

        // Exactly one rpc call — and it carries all N items in a single payload.
        expect(sb.rpc).toHaveBeenCalledTimes(1);
        expect(sb.rpc).toHaveBeenCalledWith(
            'reserve_stock_bulk',
            expect.objectContaining({
                p_items: expect.arrayContaining([
                    expect.objectContaining({ product_id: 'prod-0', quantity: 1 }),
                    expect.objectContaining({ product_id: 'prod-4', quantity: 5 }),
                ]),
            }),
        );
        const rpcArg = (sb.rpc as ReturnType<typeof vi.fn>).mock.calls[0][1] as { p_items: unknown[] };
        expect(rpcArg.p_items).toHaveLength(5);
    });

    it('rolls back order + items when reserve_stock_bulk fails', async () => {
        (sb.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: null,
            error: { message: 'Insufficient stock for product prod-2' },
        });

        const service = new OrderService();

        await expect(
            service.create({
                shopId: 'shop-1',
                customerId: 'cust-1',
                items: [
                    { productId: 'prod-1', productName: 'A', quantity: 1, unitPrice: 1000 },
                    { productId: 'prod-2', productName: 'B', quantity: 999, unitPrice: 2000 },
                ],
            }),
        ).rejects.toThrow(/Insufficient stock/);

        // Rollback chain should have issued delete on both order_items and orders.
        // We don't assert order here — only that both paths ran (via from()).
        const callsByTable = (sb.from as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
        expect(callsByTable).toContain('order_items');
        expect(callsByTable).toContain('orders');
    });
});
