/**
 * PaymentConfirmationService
 *
 * Төлбөр баталгаажуулалтын нэгдсэн (canonical) урсгал.
 *
 * Энэ helper-ийг QPay webhook (`/api/payment/webhook`) болон хэрэглэгч гараар
 * шалгах (`/api/payment/status/[paymentId]`) хоёул дуудна. Ингэснээр:
 *   - orders.status = 'confirmed'
 *   - orders.payment_status = 'paid'
 *   - Stock deduction-ийг idempotent RPC-ээр дуудна
 *   - Email + Messenger notification-г нэг удаа л илгээнэ
 *   - Audit log-т confirmedVia ('webhook' эсвэл 'manual_check') тэмдэглэнэ
 *
 * `atomic_claim_stock_deduction` RPC нь өөрөө idempotent тул хоёр зам зэрэг
 * орлоо ч бараа давхар хасагдахгүй.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { deductStockForOrder } from '@/lib/services/StockService';

export interface ConfirmOrderPaymentParams {
    paymentId: string;
    orderId: string | null;
    transactionId: string | null;
    amount: number;
    paymentMethod: string;
    confirmedVia: 'webhook' | 'manual_check';
    paymentDetails?: unknown;
}

/**
 * Төлбөр бүрэн баталгаажсаны дараах нэгдсэн урсгал.
 * Бүх алхмыг харилцан хамааралтайгаар дуудна; ямар нэг алхам алдаа гаргасан
 * ч дараагийн алхмыг үргэлжлүүлэхийг оролдоно (critical биш алхмуудыг
 * зөвхөн log-лоно).
 */
export async function confirmOrderPayment(params: ConfirmOrderPaymentParams): Promise<void> {
    const supabase = supabaseAdmin();
    const { paymentId, orderId, transactionId, amount, paymentMethod, confirmedVia, paymentDetails } = params;

    const now = new Date().toISOString();

    // ── 1. payments → paid ──
    const { data: existingPayment, error: paymentFetchError } = await supabase
        .from('payments')
        .select('id, shop_id, status, metadata')
        .eq('id', paymentId)
        .single();

    if (paymentFetchError || !existingPayment) {
        logger.error('confirmOrderPayment: payment not found', { paymentId, error: paymentFetchError?.message });
        throw new Error('Payment not found');
    }

    const existingMeta = (existingPayment.metadata as Record<string, unknown>) || {};

    // Idempotent-ээр дахин ажиллуулж болно: хэрэв аль хэдийн paid бол payment
    // update-г алгасна (stock deduction-ийг идэвхтэй хэвээр дуудна —
    // atomic_claim_stock_deduction өөрөө idempotent)
    if (existingPayment.status !== 'paid') {
        const { error: updateError } = await supabase
            .from('payments')
            .update({
                status: 'paid',
                paid_at: now,
                qpay_transaction_id: transactionId,
                metadata: {
                    ...existingMeta,
                    confirmed_via: confirmedVia,
                    payment_details: paymentDetails ?? existingMeta.payment_details ?? null,
                },
            })
            .eq('id', paymentId);

        if (updateError) {
            logger.error('confirmOrderPayment: failed to update payment', { paymentId, error: updateError.message });
            throw new Error('Failed to update payment');
        }
    }

    // ── 2. orders → status='confirmed', payment_status='paid' ──
    if (orderId) {
        const { error: orderError } = await supabase
            .from('orders')
            .update({
                status: 'confirmed',
                payment_status: 'paid',
                payment_method: paymentMethod,
                paid_at: now,
            })
            .eq('id', orderId);

        if (orderError) {
            logger.error('confirmOrderPayment: failed to update order', { orderId, error: orderError.message });
        } else {
            logger.success('Order confirmed:', { orderId, confirmedVia });
        }
    }

    // ── 3. Stock deduction (idempotent) ──
    if (orderId) {
        try {
            await deductStockForOrder(orderId);
        } catch (stockErr: unknown) {
            logger.error('confirmOrderPayment: stock deduction failed (non-critical)', {
                orderId,
                error: stockErr instanceof Error ? stockErr.message : String(stockErr),
            });
        }
    }

    // ── 4. Audit log ──
    try {
        await supabase
            .from('payment_audit_logs')
            .insert({
                payment_id: paymentId,
                shop_id: existingPayment.shop_id,
                order_id: orderId,
                action: 'paid',
                old_status: existingPayment.status,
                new_status: 'paid',
                amount,
                payment_method: paymentMethod,
                actor: confirmedVia,
                metadata: {
                    qpay_transaction_id: transactionId,
                    confirmed_via: confirmedVia,
                },
            });
    } catch (auditErr) {
        logger.warn('confirmOrderPayment: audit log insert failed (non-critical)', { error: String(auditErr) });
    }

    // ── 5. Notifications (email + messenger) ──
    if (orderId) {
        await sendConfirmationNotifications({
            orderId,
            paymentId,
            amount,
            paymentMethod,
            existingMeta,
        });
    }

    logger.success('Payment confirmation completed:', {
        paymentId,
        orderId,
        confirmedVia,
        transactionId,
    });
}

