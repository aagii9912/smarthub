import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/orders/[orderId]/recheck-payment
 *
 * Manual fallback when QPay webhook fails to deliver. Looks up the latest
 * pending QPay payment for the order, asks QPay if it's actually paid, and
 * if so, runs the canonical confirmOrderPayment flow (same as webhook /
 * cron / manual status check).
 *
 * Authorization: caller must own the shop the order belongs to.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId } = await params;
        const supabase = supabaseAdmin();

        // Verify the order belongs to this shop
        const { data: order } = await supabase
            .from('orders')
            .select('id, shop_id, payment_status, payment_method')
            .eq('id', orderId)
            .eq('shop_id', authShop.id)
            .single();

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.payment_status === 'paid') {
            return NextResponse.json({
                status: 'paid',
                message: 'Захиалга аль хэдийн төлөгдсөн байна.',
            });
        }

        // Find the latest pending QPay payment for this order
        const { data: payment } = await supabase
            .from('payments')
            .select('id, amount, qpay_invoice_id, payment_method')
            .eq('order_id', orderId)
            .eq('payment_method', 'qpay')
            .eq('status', 'pending')
            .not('qpay_invoice_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!payment || !payment.qpay_invoice_id) {
            return NextResponse.json({
                status: order.payment_status ?? 'pending',
                message: 'Энэ захиалгад QPay төлбөрийн бичлэг олдсонгүй.',
            });
        }

        const paymentCheck = await checkPaymentStatus(payment.qpay_invoice_id);

        if (!isPaymentCompleted(paymentCheck)) {
            return NextResponse.json({
                status: 'pending',
                message: 'QPay системд төлбөр хараахан бүртгэгдээгүй байна. Дараа дахин шалгана уу.',
            });
        }

        const transactionId = getTransactionId(paymentCheck);

        const { confirmOrderPayment } = await import('@/lib/services/PaymentConfirmationService');
        await confirmOrderPayment({
            paymentId: payment.id,
            orderId,
            transactionId,
            amount: Number(payment.amount),
            paymentMethod: 'qpay',
            confirmedVia: 'manual_check',
            paymentDetails: paymentCheck.rows?.[0] ?? null,
        });

        return NextResponse.json({
            status: 'paid',
            message: '✅ Төлбөр баталгаажлаа.',
            transaction_id: transactionId,
        });
    } catch (error) {
        logger.error('Recheck payment error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Recheck failed' }, { status: 500 });
    }
}
