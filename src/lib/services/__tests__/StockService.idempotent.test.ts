/**
 * StockService idempotency tests.
 *
 * deductStockForOrder must be safe to call multiple times for the same
 * order — the `atomic_claim_stock_deduction` RPC returns false on the second
 * call, and we skip the notification path to avoid duplicate push alerts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        rpc: rpcMock,
        from: fromMock,
    }),
}));

vi.mock('@/lib/notifications', () => ({
    sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
    },
}));

import { deductStockForOrder } from '@/lib/services/StockService';
import { sendPushNotification } from '@/lib/notifications';

// Minimal supabase chain used by notifyLowStockAfterDeduction:
//   .from('orders').select(...).eq(...).single()
//   .from('order_items').select(...).eq(...)
function makeChainMocks(opts: { orderShopId?: string; items?: unknown[] }) {
    fromMock.mockImplementation((table: string) => {
        if (table === 'orders') {
            return {
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: opts.orderShopId ? { shop_id: opts.orderShopId } : null,
                            error: null,
                        }),
                    }),
                }),
            };
        }
        if (table === 'order_items') {
            return {
                select: () => ({
                    eq: () => Promise.resolve({ data: opts.items ?? [], error: null }),
                }),
            };
        }
        return {};
    });
}

describe('deductStockForOrder — idempotency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls atomic_claim_stock_deduction RPC on first invocation', async () => {
        rpcMock.mockResolvedValueOnce({ data: true, error: null });
        makeChainMocks({ orderShopId: 'shop-1', items: [] });

        await deductStockForOrder('order-1');

        expect(rpcMock).toHaveBeenCalledWith(
            'atomic_claim_stock_deduction',
            { p_order_id: 'order-1' },
        );
    });

    it('skips notification pipeline on second call (claimed=false)', async () => {
        rpcMock.mockResolvedValueOnce({ data: false, error: null });
        makeChainMocks({ orderShopId: 'shop-1', items: [] });

        await deductStockForOrder('order-1');

        expect(rpcMock).toHaveBeenCalledTimes(1);
        // from() must not be invoked when idempotent-skip fires.
        expect(fromMock).not.toHaveBeenCalled();
        expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('throws when the RPC itself errors', async () => {
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'product locked' },
        });

        await expect(deductStockForOrder('order-err'))
            .rejects.toMatchObject({ message: 'product locked' });
    });

    it('does not block on low-stock notification failures', async () => {
        rpcMock.mockResolvedValueOnce({ data: true, error: null });

        // Force notifyLowStockAfterDeduction to throw by making supabase.from
        // throw synchronously — deductStockForOrder must swallow it.
        fromMock.mockImplementation(() => {
            throw new Error('db unavailable');
        });

        await expect(deductStockForOrder('order-ok')).resolves.toBeUndefined();
    });
});
