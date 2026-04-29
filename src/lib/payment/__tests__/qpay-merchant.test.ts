/**
 * QPay merchant registration recovery tests.
 *
 * Focus: when QPay returns MERCHANT_ALREADY_REGISTERED, the registration
 * function should look up the existing merchant by register_number and
 * return it instead of throwing. Other 400 errors should still throw.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/payment/qpay', () => ({
    getAccessToken: vi.fn().mockResolvedValue('test-token'),
    QPAY_BASE_URL: 'https://qpay.test',
}));

import { registerShopAsMerchant, type QPayMerchant } from '@/lib/payment/qpay-merchant';

// setup.ts assigns `global.fetch = vi.fn()`, so we reach into the same mock
// rather than spying — that way each test starts from a clean queue.
const fetchMock = globalThis.fetch as unknown as Mock;

const REGISTER_NUMBER = '12345678';

const mockMerchant: QPayMerchant = {
    id: 'merchant-uuid-1',
    vendor_id: 'vendor-1',
    type: 'PERSON',
    register_number: REGISTER_NUMBER,
    name: 'Test Shop',
    company_name: 'Test Shop',
    mcc_code: '7372',
    city: '11000',
    district: '14000',
    address: 'Ulaanbaatar',
    phone: '99999999',
    email: 'test@example.com',
    p2p_terminal_id: 'p2p-1',
    card_terminal_id: 'card-1',
};

const baseParams = {
    shopName: 'Test Shop',
    merchantType: 'person' as const,
    registerNumber: REGISTER_NUMBER,
    bankCode: '050000',
    accountNumber: '5012345678',
    accountName: 'Бат-Эрдэнэ',
    phone: '99999999',
    email: 'test@example.com',
};

describe('registerShopAsMerchant', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it('returns the new merchant when QPay register succeeds', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => mockMerchant,
        } as Response);

        const result = await registerShopAsMerchant(baseParams);

        expect(result).toEqual(mockMerchant);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://qpay.test/v2/merchant/person',
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('recovers via lookup when QPay returns MERCHANT_ALREADY_REGISTERED', async () => {
        fetchMock
            // 1) register attempt → 400 MERCHANT_ALREADY_REGISTERED
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => JSON.stringify({
                    error: 'MERCHANT_ALREADY_REGISTERED',
                    message: 'Бүртгэлтэй мерчант байна!',
                }),
            } as Response)
            // 2) listMerchants page 1 → contains the existing merchant
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ count: 1, rows: [mockMerchant] }),
            } as Response);

        const result = await registerShopAsMerchant(baseParams);

        expect(result).toEqual(mockMerchant);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1]?.[0]).toBe('https://qpay.test/v2/merchant/list');
    });

    it('throws when MERCHANT_ALREADY_REGISTERED but the merchant is not found in the list', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => JSON.stringify({ error: 'MERCHANT_ALREADY_REGISTERED' }),
            } as Response)
            // listMerchants returns merchants with different register_numbers
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    count: 1,
                    rows: [{ ...mockMerchant, register_number: '99999999' }],
                }),
            } as Response);

        await expect(registerShopAsMerchant(baseParams)).rejects.toThrow(
            /MERCHANT_ALREADY_REGISTERED/,
        );
    });

    it('throws without lookup when QPay returns a different 400 error', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({
                error: 'INVALID_BANK_CODE',
                message: 'Банкны код буруу байна',
            }),
        } as Response);

        await expect(registerShopAsMerchant(baseParams)).rejects.toThrow(/INVALID_BANK_CODE/);
        // listMerchants must not be called for unrelated errors
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws without lookup when registerNumber is omitted', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: 'MERCHANT_ALREADY_REGISTERED' }),
        } as Response);

        const { registerNumber: _omit, ...paramsWithoutRegister } = baseParams;

        await expect(registerShopAsMerchant(paramsWithoutRegister)).rejects.toThrow(
            /MERCHANT_ALREADY_REGISTERED/,
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('paginates through listMerchants until the matching register_number is found', async () => {
        const otherMerchant: QPayMerchant = { ...mockMerchant, id: 'other-uuid', register_number: '00000001' };
        fetchMock
            .mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => '{"error":"MERCHANT_ALREADY_REGISTERED"}',
            } as Response)
            // page 1: full page of 50, no match
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ count: 60, rows: Array(50).fill(otherMerchant) }),
            } as Response)
            // page 2: contains the target
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ count: 60, rows: [mockMerchant] }),
            } as Response);

        const result = await registerShopAsMerchant(baseParams);

        expect(result).toEqual(mockMerchant);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
