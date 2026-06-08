import { performCheckout } from '@/lib/services/CheckoutService';
import type { CheckoutArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

/**
 * AI chat checkout tool.
 *
 * The cart→order→payment logic (delivery fee, COD/QPay/bank fallback, shop
 * payment-method toggles) lives in the canonical `performCheckout` core in
 * `@/lib/services/CheckoutService`, shared with the `/checkout/[token]`
 * review-link flow. This handler only owns the AI-specific inputs
 * (notes default, metadata source, notification toggle) and renders the
 * Mongolian chat messages / `data` / `actions` from the structured result.
 */
export async function executeCheckout(
    args: CheckoutArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { notes, payment_type = 'cod' } = args;

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const result = await performCheckout({
        shopId: context.shopId,
        customerId: context.customerId,
        paymentType: payment_type,
        // Preserve the AI-specific note + metadata so chat orders stay
        // distinguishable from review-link orders.
        notes: notes || 'AI Chat Checkout',
        metadataSource: 'ai_checkout',
        customerName: context.customerName,
        notifyOrder: context.notifySettings?.order !== false,
    });

    if (!result.success) {
        return { success: false, error: result.error };
    }

    // ── Delivery items present but customer is missing phone/address ──
    if (result.awaitingDeliveryInfo) {
        const missingFields = [];
        if (result.missingPhone) missingFields.push('📱 Утасны дугаар');
        if (result.missingAddress) missingFields.push('📍 Хүргэх хаяг');

        const cartAmount = (result.cartAmount ?? 0).toLocaleString();
        const deliveryFee = result.deliveryFee ?? 0;

        return {
            success: true,
            message: `🛒 Сагсанд ${result.itemCount} бараа (${cartAmount}₮)${deliveryFee > 0 ? ` + Хүргэлт ${deliveryFee.toLocaleString()}₮` : ''}\n\nТөлбөр хийхийн өмнө дараах мэдээлэл хэрэгтэй:\n${missingFields.join('\n')}\n\nЖишээ: "99112233, БЗД 3-р хороо, 15-р байр"`,
            data: { awaiting_delivery_info: true, cart_id: result.cartId },
        };
    }

    const orderId = result.orderId!;
    const totalDeliveryFee = result.deliveryFee ?? 0;
    const deliveryMethod = result.deliveryMethod;
    const cartAmount = (result.cartAmount ?? 0).toLocaleString();
    const totalAmount = (result.totalWithDelivery ?? 0).toLocaleString();
    const shop = result.shop;

    // ── Cash on Delivery: бараа хүргэгдсэний дараа төлнө ──
    if (result.messageFlow === 'cod') {
        const deliveryInfoMsg = totalDeliveryFee > 0
            ? `\n🛍️ Бараа: ${cartAmount}₮\n🚚 Хүргэлт: ${totalDeliveryFee.toLocaleString()}₮\n💰 Нийт: ${totalAmount}₮`
            : `\nНийт дүн: ${totalAmount}₮`;

        return {
            success: true,
            message: `✅ Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ!${deliveryInfoMsg}\n\n📦 Төлбөрийн хэлбэр: Хүргэлтээр (бараа хүргэгдсэний дараа төлнө)\n\nХүргэлтийн ажилтан тантай удахгүй холбогдоно. Баярлалаа! 🙏`,
            data: {
                order_id: orderId,
                payment_id: result.paymentId,
                payment_link: null,
                qpay: false,
                payment_type: 'cod',
                delivery_fee: totalDeliveryFee,
                delivery_method: deliveryMethod,
            },
        };
    }

    // ── Delivery info string shared by QPay + bank-fallback flows ──
    let deliveryInfoMsg = '';
    if (totalDeliveryFee > 0) {
        deliveryInfoMsg = `\n🛍️ Бараа: ${cartAmount}₮\n🚚 Хүргэлт: ${totalDeliveryFee.toLocaleString()}₮\n💰 Нийт: ${totalAmount}₮`;
    } else if (deliveryMethod === 'pickup') {
        deliveryInfoMsg = `\nНийт: ${totalAmount}₮\n📍 Очиж авах: ${shop?.address || 'Дэлгүүрийн хаягаар'}`;
    }

    // ── QPay invoice link ──
    if (result.messageFlow === 'qpay') {
        return {
            success: true,
            message: `Захиалга амжилттай үүслээ! 🎉${deliveryInfoMsg || `\n\nНийт: ${totalAmount}₮`}\n\n💳 Төлбөр төлөх линк:\n${result.paymentLink}\n\n👆 Линк дээр дарж төлбөрөө төлнө үү`,
            data: { order_id: orderId, payment_id: result.paymentId, payment_link: result.paymentLink, qpay: true, delivery_fee: totalDeliveryFee, delivery_method: deliveryMethod },
        };
    }

    // ── Fallback: bank transfer (manual confirm by shop owner) ──
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
        data: { order_id: orderId, payment_id: result.paymentId, payment_link: null, qpay: false, delivery_fee: totalDeliveryFee, delivery_method: deliveryMethod },
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
