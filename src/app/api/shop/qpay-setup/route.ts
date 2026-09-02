import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { BANK_CODES, resolvePersonName, removeMerchant } from '@/lib/payment/qpay-merchant';
import { ensureShopMerchant, QPayMerchantError } from '@/lib/payment/qpay-merchant-service';
import { qpayMerchantInputSchema } from '@/lib/validations/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/shop/qpay-setup
 * Дэлгүүрийг QPay merchant болгон бүртгэнэ (хувь хүн эсвэл байгууллага).
 *
 * Body (хувь хүн):
 * {
 *   merchant_type: 'person',
 *   last_name: string,        // Овог
 *   first_name: string,       // Нэр
 *   register_number: string,  // РД: УА12345678
 *   bank_code: string,        // "050000" (Хаан банк)
 *   account_number: string,
 *   account_name: string,
 *   phone: string,            // 8 орон (улсын кодтой ирвэл normalize хийнэ)
 *   email?: string,
 *   city_code?: string, district_code?: string, address?: string, mcc_code?: string
 * }
 *
 * Body (байгууллага): merchant_type: 'company', company_name, register_number (7 тоо) + дээрх банк/утас талбарууд.
 *
 * Legacy body (merchant_type-гүй, зөвхөн bank_code/account_number/account_name/register_number)
 * хувь хүн гэж үзэж, овог/нэрийг дансны нэрээс, утсыг дэлгүүрээс авна.
 */