/**
 * Email + Messenger мэдэгдлийг илгээнэ.
 * `messenger_notified` flag-аар давхар илгээлтээс сэргийлнэ.
 */
async function sendConfirmationNotifications(params: {
    orderId: string;
    paymentId: string;
    amount: number;
    paymentMethod: string;
    existingMeta: Record<string, unknown>;
}): Promise<void> {
    const { orderId, paymentId, amount, paymentMethod, existingMeta } = params;
    const supabase = supabaseAdmin();

    try {
        const { data: orderData } = await supabase
            .from('orders')
            .select('*, customers(name, email, facebook_id), shops(name, facebook_page_access_token, address)')
            .eq('id', orderId)
            .single();

        if (!orderData) return;

        // ── Email ──
        if (orderData.customers?.email) {
            try {
                const { sendPaymentConfirmationEmail } = await import('@/lib/email/email');
                await sendPaymentConfirmationEmail({
                    customerEmail: orderData.customers.email,
                    customerName: orderData.customers.name,
                    orderId: orderData.id,
                    amount,
                    paymentMethod,
                    shopName: orderData.shops?.name || 'Shop',
                    invoiceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/invoice/${orderData.id}`,
                });
                logger.success('Payment confirmation email sent');
            } catch (emailErr) {
                logger.warn('Email send failed (non-critical):', { error: String(emailErr) });
            }
        }

        // ── Messenger (respect messenger_notified flag) ──
        const alreadyNotified = Boolean(existingMeta.messenger_notified);
        if (!alreadyNotified && orderData.customers?.facebook_id && orderData.shops?.facebook_page_access_token) {
            try {
                const { sendTaggedMessage } = await import('@/lib/facebook/messenger');
                const amountStr = Number(amount).toLocaleString();
                const deliveryFee = Number(orderData.delivery_fee || 0);
                const deliveryFeeMsg = deliveryFee > 0 ? `\n🚚 Хүргэлт: ${deliveryFee.toLocaleString()}₮` : '';

                let confirmMsg: string;
                if (orderData.delivery_method === 'pickup') {
                    const shopAddress = orderData.shops?.address || 'Дэлгүүрийн хаяг';
                    confirmMsg = `✅ Таны ${amountStr}₮ төлбөр амжилттай баталгаажлаа!\n\n📍 Очиж авах газар: ${shopAddress}\n\nЗахиалга #${orderId.substring(0, 8)} — бэлтгэж эхэлнэ. Баярлалаа! 🙏`;
                } else {
                    const deliveryAddress = orderData.delivery_address || '';
                    const addressMsg = deliveryAddress ? `\n📦 Хүргэх хаяг: ${deliveryAddress}` : '';
                    confirmMsg = `✅ Таны ${amountStr}₮ төлбөр амжилттай баталгаажлаа!${deliveryFeeMsg}${addressMsg}\n\nЗахиалга #${orderId.substring(0, 8)} — бэлтгэж эхэлнэ. Баярлалаа! 🙏`;
                }

                await sendTaggedMessage({
                    recipientId: orderData.customers.facebook_id,
                    message: confirmMsg,
                    pageAccessToken: orderData.shops.facebook_page_access_token,
                    tag: 'POST_PURCHASE_UPDATE',
                });

                await supabase
                    .from('payments')
                    .update({
                        metadata: {
                            ...existingMeta,
                            messenger_notified: true,
                        },
                    })
                    .eq('id', paymentId);

                logger.success('Payment confirmation sent to customer via Messenger');
            } catch (msgErr) {
                logger.warn('Messenger confirmation failed (non-critical):', { error: String(msgErr) });
            }
        }
    } catch (notifyErr) {
        logger.error('Notification pipeline failed (non-critical):', {
            orderId,
            error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
        });
    }
}
