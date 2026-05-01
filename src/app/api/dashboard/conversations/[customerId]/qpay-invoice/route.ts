import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createQPayInvoice } from '@/lib/payment/qpay';
import { sendTextMessage } from '@/lib/facebook/messenger';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/dashboard/conversations/[customerId]/qpay-invoice
 *
 * Operator-аар чатанд гар QPay invoice үүсгэх. AI-аас хүн рүү шилжсэн чатанд
 * хэрэглэгчээс төлбөр авах боломжыг бий болгоно.
 *
 * Body: { amount: number; description?: string; sendToCustomer?: boolean }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ customerId: string }> }
) {
    try {
        const { customerId } = await params;
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const amount = Number(body?.amount);
        const description: string | undefined = body?.description?.toString();
        const sendToCustomer = Boolean(body?.sendToCustomer);

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { error: 'Дүнг 0-ээс их тоогоор оруулна уу.' },
                { status: 400 }
            );
        }

        const supabase = supabaseAdmin();

        // Shop QPay merchant + FB token-ыг авна
        const { data: shop, error: shopErr } = await supabase
            .from('shops')
            .select('id, name, qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status, facebook_page_access_token')
            .eq('id', authShop.id)
            .single();

        if (shopErr || !shop) {
            return NextResponse.json({ error: 'Shop олдсонгүй' }, { status: 404 });
        }

        if (!shop.qpay_merchant_id || shop.qpay_status !== 'active' || !shop.qpay_bank_code || !shop.qpay_account_number) {
            return NextResponse.json(
                {
                    error: 'QPay тохиргоо хийгдээгүй. Settings → QPay хэсэгт банкны мэдээллээ оруулна уу.',
                    code: 'QPAY_NOT_SETUP',
                },
                { status: 400 }
            );
        }

        // Customer-ыг shop scope-той авна
        const { data: customer, error: custErr } = await supabase
            .from('customers')
            .select('id, name, facebook_id, instagram_id')
            .eq('id', customerId)
            .eq('shop_id', authShop.id)
            .maybeSingle();

        if (custErr || !customer) {
            return NextResponse.json({ error: 'Хэрэглэгч олдсонгүй' }, { status: 404 });
        }

        // QPay invoice үүсгэх (orderId шаардахгүй generic функц)
        const callbackUrl = `${request.nextUrl.origin}/api/payment/webhook?type=manual_chat&customer=${customerId}`;
        const invoice = await createQPayInvoice({
            merchantId: shop.qpay_merchant_id,
            amount,
            description: (description?.slice(0, 100) || `${shop.name || 'Shop'} - Гар нэхэмжлэл`),
            callbackUrl,
            customerName: customer.name || 'Customer',
            bankAccounts: [{
                account_bank_code: shop.qpay_bank_code,
                account_number: shop.qpay_account_number,
                account_name: shop.qpay_account_name || shop.name || 'Shop',
                is_default: true,
            }],
        });

        if (!invoice) {
            return NextResponse.json(
                { error: 'QPay одоогоор ажиллахгүй байна. Дахин оролдоно уу.', code: 'QPAY_UNAVAILABLE' },
                { status: 503 }
            );
        }

        // payments хүснэгт рүү бичих (order_id null, manual_chat type)
        const expiresAt = invoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const { data: payment, error: payErr } = await supabase
            .from('payments')
            .insert({
                shop_id: authShop.id,
                payment_type: 'manual_chat',
                payment_method: 'qpay',
                amount,
                status: 'pending',
                qpay_invoice_id: invoice.invoice_id,
                qpay_qr_text: invoice.qr_text,
                qpay_qr_image: invoice.qr_image,
                metadata: {
                    customer_id: customerId,
                    description: description || null,
                    urls: invoice.urls,
                },
                expires_at: expiresAt,
            })
            .select()
            .single();

        if (payErr) {
            logger.error('manual_chat payment insert failed', { error: payErr.message });
            // Invoice үүссэн ч record хадгалаагүй — хэрэглэгчид QR/URL-ыг буцаана
        }

        // Сонгосон бол хэрэглэгч рүү автомат FB Messenger-ээр илгээнэ
        let sentToCustomerOk = false;
        if (sendToCustomer && customer.facebook_id && shop.facebook_page_access_token) {
            try {
                const link = invoice.urls?.[0]?.link || invoice.qr_text;
                const text = `💳 Төлбөрийн нэхэмжлэл\n\nДүн: ${amount.toLocaleString('mn-MN')}₮${description ? `\nТайлбар: ${description}` : ''}\n\nQPay-р төлөх линк:\n${link}`;
                await sendTextMessage({
                    recipientId: customer.facebook_id,
                    message: text,
                    pageAccessToken: shop.facebook_page_access_token,
                });
                sentToCustomerOk = true;
            } catch (err) {
                logger.warn('Manual QPay FB send failed (non-critical)', { error: String(err) });
            }
        }

        return NextResponse.json({
            success: true,
            sentToCustomer: sentToCustomerOk,
            payment_id: payment?.id ?? null,
            invoice_id: invoice.invoice_id,
            qr_text: invoice.qr_text,
            qr_image: invoice.qr_image,
            urls: invoice.urls,
            expires_at: expiresAt,
        });
    } catch (error: unknown) {
        logger.error('Manual QPay invoice error', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
