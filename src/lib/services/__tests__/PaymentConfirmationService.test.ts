/**
 * Tests for confirmOrderPayment — the canonical payment-confirmation flow
 * shared by the QPay webhook and the manual status check.
 *
 * Because both paths can fire for the same payment, idempotency is the whole
 * point: a second confirmation must NOT re-write the payment row, yet must
 * still (safely) re-run the idempotent stock deduction. We also pin the
 * fail-fast on a missing payment and the push-notification opt-in gate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
    supabaseAdminMock,
    deductStockMock,
    sendPushMock,
    isNotificationEnabledMock,
} = vi.hoisted(() => ({
    supabaseAdminMock: vi.fn(),
    deductStockMock: vi.fn(),
    sendPushMock: vi.fn(),
    isNotificationEnabledMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: supabaseAdminMock }));
vi.mock('@/lib/services/StockService', () => ({ deductStockForOrder: deductStockMock }));
vi.mock('@/lib/notifications', () => ({ sendPushNotification: sendPushMock }));
vi.mock('@/lib/notifications-prefs', () => ({ isNotificationEnabled: isNotificationEnabledMock }));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

import { confirmOrderPayment } from '@/lib/services/PaymentConfirmationService';

interface PaymentRow {
    id: string;
    shop_id: string | null;
    status: string;
    metadata: Record<string, unknown> | null;
}

function makeSupabase(cfg: { payment: PaymentRow | null; orderData?: unknown }) {
    const calls = {
        paymentsUpdate: 0,
        ordersUpdate: 0,
        auditInsert: 0,
        paymentUpdatePayloads: [] as Record<string, unknown>[],
    };

    const paymentsBuilder = () => {
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.single = () => Promise.resolve({ data: cfg.payment, error: cfg.payment ? null : { message: 'not found' } });
        b.update = (payload: Record<string, unknown>) => {
            calls.paymentsUpdate++;
            calls.paymentUpdatePayloads.push(payload);
            return { eq: () => Promise.resolve({ error: null }) };
        };
        return b;
    };

    const ordersBuilder = () => {
        const b: Record<string, unknown> = {};
        b.update = () => {
            calls.ordersUpdate++;
            return { eq: () => Promise.resolve({ error: null }) };
        };
        b.select = () => b;
        b.eq = () => b;
        b.single = () => Promise.resolve({ data: cfg.orderData ?? null, error: null });
        return b;
    };

    const auditBuilder = () => ({
        insert: () => {
            calls.auditInsert++;
            return Promise.resolve({ error: null });
        },
    });

    return {
        calls,
        client: {
            from(table: string) {
                if (table === 'payments') return paymentsBuilder();
                if (table === 'orders') return ordersBuilder();
                if (table === 'payment_audit_logs') return auditBuilder();
                return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
            },
        },
    };
}

const baseParams = {
    paymentId: 'pay-1',
    orderId: 'order-1',
    transactionId: 'txn-1',
    amount: 50000,
    paymentMethod: 'qpay',
    confirmedVia: 'webhook' as const,
};

beforeEach(() => {
    supabaseAdminMock.mockReset();
    deductStockMock.mockReset().mockResolvedValue(undefined);
    sendPushMock.mockReset().mockResolvedValue({ success: 1, failed: 0 });
    isNotificationEnabledMock.mockReset().mockResolvedValue(false);
});

describe('confirmOrderPayment — fail fast', () => {
    it('throws when the payment row does not exist', async () => {
        supabaseAdminMock.mockReturnValue(makeSupabase({ payment: null }).client);
        await expect(confirmOrderPayment(baseParams)).rejects.toThrow(/Payment not found/);
    });
});

describe('confirmOrderPayment — pending → paid', () => {
    it('updates the payment, the order, deducts stock, and writes an audit log', async () => {
        const sb = makeSupabase({
            payment: { id: 'pay-1', shop_id: 'shop-1', status: 'pending', metadata: {} },
        });
        supabaseAdminMock.mockReturnValue(sb.client);

        await confirmOrderPayment(baseParams);

        expect(sb.calls.paymentsUpdate).toBe(1);
        expect(sb.calls.paymentUpdatePayloads[0].status).toBe('paid');
        expect(sb.calls.ordersUpdate).toBe(1);
        expect(deductStockMock).toHaveBeenCalledWith('order-1');
        expect(sb.calls.auditInsert).toBe(1);
    });
});

describe('confirmOrderPayment — idempotency', () => {
    it('skips the payment update when already paid but still re-runs stock deduction', async () => {
        const sb = makeSupabase({
            payment: { id: 'pay-1', shop_id: 'shop-1', status: 'paid', metadata: {} },
        });
        supabaseAdminMock.mockReturnValue(sb.client);

        await confirmOrderPayment(baseParams);

        // No second write to the payment row...
        expect(sb.calls.paymentsUpdate).toBe(0);
        // ...but the idempotent stock RPC is still invoked.
        expect(deductStockMock).toHaveBeenCalledWith('order-1');
    });

    it('does not throw when stock deduction fails (non-critical step)', async () => {
        deductStockMock.mockRejectedValue(new Error('stock RPC down'));
        const sb = makeSupabase({
            payment: { id: 'pay-1', shop_id: 'shop-1', status: 'pending', metadata: {} },
        });
        supabaseAdminMock.mockReturnValue(sb.client);

        await expect(confirmOrderPayment(baseParams)).resolves.toBeUndefined();
        // Payment + order were still updated despite the stock failure.
        expect(sb.calls.paymentsUpdate).toBe(1);
    });
});

describe('confirmOrderPayment — owner push notification', () => {
    it('sends a push when the owner has payment_received enabled', async () => {
        isNotificationEnabledMock.mockResolvedValue(true);
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ payment: { id: 'pay-1', shop_id: 'shop-1', status: 'pending', metadata: {} } }).client,
        );

        await confirmOrderPayment(baseParams);

        expect(isNotificationEnabledMock).toHaveBeenCalledWith('shop-1', 'payment_received');
        expect(sendPushMock).toHaveBeenCalledTimes(1);
    });

    it('does not send a push when the owner has opted out', async () => {
        isNotificationEnabledMock.mockResolvedValue(false);
        supabaseAdminMock.mockReturnValue(
            makeSupabase({ payment: { id: 'pay-1', shop_id: 'shop-1', status: 'pending', metadata: {} } }).client,
        );

        await confirmOrderPayment(baseParams);
        expect(sendPushMock).not.toHaveBeenCalled();
    });
});
