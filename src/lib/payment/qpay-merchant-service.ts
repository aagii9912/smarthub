/**
 * QPay Merchant Service — дэлгүүрийг QPay merchant болгох **цорын ганц** зам.
 *
 * Урьд нь `PATCH /api/shop` (авто) болон `POST /api/shop/qpay-setup` (гар)
 * хоёр тусдаа логиктой байсан. Энд төвлөрүүлснээр:
 *   - pending төлөв + timeout (гацахгүй)
 *   - local reuse (нэг хэрэглэгчийн өөр дэлгүүр ижил РД-тэй бол)
 *   - QPay-н MERCHANT_ALREADY_REGISTERED reuse (registerShopAsMerchant дотор)
 *   - алдааны шалтгаан `qpay_last_error`-д хадгалагдана
 *   - хувь хүний merchant-д овог/нэр, MCC, хот/дүүрэг зөв илгээгдэнэ
 *
 * Төлөвлөгөө: docs/plans/QPAY_MERCHANT_AND_UIUX_PLAN.md (A.4.3)
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import {
    registerShopAsMerchant,
    mccForBusinessType,
    CITY_CODES,
    UB_DISTRICT_CODES,
    type QPayMerchant,
} from './qpay-merchant';
import type { QPayMerchantInput } from '@/lib/validations/qpay';

/** pending төлөв энэ хугацаанаас хэтэрвэл failed гэж үзнэ. */
export const QPAY_PENDING_TIMEOUT_MS = 10 * 60 * 1000;

export type QPayMerchantErrorCode =
    | 'SHOP_NOT_FOUND'
    | 'ALREADY_ACTIVE'
    | 'PENDING'
    | 'REGISTRATION_FAILED'
    | 'DB_ERROR';

export class QPayMerchantError extends Error {
    constructor(
        public readonly code: QPayMerchantErrorCode,
        /** Хэрэглэгчид харуулах монгол мессеж */
        public readonly userMessage: string,
        /** Лог/дебагт зориулсан техник дэлгэрэнгүй */
        public readonly detail?: string,
        public readonly merchantId?: string | null,
    ) {
        super(detail || userMessage);
        this.name = 'QPayMerchantError';
    }
}

export interface EnsureMerchantResult {
    merchantId: string;
    status: 'active';
    /** none = шинээр бүртгэсэн, local = өөр дэлгүүрээс хуулсан */
    reused: 'none' | 'local';
    message: string;
}

interface ShopRow {
    id: string;
    name: string | null;
    user_id: string;
    address: string | null;
    business_type: string | null;
    qpay_merchant_id: string | null;
    qpay_status: string | null;
    qpay_pending_since: string | null;
}

/**
 * QPay-н алдааны текстийг хэрэглэгчид ойлгомжтой мессеж болгоно.
 * Хамгийн түгээмэл нь утас/РД/данс буруу тул талбарын түвшинд заана.
 */
export function mapQPayErrorToUserMessage(raw: string): string {
    const msg = raw.toLowerCase();
    if (msg.includes('phone')) return 'Утасны дугаар буруу байна. 8 оронтой дугаар оруулна уу.';
    if (msg.includes('email')) return 'Имэйл хаягаа шалгаж дахин оролдоно уу.';
    if (msg.includes('register_number') || msg.includes('register number')) {
        return 'Регистрийн дугаараа шалгаж дахин оролдоно уу.';
    }
    if (msg.includes('account_number') || msg.includes('account_name') || msg.includes('bank')) {
        return 'Дансны дугаар, банк эсвэл данс эзэмшигчийн нэрээ шалгана уу.';
    }
    if (msg.includes('first_name') || msg.includes('last_name')) {
        return 'Овог, нэрээ шалгаж дахин оролдоно уу.';
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('token')) {
        return 'QPay холболтын тохиргоонд алдаа гарлаа. Syncly-н дэмжлэгт хандана уу.';
    }
    return 'QPay бүртгэл амжилтгүй боллоо. Мэдээллээ шалгаад дахин оролдоно уу.';
}

