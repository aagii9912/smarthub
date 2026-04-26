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

                // Нэгдсэн confirmation helper — payment, order, stock, notifications
                // бүгд нэг канончлон логикоор явна (webhook-той адилхан)
                const { confirmOrderPayment } = await import('@/lib/services/PaymentConfirmationService');
                await confirmOrderPayment({
                    paymentId: payment.id,
                    orderId: payment.order_id ?? null,
                    transactionId,
                    amount: Number(payment.amount),
                    paymentMethod: 'qpay',
                    confirmedVia: 'manual_check',
                    paymentDetails: paymentCheck.rows?.[0] ?? null,
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
