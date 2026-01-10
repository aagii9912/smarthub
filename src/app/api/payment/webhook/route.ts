import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/payment/webhook
 * Handle QPay payment webhook callbacks
 * 
 * QPay sends notifications when payment is completed
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        logger.info('QPay webhook received:', body);

        // Extract invoice ID from webhook payload
        // Note: Adjust based on actual QPay webhook format
        const invoiceId = body.invoice_id || body.object_id;

        if (!invoiceId) {
            logger.warn('Webhook missing invoice_id');
            return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Find payment by invoice ID
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('qpay_invoice_id', invoiceId)
            .single();

        if (paymentError || !payment) {
            logger.warn('Payment not found for invoice:', invoiceId);
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Check if already processed
        if (payment.status === 'paid') {
            logger.info('Payment already processed:', payment.id);
            return NextResponse.json({ message: 'Already processed' });
        }

        // Verify payment with QPay API
        const paymentCheck = await checkPaymentStatus(invoiceId);

        if (isPaymentCompleted(paymentCheck)) {
            const transactionId = getTransactionId(paymentCheck);

            // Update payment status
            const { error: updateError } = await supabase
                .from('payments')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    qpay_transaction_id: transactionId,
                    metadata: {
                        ...payment.metadata,
                        payment_details: paymentCheck.rows[0],
                    },
                })
                .eq('id', payment.id);

            if (updateError) {
                logger.error('Failed to update payment', { error: updateError.message });
                throw new Error('Failed to update payment');
            }

            // Trigger will auto-update order status
            logger.success('Payment confirmed:', {
                payment_id: payment.id,
                transaction_id: transactionId
            });

            // Send payment confirmation email
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
                        paymentMethod: payment.payment_method,
                        shopName: orderData.shops.name,
                        invoiceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/invoice/${orderData.id}`,
                    });

                    logger.success('Payment confirmation email sent');
                }
            } catch (emailError: any) {
                logger.error('Failed to send email (non-critical)', { error: emailError?.message });
            }

            return NextResponse.json({
                success: true,
                message: 'Payment confirmed'
            });
        } else {
            logger.warn('Payment not completed yet:', invoiceId);
            return NextResponse.json({
                message: 'Payment not completed'
            }, { status: 200 });
        }

    } catch (error: any) {
        logger.error('Webhook processing error:', error);
        return NextResponse.json({
            error: 'Webhook processing failed'
        }, { status: 500 });
    }
}

/**
 * GET /api/payment/webhook
 * Verify webhook endpoint (for QPay setup)
 */
export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: 'QPay webhook endpoint',
        status: 'active'
    });
}