function isPendingFresh(pendingSince: string | null, now: number): boolean {
    if (!pendingSince) return false;
    const started = Date.parse(pendingSince);
    if (Number.isNaN(started)) return false;
    return now - started < QPAY_PENDING_TIMEOUT_MS;
}

/**
 * Дэлгүүрийг QPay merchant болгож `shops` мөрийг шинэчилнэ.
 * Амжилтгүй бол `QPayMerchantError` шиднэ — `code`-оор HTTP статус сонгоно.
 */
export async function ensureShopMerchant(
    shopId: string,
    input: QPayMerchantInput,
    opts: { email?: string | null; now?: () => number } = {},
): Promise<EnsureMerchantResult> {
    const supabase = supabaseAdmin();
    const now = opts.now ?? Date.now;

    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name, user_id, address, business_type, qpay_merchant_id, qpay_status, qpay_pending_since')
        .eq('id', shopId)
        .maybeSingle();

    if (shopError) {
        throw new QPayMerchantError('DB_ERROR', 'Дэлгүүрийн мэдээлэл уншихад алдаа гарлаа', shopError.message);
    }
    if (!shop) {
        throw new QPayMerchantError('SHOP_NOT_FOUND', 'Дэлгүүр олдсонгүй');
    }
    const row = shop as ShopRow;

    if (row.qpay_merchant_id && row.qpay_status === 'active') {
        throw new QPayMerchantError(
            'ALREADY_ACTIVE',
            'Дэлгүүр аль хэдийн QPay-д бүртгэгдсэн байна',
            undefined,
            row.qpay_merchant_id,
        );
    }

    if (row.qpay_status === 'pending' && isPendingFresh(row.qpay_pending_since, now())) {
        throw new QPayMerchantError('PENDING', 'QPay бүртгэл боловсруулагдаж байна. Түр хүлээнэ үү.');
    }

    // pending тавьж, цагийг тэмдэглэнэ (timeout-оор cron цэвэрлэнэ)
    const { error: pendingError } = await supabase
        .from('shops')
        .update({
            qpay_status: 'pending',
            qpay_pending_since: new Date(now()).toISOString(),
            qpay_last_error: null,
        })
        .eq('id', shopId);
    if (pendingError) {
        throw new QPayMerchantError('DB_ERROR', 'Төлөв хадгалахад алдаа гарлаа', pendingError.message);
    }

    const isPerson = input.merchant_type === 'person';
    const mccCode = input.mcc_code || mccForBusinessType(row.business_type);
    const cityCode = input.city_code || CITY_CODES.ULAANBAATAR;
    const districtCode = input.district_code || UB_DISTRICT_CODES.SUKHBAATAR;
    const email = input.email || opts.email || '';

    // Бүх амжилттай замд хадгалах нийтлэг талбарууд
    const commonFields: Record<string, unknown> = {
        qpay_bank_code: input.bank_code,
        qpay_account_number: input.account_number,
        qpay_account_name: input.account_name,
        qpay_merchant_type: input.merchant_type,
        qpay_mcc_code: mccCode,
        qpay_city_code: cityCode,
        qpay_district_code: districtCode,
        qpay_status: 'active',
        qpay_pending_since: null,
        qpay_last_error: null,
        qpay_registered_at: new Date(now()).toISOString(),
        // Legacy талбарууд — Settings UI одоохондоо эдгээрийг уншдаг
        register_number: input.register_number,
        merchant_type: input.merchant_type,
        account_number: input.account_number,
        account_name: input.account_name,
        ...(isPerson
            ? { owner_last_name: input.last_name, owner_first_name: input.first_name }
            : {}),
    };

    // ── Local reuse: нэг хэрэглэгчийн өөр дэлгүүр ижил РД-тэй merchant-тай бол хуулна
    const { data: sibling } = await supabase
        .from('shops')
        .select('qpay_merchant_id, qpay_p2p_terminal_id, qpay_card_terminal_id')
        .eq('user_id', row.user_id)
        .eq('register_number', input.register_number)
        .not('qpay_merchant_id', 'is', null)
        .neq('id', shopId)
        .limit(1)
        .maybeSingle();

    if (sibling?.qpay_merchant_id) {
        await persistSuccess(shopId, {
            ...commonFields,
            qpay_merchant_id: sibling.qpay_merchant_id,
            qpay_p2p_terminal_id: sibling.qpay_p2p_terminal_id ?? null,
            qpay_card_terminal_id: sibling.qpay_card_terminal_id ?? null,
        });
        logger.success('QPay merchant reused from sibling shop', { shopId, merchantId: sibling.qpay_merchant_id });
        return {
            merchantId: sibling.qpay_merchant_id,
            status: 'active',
            reused: 'local',
            message: 'QPay merchant аль хэдийнэ бүртгэгдсэн байсан тул дахин ашиглалаа. ✅',
        };
    }

    // ── QPay бүртгэл
    let merchant: QPayMerchant;
    try {
        merchant = await registerShopAsMerchant({
            shopName: row.name || 'Shop',
            merchantType: input.merchant_type,
            registerNumber: input.register_number,
            bankCode: input.bank_code,
            accountNumber: input.account_number,
            accountName: input.account_name,
            lastName: isPerson ? input.last_name : undefined,
            firstName: isPerson ? input.first_name : undefined,
            phone: input.phone,
            email,
            mccCode,
            city: cityCode,
            district: districtCode,
            address: input.address || row.address || 'Ulaanbaatar',
        });
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const userMessage = mapQPayErrorToUserMessage(detail);
        await supabase
            .from('shops')
            .update({
                qpay_status: 'failed',
                qpay_pending_since: null,
                qpay_last_error: detail.slice(0, 500),
            })
            .eq('id', shopId);
        logger.error('QPay merchant registration failed', { shopId, error: detail });
        throw new QPayMerchantError('REGISTRATION_FAILED', userMessage, detail);
    }

    await persistSuccess(shopId, {
        ...commonFields,
        qpay_merchant_id: merchant.id,
        qpay_p2p_terminal_id: merchant.p2p_terminal_id ?? null,
        qpay_card_terminal_id: merchant.card_terminal_id ?? null,
    });
    logger.success('QPay merchant registered for shop', { shopId, merchantId: merchant.id, type: input.merchant_type });

    return {
        merchantId: merchant.id,
        status: 'active',
        reused: 'none',
        message: 'QPay merchant амжилттай бүртгэгдлээ! Хэрэглэгчид QPay-р төлбөр хийх боломжтой боллоо. ✅',
    };
}

