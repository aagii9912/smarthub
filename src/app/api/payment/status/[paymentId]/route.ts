import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/payment/status/[paymentId]
 * Check payment status manually — FULL activation (same as webhook)
 * 
 * When payment is confirmed:
 * 1. Payment → paid
 * 2. Order → paid (with payment_method)
 * 3. Stock deduction
 * 4. Email notification
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paymentId } = await params;
        const supabase = supabaseAdmin();

        // Get payment
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*, orders(id, shop_id)')
            .eq('id', paymentId)
            .single();

        if (error || !payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // FIX: Verify shop owns this payment via shop_id OR order's shop_id
        const orderShopId = payment.orders?.shop_id;
        if (payment.shop_id !== authShop.id && orderShopId !== authShop.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // If already paid, return current status
        if (payment.status === 'paid') {
            return NextResponse.json({
                status: 'paid',
                payment: {
                    id: payment.id,
                    status: payment.status,
                    paid_at: payment.paid_at,
                    transaction_id: payment.qpay_transaction_id,
                },
            });
        }

        // For QPay payments, check with QPay API
        if (payment.payment_method === 'qpay' && payment.qpay_invoice_id) {
            const paymentCheck = await checkPaymentStatus(payment.qpay_invoice_id);

            if (isPaymentCompleted(paymentCheck)) {
                const transactionId = getTransactionId(paymentCheck);

                // 1. Update payment to paid
                await supabase
                    .from('payments')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        qpay_transaction_id: transactionId,
                        metadata: {
                            ...(payment.metadata as Record<string, unknown> || {}),
                            payment_details: paymentCheck.rows?.[0] ?? null,
                            confirmed_via: 'manual_check',
                        },
                    })
                    .eq('id', payment.id);

                // 2. FIX: Update order status to 'paid'
                if (payment.order_id) {
                    const { error: orderError } = await supabase
                        .from('orders')
                        .update({
                            status: 'paid',
                            payment_method: 'qpay',
                            paid_at: new Date().toISOString(),
                        })
                        .eq('id', payment.order_id);

                    if (orderError) {
                        logger.error('Failed to update order status:', { error: orderError.message });
                    }
                }

                // 3. FIX: Stock deduction
                if (payment.order_id) {
                    try {
                        const { deductStockForOrder } = await import('@/lib/services/StockService');
                        await deductStockForOrder(payment.order_id);
                    } catch (stockErr: unknown) {
                        logger.error('Stock deduction failed (non-critical):', {
                            error: stockErr instanceof Error ? stockErr.message : String(stockErr),
                        });
                    }
                }

                // 4. FIX: Send email notification
                if (payment.order_id) {
                    try {
                        const { data: orderData } = await supabase
                            .from('orders')
                            .select('*, customers(name, email), shops(name)')
                            .eq('id', payment.order_id)
                            .single();

                        if (orderData?.customers?.email) {
                            const { sendPaymentConfirmationEmail } = await import('@/lib/email/email');
                            await sendPaymentConfirmationEmail({
                                customerEmail: orderData.customers.email,
                                customerName: orderData.customers.name,
                                orderId: orderData.id,
                                amount: Number(payment.amount),
                                paymentMethod: 'qpay',
                                shopName: orderData.shops?.name || 'Shop',
                                invoiceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/invoice/${orderData.id}`,
                            });
                            logger.success('Payment confirmation email sent (manual check)');
                        }
                    } catch (emailErr: unknown) {
                        logger.error('Email failed (non-critical):', {
                            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
                        });
                    }
                }

                logger.success('Payment confirmed via manual check:', {
                    payment_id: payment.id,
                    order_id: payment.order_id,
                    transaction_id: transactionId,
                });

                return NextResponse.json({
                    status: 'paid',
                    payment: {
                        id: payment.id,
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        transaction_id: transactionId,
                    },
                });
            }
        }

        // Still pending
        return NextResponse.json({
            status: payment.status,
            payment: {
                id: payment.id,
                status: payment.status,
                method: payment.payment_method,
                qr_image: payment.qpay_qr_image,
                qr_text: payment.qpay_qr_text,
                expires_at: payment.expires_at,
            },
        });

    } catch (error: unknown) {
        logger.error('Payment status check error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({
            error: 'Failed to check payment status'
        }, { status: 500 });
    }
}
