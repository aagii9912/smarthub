import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendOrderNotification } from '@/lib/notifications';
import { getCartFromDB } from '../../../helpers/stockHelpers';
import { createShopOrderInvoice } from '@/lib/payment/qpay';
import type { CheckoutArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

export async function executeCheckout(
    args: CheckoutArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { notes } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const cart = await getCartFromDB(context.shopId, context.customerId);

    if (!cart || cart.items.length === 0) {
        return { success: false, error: 'Сагс хоосон байна. Эхлээд бараа нэмнэ үү.' };
    }

    const { data: orderId, error: checkoutError } = await supabase.rpc('checkout_cart', {
        p_cart_id: cart.id,
        p_notes: notes || 'AI Chat Checkout'
    });

    if (checkoutError) {
        logger.error('Checkout error:', { error: checkoutError });
        return { success: false, error: checkoutError.message };
    }

    // Get shop details (QPay merchant + bank info)
    const { data: shop } = await supabase
        .from('shops')
        .select('name, bank_name, account_number, account_name, qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status')
        .eq('id', context.shopId)
        .single();

    let paymentId: string | null = null;
    let qpaySuccess = false;
    let paymentLink = '';

    // ── QPay Invoice (using shop's own merchant) ──
    if (shop?.qpay_merchant_id && shop.qpay_status === 'active') {
        try {
            const qpayInvoice = await createShopOrderInvoice({
                shopMerchantId: shop.qpay_merchant_id,
                shopBankCode: shop.qpay_bank_code!,
                shopAccountNumber: shop.qpay_account_number!,
                shopAccountName: shop.qpay_account_name!,
                orderId: orderId,
                amount: cart.total_amount,
                shopName: shop.name || 'Shop',
                callbackUrl: `${SITE_URL}/api/payment/webhook?type=order&order=${orderId}`,
            });

            if (qpayInvoice) {
                // Save payment record
                const { data: payment } = await supabase
                    .from('payments')
                    .insert({
                        order_id: orderId,
                        shop_id: context.shopId,
                        payment_type: 'order',
                        payment_method: 'qpay',
                        amount: cart.total_amount,
                        status: 'pending',
                        qpay_invoice_id: qpayInvoice.invoice_id,
                        qpay_qr_text: qpayInvoice.qr_text,
                        qpay_qr_image: qpayInvoice.qr_image,
                        metadata: {
                            urls: qpayInvoice.urls,
                            source: 'ai_checkout',
                            shop_merchant_id: shop.qpay_merchant_id,
                        },
                        expires_at: qpayInvoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    })
                    .select('id')
                    .single();

                if (payment) {
                    paymentId = payment.id;
                    paymentLink = `${SITE_URL}/pay/${payment.id}`;
                    qpaySuccess = true;
                }
            }
        } catch (err) {
            logger.warn('QPay invoice creation failed:', { error: String(err) });
        }
    }

    // Fallback: bank transfer payment record
    if (!qpaySuccess) {
        const { data: payment } = await supabase
            .from('payments')
            .insert({
                order_id: orderId,
                shop_id: context.shopId,
                payment_type: 'order',
                payment_method: shop?.account_number ? 'bank_transfer' : 'cash',
                amount: cart.total_amount,
                status: 'pending',
            })
            .select('id')
            .single();

        if (payment) paymentId = payment.id;
    }

    // Send notification
    if (context.notifySettings?.order !== false) {
        try {
            await sendOrderNotification(context.shopId, 'new', {
                orderId: orderId,
                customerName: context.customerName,
                totalAmount: cart.total_amount,
            });
        } catch (notifyError) {
            logger.warn('Notification failed but order created:', { error: String(notifyError) });
        }
    }

    // ── Build response message ──
    const amount = cart.total_amount.toLocaleString();
    let paymentMsg = `✅ Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ!\nНийт дүн: ${amount}₮\n`;

    if (qpaySuccess && paymentLink) {
        // PRIMARY: Send a payment link (not QR code!)
        paymentMsg += `\n💳 Төлбөр төлөх:\n${paymentLink}\n\nДээрх линкээр орж банкны аппаа сонгоод төлнө үү.`;
    } else if (shop?.account_number) {
        // FALLBACK: Bank transfer
        paymentMsg += `\n💳 Дансаар шилжүүлэх:\nБанк: ${shop.bank_name || 'Банк'}\nДанс: ${shop.account_number}\nНэр: ${shop.account_name || 'Дэлгүүр'}\nГүйлгээний утга: ${orderId.substring(0, 8)}`;
        paymentMsg += `\n\n*Шилжүүлсэн бол баримтаа илгээнэ үү.`;
    } else {
        paymentMsg += `\nТөлбөрийн мэдээллийг удахгүй илгээнэ.`;
    }

    return {
        success: true,
        message: paymentMsg,
        data: { order_id: orderId, payment_id: paymentId, payment_link: paymentLink, qpay: qpaySuccess },
        actions: [
            {
                type: 'payment_method',
                buttons: [
                    ...(qpaySuccess ? [{
                        id: 'pay_qpay',
                        label: '💳 Төлбөр төлөх',
                        icon: 'qpay',
                        variant: 'primary' as const,
                        payload: `OPEN_URL:${paymentLink}`,
                    }] : []),
                    ...(shop?.account_number ? [{
                        id: 'pay_bank',
                        label: 'Дансаар шилжүүлэх',
                        icon: 'bank',
                        variant: 'secondary' as const,
                        payload: 'PAY_BANK',
                    }] : []),
                ],
                context: { order_id: orderId },
            },
            {
                type: 'order_actions',
                buttons: [
                    {
                        id: 'check_payment',
                        label: '💰 Төлбөр шалгах',
                        variant: 'secondary' as const,
                        payload: 'CHECK_PAYMENT',
                    },
                    {
                        id: 'cancel_order',
                        label: 'Цуцлах',
                        icon: 'cancel',
                        variant: 'danger' as const,
                        payload: 'CANCEL_ORDER',
                    },
                ],
                context: { order_id: orderId },
            },
        ],
    };
}