export async function POST(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const supabase = supabaseAdmin();

        const { data: shop } = await supabase
            .from('shops')
            .select('id, phone, email, owner_last_name, owner_first_name, user_id')
            .eq('id', authShop.id)
            .maybeSingle();
        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        // Legacy/дутуу талбаруудыг дэлгүүрийн мэдээллээр нөхнө
        const merchantType = raw.merchant_type === 'company' ? 'company' : 'person';
        const candidate: Record<string, unknown> = {
            ...raw,
            merchant_type: merchantType,
            phone: (raw.phone as string) || shop.phone || '',
            email: (raw.email as string) || shop.email || undefined,
        };
        if (merchantType === 'person' && (!raw.last_name || !raw.first_name)) {
            const resolved = resolvePersonName({
                lastName: (raw.last_name as string) || shop.owner_last_name || undefined,
                firstName: (raw.first_name as string) || shop.owner_first_name || undefined,
                accountName: String(raw.account_name || ''),
            });
            candidate.last_name = resolved.lastName;
            candidate.first_name = resolved.firstName;
        }
        if (merchantType === 'company' && !raw.company_name) {
            candidate.company_name = raw.account_name;
        }

        const parsed = qpayMerchantInputSchema.safeParse(candidate);
        if (!parsed.success) {
            const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
            return NextResponse.json({
                error: 'Мэдээлэл дутуу эсвэл буруу байна',
                details,
                fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
            }, { status: 400 });
        }

        try {
            const result = await ensureShopMerchant(authShop.id, parsed.data);
            return NextResponse.json({
                success: true,
                merchant_id: result.merchantId,
                status: result.status,
                reused: result.reused,
                message: result.message,
            });
        } catch (err) {
            if (err instanceof QPayMerchantError) {
                const status =
                    err.code === 'ALREADY_ACTIVE' ? 400
                    : err.code === 'PENDING' ? 409
                    : err.code === 'SHOP_NOT_FOUND' ? 404
                    : err.code === 'REGISTRATION_FAILED' ? 502
                    : 500;
                return NextResponse.json({
                    error: err.userMessage,
                    code: err.code,
                    merchant_id: err.merchantId ?? undefined,
                    details: err.detail,
                }, { status });
            }
            throw err;
        }
    } catch (error: unknown) {
        logger.error('QPay setup error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/shop/qpay-setup?mode=disconnect|delete
 *
 * Two operations on a shop's QPay merchant link:
 *
 *   - mode=disconnect (default): Clear our DB link (qpay_merchant_id and bank
 *     fields) but keep the merchant alive on QPay's side. Use this when the
 *     user wants to reconnect later — re-running the setup with the same
 *     register_number will lookup-and-reuse the orphan QPay merchant via the
 *     existing flow in registerShopAsMerchant().
 *
 *   - mode=delete: Also call QPay's DELETE /merchant endpoint to permanently
 *     remove the merchant on their side. Use this when the user wants to
 *     fully clean up — e.g. they're using the wrong bank/account and want a
 *     fresh registration with different details.
 *
 * Either way the shop's bank fields and QPay status are cleared so the UI
 * returns to the "QPay идэвхгүй" state.
 */
export async function DELETE(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const mode = (searchParams.get('mode') || 'disconnect').toLowerCase();
        if (mode !== 'disconnect' && mode !== 'delete') {
            return NextResponse.json({
                error: 'mode must be "disconnect" or "delete"',
            }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data: shop } = await supabase
            .from('shops')
            .select('qpay_merchant_id, qpay_status')
            .eq('id', authShop.id)
            .single();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        // Call QPay DELETE only when mode=delete AND we have a merchant_id.
        // We tolerate failures here — the user-facing intent is "clean up our
        // side"; if QPay rejects (e.g. merchant has paid invoices), we still
        // want to clear our DB and surface a warning.
        let qpayRemoveOk: boolean | null = null;
        if (mode === 'delete' && shop.qpay_merchant_id) {
            try {
                qpayRemoveOk = await removeMerchant(shop.qpay_merchant_id);
                if (!qpayRemoveOk) {
                    logger.warn('QPay removeMerchant returned non-OK', {
                        shop_id: authShop.id,
                        merchant_id: shop.qpay_merchant_id,
                    });
                }
            } catch (e) {
                logger.warn('QPay removeMerchant threw (non-blocking)', {
                    shop_id: authShop.id,
                    merchant_id: shop.qpay_merchant_id,
                    error: e instanceof Error ? e.message : String(e),
                });
                qpayRemoveOk = false;
            }
        }

        // Clear our DB link in either mode. Leaving qpay_status at 'none'
        // matches the value the GET endpoint defaults to when no setup has
        // ever been done.
        const { error: updateError } = await supabase
            .from('shops')
            .update({
                qpay_merchant_id: null,
                qpay_bank_code: null,
                qpay_account_number: null,
                qpay_account_name: null,
                qpay_merchant_type: null,
                qpay_p2p_terminal_id: null,
                qpay_card_terminal_id: null,
                qpay_last_error: null,
                qpay_pending_since: null,
                qpay_registered_at: null,
                qpay_status: 'none',
            })
            .eq('id', authShop.id);

        if (updateError) {
            logger.error('Failed to clear QPay fields on shop', {
                shop_id: authShop.id,
                error: updateError.message,
            });
            return NextResponse.json({
                error: 'QPay салгахад алдаа гарлаа',
            }, { status: 500 });
        }

        logger.success('QPay merchant unlinked', {
            shop_id: authShop.id,
            mode,
            qpay_remove_ok: qpayRemoveOk,
        });

        const successMessage = mode === 'delete'
            ? (qpayRemoveOk === false
                ? 'QPay-аас бүрэн устгах боломжгүй байсан ч холбоос салгагдлаа.'
                : 'QPay merchant амжилттай устгагдлаа.')
            : 'QPay салгагдлаа. Шинээр бүртгэх боломжтой.';

        return NextResponse.json({
            success: true,
            mode,
            qpay_remove_ok: qpayRemoveOk,
            message: successMessage,
        });

    } catch (error: unknown) {
        logger.error('QPay disconnect error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET /api/shop/qpay-setup
 * Get current QPay setup status for the shop
 */
export async function GET() {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        const { data: shop } = await supabase
            .from('shops')
            .select('qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status, qpay_merchant_type, qpay_mcc_code, qpay_city_code, qpay_district_code, qpay_p2p_terminal_id, qpay_card_terminal_id, qpay_last_error, qpay_registered_at, owner_last_name, owner_first_name, register_number, phone')
            .eq('id', authShop.id)
            .single();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        return NextResponse.json({
            is_setup: shop.qpay_status === 'active',
            merchant_id: shop.qpay_merchant_id,
            merchant_type: shop.qpay_merchant_type,
            bank_code: shop.qpay_bank_code,
            account_number: shop.qpay_account_number ? `****${shop.qpay_account_number.slice(-4)}` : null,
            account_name: shop.qpay_account_name,
            owner_last_name: shop.owner_last_name,
            owner_first_name: shop.owner_first_name,
            register_number: shop.register_number,
            phone: shop.phone,
            mcc_code: shop.qpay_mcc_code,
            city_code: shop.qpay_city_code,
            district_code: shop.qpay_district_code,
            terminals: {
                p2p: shop.qpay_p2p_terminal_id,
                card: shop.qpay_card_terminal_id,
            },
            status: shop.qpay_status || 'none',
            last_error: shop.qpay_last_error,
            registered_at: shop.qpay_registered_at,
            available_banks: BANK_CODES,
        });

    } catch (error: unknown) {
        logger.error('QPay setup check error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
