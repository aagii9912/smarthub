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

    // ── Calculate delivery fee and determine delivery method ──
    let totalDeliveryFee = 0;
    let hasDeliveryItems = false;
    let hasPickupOnly = false;

    for (const item of cart.items) {
        const { data: product } = await supabase
            .from('products')
            .select('delivery_type, delivery_fee')
            .eq('id', item.product_id)
            .single();

        if (product) {
            if (product.delivery_type === 'paid' && product.delivery_fee) {
                totalDeliveryFee += Number(product.delivery_fee);
                hasDeliveryItems = true;
            } else if (product.delivery_type === 'pickup_only') {
                hasPickupOnly = true;
            } else if (product.delivery_type === 'included') {
                hasDeliveryItems = true;
            }
        }
    }

    // Determine delivery method
    const deliveryMethod = (hasPickupOnly && !hasDeliveryItems) ? 'pickup' : 'delivery';

    // ── Check if customer contact info exists (for delivery items) ──
    if (hasDeliveryItems) {
        const { data: customer } = await supabase
            .from('customers')
            .select('phone, address')
            .eq('id', context.customerId)
            .single();

        if (!customer?.phone || !customer?.address) {
            const missingFields = [];
            if (!customer?.phone) missingFields.push('📱 Утасны дугаар');
            if (!customer?.address) missingFields.push('📍 Хүргэх хаяг');

            return {
                success: true,
                message: `🛒 Сагсанд ${cart.items.length} бараа (${cart.total_amount.toLocaleString()}₮)${totalDeliveryFee > 0 ? ` + Хүргэлт ${totalDeliveryFee.toLocaleString()}₮` : ''}\n\nТөлбөр хийхийн өмнө дараах мэдээлэл хэрэгтэй:\n${missingFields.join('\n')}\n\nЖишээ: "99112233, БЗД 3-р хороо, 15-р байр"`,
                data: { awaiting_delivery_info: true, cart_id: cart.id },
            };
        }
    }

    // ── Proceed with checkout ──
    const { data: orderId, error: checkoutError } = await supabase.rpc('checkout_cart', {
        p_cart_id: cart.id,
        p_notes: notes || 'AI Chat Checkout'
    });

    if (checkoutError) {
        logger.error('Checkout error:', { error: checkoutError });
        return { success: false, error: checkoutError.message };
    }

    // ── Update order with delivery info ──
    const customerData = hasDeliveryItems
        ? await supabase.from('customers').select('phone, address').eq('id', context.customerId).single()
        : null;

    await supabase.from('orders').update({
        delivery_method: deliveryMethod,
        delivery_fee: totalDeliveryFee,
        customer_phone: customerData?.data?.phone || null,
        delivery_address: customerData?.data?.address || null,
    }).eq('id', orderId);

    // Get shop details (QPay merchant + bank info)
    const { data: shop } = await supabase
        .from('shops')
        .select('name, bank_name, account_number, account_name, qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status, address')
        .eq('id', context.shopId)
        .single();

    // Total amount including delivery fee
    const totalWithDelivery = cart.total_amount + totalDeliveryFee;

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
                amount: totalWithDelivery,
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
                        amount: totalWithDelivery,
                        status: 'pending',
                        qpay_invoice_id: qpayInvoice.invoice_id,
                        qpay_qr_text: qpayInvoice.qr_text,
                        qpay_qr_image: qpayInvoice.qr_image,
                        metadata: {
                            urls: qpayInvoice.urls,
                            source: 'ai_checkout',
                            shop_merchant_id: shop.qpay_merchant_id,
                            delivery_fee: totalDeliveryFee,
                            delivery_method: deliveryMethod,
                        },
                        expires_at: qpayInvoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    })
                    .select('id')
                    .single();

                if (payment) {
                    paymentId = payment.id;
                    paymentLink = `${SITE_URL}/pay/${payment.id}`;
                    qpaySuccess = true;

                    // FIX: Update order payment_method + total_amount (with delivery)
                    await supabase
                        .from('orders')
                        .update({ 
                            payment_method: 'qpay',
                            total_amount: totalWithDelivery,
                        })
                        .eq('id', orderId);
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
                amount: totalWithDelivery,
                status: 'pending',
            })
            .select('id')
            .single();

        if (payment) paymentId = payment.id;

        // Update order total_amount with delivery fee
        if (totalDeliveryFee > 0) {
            await supabase
                .from('orders')
                .update({ total_amount: totalWithDelivery })
                .eq('id', orderId);
        }
    }

    // Send notification
    if (context.notifySettings?.order !== false) {
        try {
            await sendOrderNotification(context.shopId, 'new', {
                orderId: orderId,
                customerName: context.customerName,
                totalAmount: totalWithDelivery,
            });
        } catch (notifyError) {
            logger.warn('Notification failed but order created:', { error: String(notifyError) });
        }
    }

    // ── Build response message ──
    const cartAmount = cart.total_amount.toLocaleString();
    const totalAmount = totalWithDelivery.toLocaleString();

    // Delivery info string
    let deliveryInfoMsg = '';
    if (totalDeliveryFee > 0) {
        deliveryInfoMsg = `\n🛍️ Бараа: ${cartAmount}₮\n🚚 Хүргэлт: ${totalDeliveryFee.toLocaleString()}₮\n💰 Нийт: ${totalAmount}₮`;
    } else if (deliveryMethod === 'pickup') {
        deliveryInfoMsg = `\nНийт: ${totalAmount}₮\n📍 Очиж авах: ${shop?.address || 'Дэлгүүрийн хаягаар'}`;
    }

    if (qpaySuccess && paymentLink) {
        return {
            success: true,
            message: `Захиалга амжилттай үүслээ! 🎉${deliveryInfoMsg || `\n\nНийт: ${totalAmount}₮`}\n\n💳 Төлбөр төлөх линк:\n${paymentLink}\n\n👆 Линк дээр дарж төлбөрөө төлнө үү`,
            data: { order_id: orderId, payment_id: paymentId, payment_link: paymentLink, qpay: true, delivery_fee: totalDeliveryFee, delivery_method: deliveryMethod },
        };
    }

    // FALLBACK: No QPay — bank transfer
    let paymentMsg = `✅ Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ!${deliveryInfoMsg || `\nНийт дүн: ${totalAmount}₮`}\n`;

    if (shop?.account_number) {
        paymentMsg += `\n💳 Дансаар шилжүүлэх:\nБанк: ${shop.bank_name || 'Банк'}\nДанс: ${shop.account_number}\nНэр: ${shop.account_name || 'Дэлгүүр'}\nГүйлгээний утга: ${orderId.substring(0, 8)}`;
        paymentMsg += `\n\n*Шилжүүлсэн бол баримтаа илгээнэ үү.`;
    } else {
        paymentMsg += `\nТөлбөрийн мэдээллийг удахгүй илгээнэ.`;
    }

    return {
        success: true,
        message: paymentMsg,
        data: { order_id: orderId, payment_id: paymentId, payment_link: null, qpay: false, delivery_fee: totalDeliveryFee, delivery_method: deliveryMethod },
        actions: [
            ...(shop?.account_number ? [{
                type: 'payment_method' as const,
                buttons: [{
                    id: 'pay_bank',
                    label: '💳 Дансаар шилжүүлэх',
                    icon: 'bank',
                    variant: 'primary' as const,
                    payload: 'PAY_BANK',
                }],
                context: { order_id: orderId },
            }] : []),
        ],
    };
}

