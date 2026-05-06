import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { registerShopAsMerchant, removeMerchant, BANK_CODES } from '@/lib/payment/qpay-merchant';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/shop/qpay-setup
 * Register shop owner's bank account for QPay payments
 * 
 * Body: {
 *   bank_code: string,       // e.g. "050000" (Khan bank)
 *   account_number: string,  // e.g. "5012345678"
 *   account_name: string,    // e.g. "Бат-Эрдэнэ"
 *   register_number: string  // Хувь хүний регистр / компанийн TIN (required — QPay-н uniqueness key)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { bank_code, account_number, account_name, register_number } = body;

        // Validate required fields
        if (!bank_code || !account_number || !account_name || !register_number) {
            return NextResponse.json({
                error: 'Банкны код, дансны дугаар, данс эзэмшигчийн нэр, регистрийн дугаар заавал шаардлагатай',
                required: ['bank_code', 'account_number', 'account_name', 'register_number'],
            }, { status: 400 });
        }

        // Validate bank code
        const validBankCodes = Object.values(BANK_CODES);
        if (!validBankCodes.includes(bank_code as typeof validBankCodes[number])) {
            return NextResponse.json({
                error: 'Банкны код буруу байна',
                valid_codes: BANK_CODES,
            }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Check if shop already has a QPay merchant
        const { data: shop } = await supabase
            .from('shops')
            .select('id, name, qpay_merchant_id, qpay_status, email, phone')
            .eq('id', authShop.id)
            .single();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        if (shop.qpay_merchant_id && shop.qpay_status === 'active') {
            return NextResponse.json({
                error: 'Shop аль хэдийнэ QPay-д бүртгэгдсэн байна',
                merchant_id: shop.qpay_merchant_id,
                status: 'active',
            }, { status: 400 });
        }

        // FIX: Block re-registration when pending (prevent duplicate merchants)
        if (shop.qpay_status === 'pending') {
            return NextResponse.json({
                error: 'QPay бүртгэл боловсруулагдаж байна. Түр хүлээнэ үү.',
                status: 'pending',
            }, { status: 400 });
        }

        // Set status to pending
        await supabase
            .from('shops')
            .update({ qpay_status: 'pending' })
            .eq('id', authShop.id);

        try {
            // Register with QPay
            const merchant = await registerShopAsMerchant({
                shopName: shop.name || 'Shop',
                registerNumber: register_number,
                bankCode: bank_code,
                accountNumber: account_number,
                accountName: account_name,
                phone: shop.phone || '',
                email: shop.email || '',
            });

            // Save merchant info to shop
            await supabase
                .from('shops')
                .update({
                    qpay_merchant_id: merchant.id,
                    qpay_bank_code: bank_code,
                    qpay_account_number: account_number,
                    qpay_account_name: account_name,
                    qpay_status: 'active',
                })
                .eq('id', authShop.id);

            logger.success('Shop QPay setup complete:', {
                shop_id: authShop.id,
                merchant_id: merchant.id,
            });

            return NextResponse.json({
                success: true,
                merchant_id: merchant.id,
                status: 'active',
                message: 'QPay merchant амжилттай бүртгэгдлээ! Таны хэрэглэгчид QPay-р төлбөр хийх боломжтой боллоо.',
            });

        } catch (regError: unknown) {
            // Mark as failed
            await supabase
                .from('shops')
                .update({ qpay_status: 'failed' })
                .eq('id', authShop.id);

            const msg = regError instanceof Error ? regError.message : 'Unknown error';
            logger.error('QPay merchant registration failed:', { shop_id: authShop.id, error: msg });

            return NextResponse.json({
                error: 'QPay бүртгэл амжилтгүй боллоо. Дахин оролдоно уу.',
                details: msg,
            }, { status: 500 });
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
            .select('qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status')
            .eq('id', authShop.id)
            .single();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        return NextResponse.json({
            is_setup: shop.qpay_status === 'active',
            merchant_id: shop.qpay_merchant_id,
            bank_code: shop.qpay_bank_code,
            account_number: shop.qpay_account_number ? `****${shop.qpay_account_number.slice(-4)}` : null,
            account_name: shop.qpay_account_name,
            status: shop.qpay_status || 'none',
            available_banks: BANK_CODES,
        });

    } catch (error: unknown) {
        logger.error('QPay setup check error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
