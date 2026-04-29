import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';

/**
 * GET /api/cron/check-payments
 * 
 * Cron job that checks all pending QPay payments and confirms any that have been paid.
 * This is the PRIMARY mechanism for detecting payments when QPay webhook fails.
 * 
 * - Fetches all pending QPay payments created in the last 30 minutes
 * - Checks each one against QPay API
 * - If paid: updates status, confirms order, sends Messenger notification
 * - Prevents duplicate notifications via messenger_notified flag
 */
export async function GET() {
    const startTime = Date.now();
    const supabase = supabaseAdmin();

    try {
        // Find all pending QPay payments from last 30 minutes
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: pendingPayments, error } = await supabase
            .from('payments')
            .select('id, amount, order_id, shop_id, qpay_invoice_id, metadata, payment_method')
            .eq('status', 'pending')
            .eq('payment_method', 'qpay')
            .not('qpay_invoice_id', 'is', null)
            .gte('created_at', thirtyMinAgo)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            logger.error('Failed to fetch pending payments:', { error: error.message });
            return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
        }

        if (!pendingPayments || pendingPayments.length === 0) {
            return NextResponse.json({
                message: 'No pending payments to check',
                checked: 0,
                confirmed: 0,
                duration: Date.now() - startTime,
            });
        }

        logger.info(`Checking ${pendingPayments.length} pending QPay payments...`);

        let confirmed = 0;
        let messaged = 0;

        for (const payment of pendingPayments) {
            try {
                const paymentCheck = await checkPaymentStatus(payment.qpay_invoice_id);

                if (!isPaymentCompleted(paymentCheck)) {
                    continue; // Still pending, skip
                }

                const transactionId = getTransactionId(paymentCheck);

                // ── Update payment to paid ──
                const updatedMetadata = {
                    ...(payment.metadata as Record<string, unknown> || {}),
                    payment_details: paymentCheck.rows?.[0] ?? null,
                    confirmed_via: 'cron_check_payments',
                    messenger_notified: true,
                };

                await supabase
                    .from('payments')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        qpay_transaction_id: transactionId,
                        metadata: updatedMetadata,
                    })
                    .eq('id', payment.id);

                // ── Update order status ──
                if (payment.order_id) {
                    await supabase
                        .from('orders')
                        .update({
                            status: 'confirmed',
                            payment_status: 'paid',
                            payment_method: 'qpay',
                            paid_at: new Date().toISOString(),
                        })
                        .eq('id', payment.order_id);

                    // Deduct stock
                    try {
                        const { deductStockForOrder } = await import('@/lib/services/StockService');
                        await deductStockForOrder(payment.order_id);
                    } catch (stockErr) {
                        logger.error('Stock deduction failed (cron):', { error: String(stockErr) });
                    }

                    // ── Send Messenger confirmation ──
                    try {
                        const { data: orderData } = await supabase
                            .from('orders')
                            .select('*, customers(name, facebook_id), shops(name, facebook_page_access_token, address)')
                            .eq('id', payment.order_id)
                            .single();

                        if (orderData?.customers?.facebook_id && orderData?.shops?.facebook_page_access_token) {
                            const { sendTaggedMessage } = await import('@/lib/facebook/messenger');
                            const amount = Number(payment.amount).toLocaleString();
                            const deliveryFee = Number(orderData.delivery_fee || 0);
                            const deliveryFeeMsg = deliveryFee > 0 ? `\n🚚 Хүргэлт: ${deliveryFee.toLocaleString()}₮` : '';

                            let confirmMsg = '';
                            if (orderData.delivery_method === 'pickup') {
                                const shopAddress = orderData.shops?.address || 'Дэлгүүрийн хаяг';
                                confirmMsg = `✅ Таны ${amount}₮ төлбөр амжилттай баталгаажлаа!\n\n📍 Очиж авах газар: ${shopAddress}\n\nЗахиалга #${payment.order_id.substring(0, 8)} — бэлтгэж эхэлнэ. Баярлалаа! 🙏`;
                            } else {
                                const deliveryAddress = orderData.delivery_address || '';
                                const addressMsg = deliveryAddress ? `\n📦 Хүргэх хаяг: ${deliveryAddress}` : '';
                                confirmMsg = `✅ Таны ${amount}₮ төлбөр амжилттай баталгаажлаа!${deliveryFeeMsg}${addressMsg}\n\nЗахиалга #${payment.order_id.substring(0, 8)} — бэлтгэж эхэлнэ. Баярлалаа! 🙏`;
                            }

                            await sendTaggedMessage({
                                recipientId: orderData.customers.facebook_id,
                                message: confirmMsg,
                                pageAccessToken: orderData.shops.facebook_page_access_token,
                                tag: 'POST_PURCHASE_UPDATE',
                            });

                            messaged++;
                            logger.success('Messenger confirmation sent via cron:', { order_id: payment.order_id });
                        }
                    } catch (msgErr) {
                        logger.warn('Cron Messenger notification failed:', { error: String(msgErr) });
                    }

                    // ── Audit log ──
                    try {
                        await supabase
                            .from('payment_audit_logs')
                            .insert({
                                payment_id: payment.id,
                                shop_id: payment.shop_id,
                                order_id: payment.order_id,
                                action: 'paid',
                                old_status: 'pending',
                                new_status: 'paid',
                                amount: Number(payment.amount),
                                payment_method: 'qpay',
                                actor: 'cron_check_payments',
                                metadata: {
                                    qpay_transaction_id: transactionId,
                                    confirmed_via: 'cron_check_payments',
                                },
                            });
                    } catch {
                        // non-critical
                    }
                }

                confirmed++;
                logger.success('Payment confirmed via cron:', {
                    payment_id: payment.id,
                    order_id: payment.order_id,
                    transaction_id: transactionId,
                });

                // ── Push notification to shop owner ──
                if (payment.shop_id) {
                    try {
                        const enabled = await isNotificationEnabled(
                            payment.shop_id,
                            'payment_received'
                        );
                        if (enabled) {
                            await sendPushNotification(payment.shop_id, {
                                title: '💳 Төлбөр төлөгдлөө',
                                body: `Захиалга #${(payment.order_id ?? '').slice(0, 8)} — ${Number(payment.amount).toLocaleString()}₮ амжилттай төлөгдлөө`,
                                url: '/dashboard/orders',
                                tag: `payment-paid-${payment.id}`,
                            });
                        }
                    } catch (pushErr) {
                        logger.warn('Cron push notification failed:', { error: String(pushErr) });
                    }
                }

            } catch (checkErr) {
                logger.warn('QPay check failed for payment:', {
                    payment_id: payment.id,
                    error: String(checkErr),
                });
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`Cron check-payments completed:`, { checked: pendingPayments.length, confirmed, messaged, duration });

        return NextResponse.json({
            message: 'Payment check completed',
            checked: pendingPayments.length,
            confirmed,
            messaged,
            duration,
        });

    } catch (error) {
        logger.error('Cron check-payments error:', { error: String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