async function persistSuccess(shopId: string, fields: Record<string, unknown>): Promise<void> {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from('shops').update(fields).eq('id', shopId);
    if (error) {
        // QPay дээр merchant үүссэн ч бид хадгалж чадсангүй — дараагийн оролдлого
        // register_number-аар lookup-and-reuse хийж сэргээнэ.
        throw new QPayMerchantError(
            'DB_ERROR',
            'Merchant үүссэн ч хадгалахад алдаа гарлаа. Дахин оролдоно уу.',
            error.message,
            (fields.qpay_merchant_id as string) ?? null,
        );
    }
}

/**
 * 10 минутаас дээш `pending` төлөвт гацсан дэлгүүрүүдийг `failed` болгоно.
 * Cron-оос дуудна. Буцаах утга — цэвэрлэсэн тоо.
 */
export async function expireStalePendingMerchants(now: () => number = Date.now): Promise<number> {
    const supabase = supabaseAdmin();
    const cutoff = new Date(now() - QPAY_PENDING_TIMEOUT_MS).toISOString();

    const { data, error } = await supabase
        .from('shops')
        .update({
            qpay_status: 'failed',
            qpay_pending_since: null,
            qpay_last_error: 'Бүртгэл 10 минутын дотор дуусаагүй (timeout). Дахин оролдоно уу.',
        })
        .eq('qpay_status', 'pending')
        .lt('qpay_pending_since', cutoff)
        .select('id');

    if (error) {
        logger.error('expireStalePendingMerchants failed', { error: error.message });
        return 0;
    }
    const count = data?.length ?? 0;
    if (count > 0) logger.warn('Expired stale QPay pending registrations', { count });
    return count;
}
