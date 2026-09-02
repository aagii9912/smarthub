/**
 * ensureShopMerchant / expireStalePendingMerchants tests.
 *
 * Supabase-ийг table-agnostic chain mock-оор орлуулна: бүх builder метод
 * chain буцаана, `single/maybeSingle` дараалсан үр дүнгийн queue-ээс уншина,
 * `update()` payload-уудыг бүртгэнэ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queue: Array<{ data: unknown; error: unknown }> = [];
const updates: Array<Record<string, unknown>> = [];
let updateSelectResult: { data: unknown; error: unknown } = { data: [], error: null };

function makeChain() {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ['from', 'select', 'eq', 'neq', 'not', 'lt', 'limit', 'insert', 'delete']) {
        chain[m] = vi.fn(self);
    }
    chain.update = vi.fn((payload: Record<string, unknown>) => {
        updates.push(payload);
        return chain;
    });
    chain.maybeSingle = vi.fn(async () => queue.shift() ?? { data: null, error: null });
    chain.single = chain.maybeSingle;
    // `await supabase.from().update().eq()` — thenable
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
    return chain;
}

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => {
        const chain = makeChain();
        // update().eq(...).lt(...).select('id') — expireStalePendingMerchants
        (chain.select as ReturnType<typeof vi.fn>).mockImplementation((...args: unknown[]) => {
            if (args[0] === 'id') return Promise.resolve(updateSelectResult);
            return chain;
        });
        return chain;
    }),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/lib/payment/qpay-merchant', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/payment/qpay-merchant')>();
    return { ...actual, registerShopAsMerchant: vi.fn() };
});

import {
    ensureShopMerchant,
    expireStalePendingMerchants,
    mapQPayErrorToUserMessage,
    QPayMerchantError,
    QPAY_PENDING_TIMEOUT_MS,
} from '@/lib/payment/qpay-merchant-service';
import { registerShopAsMerchant } from '@/lib/payment/qpay-merchant';
import type { QPayMerchantInput } from '@/lib/validations/qpay';

const registerMock = registerShopAsMerchant as unknown as ReturnType<typeof vi.fn>;

const NOW = Date.parse('2026-09-02T10:00:00Z');
const now = () => NOW;

const baseShop = {
    id: 'shop-1',
    name: 'Гоо сайхны дэлгүүр',
    user_id: 'user-1',
    address: 'Баянзүрх дүүрэг',
    business_type: 'beauty',
    qpay_merchant_id: null,
    qpay_status: 'none',
    qpay_pending_since: null,
};

const personInput: QPayMerchantInput = {
    merchant_type: 'person',
    last_name: 'Батаа',
    first_name: 'Дорж',
    register_number: 'УА12345678',
    bank_code: '050000',
    account_number: '5012345678',
    account_name: 'Дорж Батаа',
    phone: '99887766',
    email: 'dorj@example.com',
};

const qpayMerchant = {
    id: 'merchant-uuid-1',
    vendor_id: 'v',
    type: 'PERSON',
    register_number: 'УА12345678',
    name: 'Гоо сайхны дэлгүүр',
    company_name: '',
    mcc_code: '7230',
    city: '11000',
    district: '14000',
    address: 'Баянзүрх дүүрэг',
    phone: '99887766',
    email: 'dorj@example.com',
    p2p_terminal_id: 'p2p-1',
    card_terminal_id: 'card-1',
};

beforeEach(() => {
    queue.length = 0;
    updates.length = 0;
    updateSelectResult = { data: [], error: null };
    registerMock.mockReset();
});

describe('ensureShopMerchant — хувь хүн', () => {
    it('шинээр бүртгэж овог/нэр, MCC, терминалуудыг хадгална', async () => {
        queue.push({ data: baseShop, error: null }); // shop
        queue.push({ data: null, error: null });     // sibling
        registerMock.mockResolvedValueOnce(qpayMerchant);

        const result = await ensureShopMerchant('shop-1', personInput, { now });

        expect(result).toMatchObject({ merchantId: 'merchant-uuid-1', status: 'active', reused: 'none' });
        expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({
            merchantType: 'person',
            lastName: 'Батаа',
            firstName: 'Дорж',
            registerNumber: 'УА12345678',
            mccCode: '7230', // beauty
            phone: '99887766',
            email: 'dorj@example.com',
        }));

        // 1) pending, 2) active
        expect(updates[0]).toMatchObject({ qpay_status: 'pending', qpay_pending_since: new Date(NOW).toISOString() });
        expect(updates[1]).toMatchObject({
            qpay_status: 'active',
            qpay_merchant_id: 'merchant-uuid-1',
            qpay_merchant_type: 'person',
            qpay_mcc_code: '7230',
            qpay_p2p_terminal_id: 'p2p-1',
            qpay_card_terminal_id: 'card-1',
            owner_last_name: 'Батаа',
            owner_first_name: 'Дорж',
            qpay_pending_since: null,
            qpay_last_error: null,
            register_number: 'УА12345678',
        });
    });

    it('аль хэдийн active бол ALREADY_ACTIVE шидэж QPay руу хандахгүй', async () => {
        queue.push({ data: { ...baseShop, qpay_merchant_id: 'm-old', qpay_status: 'active' }, error: null });

        await expect(ensureShopMerchant('shop-1', personInput, { now })).rejects.toMatchObject({
            code: 'ALREADY_ACTIVE',
            merchantId: 'm-old',
        });
        expect(registerMock).not.toHaveBeenCalled();
        expect(updates).toHaveLength(0);
    });

    it('шинэхэн pending бол PENDING шиднэ', async () => {
        queue.push({
            data: { ...baseShop, qpay_status: 'pending', qpay_pending_since: new Date(NOW - 60_000).toISOString() },
            error: null,
        });

        await expect(ensureShopMerchant('shop-1', personInput, { now })).rejects.toMatchObject({ code: 'PENDING' });
        expect(registerMock).not.toHaveBeenCalled();
    });

    it('хуучирсан pending (timeout хэтэрсэн) бол үргэлжлүүлнэ', async () => {
        queue.push({
            data: {
                ...baseShop,
                qpay_status: 'pending',
                qpay_pending_since: new Date(NOW - QPAY_PENDING_TIMEOUT_MS - 1).toISOString(),
            },
            error: null,
        });
        queue.push({ data: null, error: null });
        registerMock.mockResolvedValueOnce(qpayMerchant);

        const result = await ensureShopMerchant('shop-1', personInput, { now });
        expect(result.status).toBe('active');
        expect(registerMock).toHaveBeenCalledTimes(1);
    });

    it('ижил РД-тэй өөр дэлгүүр байвал merchant-ийг хуулж QPay руу хандахгүй', async () => {
        queue.push({ data: baseShop, error: null });
        queue.push({
            data: { qpay_merchant_id: 'm-sibling', qpay_p2p_terminal_id: 'p2p-s', qpay_card_terminal_id: null },
            error: null,
        });

        const result = await ensureShopMerchant('shop-1', personInput, { now });

        expect(result).toMatchObject({ merchantId: 'm-sibling', reused: 'local' });
        expect(registerMock).not.toHaveBeenCalled();
        expect(updates[1]).toMatchObject({ qpay_merchant_id: 'm-sibling', qpay_p2p_terminal_id: 'p2p-s', qpay_status: 'active' });
    });

    it('QPay алдаа өгвөл failed + last_error хадгалж, ойлгомжтой мессежтэй шиднэ', async () => {
        queue.push({ data: baseShop, error: null });
        queue.push({ data: null, error: null });
        registerMock.mockRejectedValueOnce(new Error('QPay merchant registration failed: 400 - {"error":"BAD_REQUEST","message":"phone is invalid"}'));

        const err = await ensureShopMerchant('shop-1', personInput, { now }).catch((e) => e);

        expect(err).toBeInstanceOf(QPayMerchantError);
        expect(err.code).toBe('REGISTRATION_FAILED');
        expect(err.userMessage).toContain('Утасны дугаар');
        expect(updates[1]).toMatchObject({ qpay_status: 'failed', qpay_pending_since: null });
        expect(String(updates[1].qpay_last_error)).toContain('phone is invalid');
    });

    it('дэлгүүр олдохгүй бол SHOP_NOT_FOUND', async () => {
        queue.push({ data: null, error: null });
        await expect(ensureShopMerchant('nope', personInput, { now })).rejects.toMatchObject({ code: 'SHOP_NOT_FOUND' });
    });

    it('mcc_code өгвөл business_type-аас давуу', async () => {
        queue.push({ data: baseShop, error: null });
        queue.push({ data: null, error: null });
        registerMock.mockResolvedValueOnce(qpayMerchant);

        await ensureShopMerchant('shop-1', { ...personInput, mcc_code: '5999' }, { now });
        expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ mccCode: '5999' }));
    });
});

describe('ensureShopMerchant — байгууллага', () => {
    it('company төрлөөр бүртгэж овог/нэр илгээхгүй', async () => {
        queue.push({ data: baseShop, error: null });
        queue.push({ data: null, error: null });
        registerMock.mockResolvedValueOnce({ ...qpayMerchant, type: 'COMPANY' });

        await ensureShopMerchant('shop-1', {
            merchant_type: 'company',
            company_name: 'Тест ХХК',
            register_number: '1234567',
            bank_code: '040000',
            account_number: '400123456',
            account_name: 'Тест ХХК',
            phone: '99887766',
        }, { now });

        expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({
            merchantType: 'company',
            lastName: undefined,
            firstName: undefined,
        }));
        expect(updates[1]).toMatchObject({ qpay_merchant_type: 'company' });
        expect(updates[1]).not.toHaveProperty('owner_last_name');
    });
});

describe('expireStalePendingMerchants', () => {
    it('хуучирсан pending мөрүүдийг failed болгож тоог буцаана', async () => {
        updateSelectResult = { data: [{ id: 'a' }, { id: 'b' }], error: null };
        const count = await expireStalePendingMerchants(now);
        expect(count).toBe(2);
        expect(updates[0]).toMatchObject({ qpay_status: 'failed', qpay_pending_since: null });
    });

    it('DB алдаанд 0 буцаана', async () => {
        updateSelectResult = { data: null, error: { message: 'boom' } };
        expect(await expireStalePendingMerchants(now)).toBe(0);
    });
});

describe('mapQPayErrorToUserMessage', () => {
    it('талбарын алдааг таньж монгол мессеж өгнө', () => {
        expect(mapQPayErrorToUserMessage('register_number already used')).toContain('Регистр');
        expect(mapQPayErrorToUserMessage('invalid email')).toContain('Имэйл');
        expect(mapQPayErrorToUserMessage('account_number invalid')).toContain('Данс');
        expect(mapQPayErrorToUserMessage('something else')).toContain('амжилтгүй');
    });
});
