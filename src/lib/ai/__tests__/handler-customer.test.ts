/**
 * Customer Handler Tests
 * Tests: collect_contact_info, request_human_support, remember_preference
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from './fixtures';

// ─── Mock Dependencies ──────────────────────────────────────────
// Shop phone returned by `.from('shops').select(...).eq(...).single()`.
// Tests can mutate this between cases to exercise the null-phone branch.
const shopPhoneFixture: { phone: string | null; userId: string | null } = {
    phone: '99001100',
    userId: null,
};

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table === 'shops') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    phone: shopPhoneFixture.phone,
                                    user_id: shopPhoneFixture.userId,
                                    name: 'Test Shop',
                                },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'customer_complaints') {
                return { insert: vi.fn().mockResolvedValue({ error: null }) };
            }
            // customers (collect_contact)
            return {
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            };
        }),
        auth: {
            admin: {
                getUserById: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
        },
    })),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/lib/notifications', () => ({
    sendPushNotification: vi.fn().mockResolvedValue({ success: 1, failed: 0 }),
}));
vi.mock('@/lib/ai/tools/memory', () => ({
    saveCustomerPreference: vi.fn().mockResolvedValue({ success: true }),
}));

import {
    executeCollectContact,
    executeRequestSupport,
    executeRememberPreference,
} from '@/lib/ai/tools/handlers/CustomerHandlers';
import { sendPushNotification } from '@/lib/notifications';
import { saveCustomerPreference } from '@/lib/ai/tools/memory';

describe('CustomerHandlers', () => {
    const ctx = createMockContext();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(saveCustomerPreference).mockResolvedValue({ success: true } as any);
        shopPhoneFixture.phone = '99001100';
        shopPhoneFixture.userId = null;
    });

    // ─── collect_contact_info ────────────────────────────────────
    describe('executeCollectContact', () => {
        it('should save phone number', async () => {
            const result = await executeCollectContact(
                { phone: '99001122' },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('99001122');
        });

        it('should save all contact info', async () => {
            const result = await executeCollectContact(
                { phone: '99001122', name: 'Болд', address: 'УБ, ХУД 3-р хороо' },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('99001122');
            expect(result.message).toContain('УБ, ХУД');
            expect(result.message).toContain('Болд');
        });

        it('should send push notification', async () => {
            await executeCollectContact({ phone: '99001122', name: 'Болд' }, ctx);

            expect(vi.mocked(sendPushNotification)).toHaveBeenCalledWith(
                'shop-test-001',
                expect.objectContaining({
                    title: expect.stringContaining('Хаяг'),
                })
            );
        });

        it('should skip notification when disabled', async () => {
            const noNotify = createMockContext({
                notifySettings: { order: true, contact: false, support: true, cancel: true },
            });

            await executeCollectContact({ phone: '99001122' }, noNotify);

            expect(vi.mocked(sendPushNotification)).not.toHaveBeenCalled();
        });

        it('should fail without customer context', async () => {
            const result = await executeCollectContact(
                { phone: '99001122' },
                createMockContext({ customerId: undefined })
            );

            expect(result.success).toBe(false);
        });

        it('should handle empty contact info', async () => {
            const result = await executeCollectContact({}, ctx);

            expect(result.success).toBe(true);
            expect(result.message).toContain('No info');
        });

        it('should signal create_order as the next action so the AI registers the order', async () => {
            const result = await executeCollectContact({ phone: '99001122' }, ctx);

            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({ next_action: 'create_order' });
            expect(result.message).toContain('create_order');
        });

        // Үл хөдлөх / авто / сургалтын агент create_order tool-гүй. Түүнд
        // "create_order дууд" гэж хэлбэл эсвэл байрны захиалга зохиож бичнэ,
        // эсвэл энэ дотоод заавар шууд хэрэглэгч рүү мессежээр явчихдаг.
        it('does not push a lead-capture shop toward create_order', async () => {
            const leadCtx = createMockContext({ capabilities: ['lead_capture', 'information'] });

            const result = await executeCollectContact({ phone: '99001122' }, leadCtx);

            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({ next_action: 'handoff' });
            expect(result.message).not.toContain('create_order');
            expect(result.message).toContain('менежер');
        });

        it('keeps the commerce nudge for a booking+sales hybrid', async () => {
            const hybridCtx = createMockContext({ capabilities: ['sales', 'booking'] });

            const result = await executeCollectContact({ phone: '99001122' }, hybridCtx);

            expect(result.data).toMatchObject({ next_action: 'create_order' });
        });

        it('links the push at a route that exists', async () => {
            await executeCollectContact({ phone: '99001122' }, ctx);

            expect(vi.mocked(sendPushNotification)).toHaveBeenCalledWith(
                'shop-test-001',
                expect.objectContaining({ url: '/dashboard/inbox/cust-test-001' }),
            );
        });
    });

    // ─── request_human_support ───────────────────────────────────
    describe('executeRequestSupport', () => {
        it('should send support notification', async () => {
            const result = await executeRequestSupport(
                { reason: 'Нарийн захиалга хийх хэрэгтэй' },
                ctx
            );

            expect(result.success).toBe(true);
            expect(vi.mocked(sendPushNotification)).toHaveBeenCalledWith(
                'shop-test-001',
                expect.objectContaining({
                    title: expect.stringContaining('холбогдох'),
                    body: expect.stringContaining('Нарийн захиалга'),
                })
            );
        });

        it('should work without reason', async () => {
            const result = await executeRequestSupport({ reason: '' }, ctx);

            expect(result.success).toBe(true);
        });

        it('should skip notification when disabled', async () => {
            const noNotify = createMockContext({
                notifySettings: { order: true, contact: true, support: false, cancel: true },
            });

            await executeRequestSupport({ reason: 'test' }, noNotify);

            expect(vi.mocked(sendPushNotification)).not.toHaveBeenCalled();
        });

        it('should fail when shop phone is missing so the AI falls back to create_order', async () => {
            shopPhoneFixture.phone = null;

            const result = await executeRequestSupport({ reason: 'захиалга' }, ctx);

            expect(result.success).toBe(false);
            expect(result.error).toContain('create_order');
        });

        it('should expose a CALL: button when shop phone is configured', async () => {
            shopPhoneFixture.phone = '99001100';

            const result = await executeRequestSupport({ reason: 'захиалга' }, ctx);

            expect(result.success).toBe(true);
            expect(result.actions).toBeDefined();
            const button = result.actions?.[0]?.buttons?.[0];
            expect(button?.payload).toContain('CALL:+976');
        });
    });

    // ─── remember_preference ─────────────────────────────────────
    describe('executeRememberPreference', () => {
        it('should save preference', async () => {
            const result = await executeRememberPreference(
                { key: 'favorite_color', value: 'blue' },
                ctx
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('Санах ойд');
            expect(result.data).toEqual({ key: 'favorite_color', value: 'blue' });
            expect(vi.mocked(saveCustomerPreference)).toHaveBeenCalledWith('cust-test-001', 'favorite_color', 'blue');
        });

        it('should fail without customer', async () => {
            const result = await executeRememberPreference(
                { key: 'test', value: 'val' },
                createMockContext({ customerId: undefined })
            );

            expect(result.success).toBe(false);
        });

        it('should handle save failure', async () => {
            vi.mocked(saveCustomerPreference).mockResolvedValueOnce({ success: false, error: 'DB error' } as any);

            const result = await executeRememberPreference(
                { key: 'test', value: 'val' },
                ctx
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('DB error');
        });
    });
});
