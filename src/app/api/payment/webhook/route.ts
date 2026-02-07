import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

/**
 * Verify QPay webhook signature
 */
function verifyWebhookSignature(body: string, signature: string | null): boolean {
    const secret = process.env.QPAY_WEBHOOK_SECRET;
    if (!secret) {
        logger.warn('QPAY_WEBHOOK_SECRET not configured — rejecting webhook');
        return false;
    }
    if (!signature) return false;

    const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}

/**
 * POST /api/payment/webhook
 * Handle QPay payment webhook callbacks
 * 
 * QPay sends notifications when payment is completed
 */
export async function POST(request: NextRequest) {
    try {
        // SEC-2: Verify webhook signature
        const rawBody = await request.text();
        const signature = request.headers.get('x-qpay-signature');

        if (!verifyWebhookSignature(rawBody, signature)) {
            logger.warn('Invalid webhook signature received');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const body = JSON.parse(rawBody);

        logger.info('QPay webhook received:', body);

        // Extract invoice ID from webhook payload
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

            // Deduct actual stock from products after payment confirmed
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('product_id, quantity')
                .eq('order_id', payment.order_id);

            if (orderItems && orderItems.length > 0) {
                await Promise.all(orderItems.map(async (item) => {
                    const { data: product } = await supabase
                        .from('products')
                        .select('stock, reserved_stock')
                        .eq('id', item.product_id)
                        .single();

                    if (product) {
                        const newStock = Math.max(0, (product.stock || 0) - item.quantity);
                        const newReserved = Math.max(0, (product.reserved_stock || 0) - item.quantity);

                        await supabase
                            .from('products')
                            .update({ stock: newStock, reserved_stock: newReserved })
                            .eq('id', item.product_id);
                    }
                }));
                logger.info('Stock deducted for order:', { orderId: payment.order_id, items: orderItems.length });
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
