import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/pay/[id]
 * Public endpoint - returns payment details for the landing page
 * No auth required (customer accesses via link from chat)
 * 
 * FIX: When status is pending, also checks QPay API to detect
 * payments that succeeded but webhook failed.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = supabaseAdmin();

    const { data: payment, error } = await supabase
        .from('payments')
        .select(`
            id,
            amount,
            status,
            payment_method,
            qpay_invoice_id,
            qpay_qr_text,
            qpay_qr_image,
            metadata,
            expires_at,
            created_at,
            payment_type,
            subscription_plan_slug,
            order_id,
            shop_id,
            orders(id, shops(name, logo_url)),
            shop_id
        `)
        .eq('id', id)
        .single();

    if (error || !payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // FIX: If pending QPay payment, check QPay API for missed webhooks
    let effectiveStatus = payment.status;

    if (payment.status === 'pending' && payment.payment_method === 'qpay' && payment.qpay_invoice_id) {
        try {
            const paymentCheck = await checkPaymentStatus(payment.qpay_invoice_id);

            if (isPaymentCompleted(paymentCheck)) {
                const transactionId = getTransactionId(paymentCheck);

                // Update payment to paid
                await supabase
                    .from('payments')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        qpay_transaction_id: transactionId,
                        metadata: {
                            ...(payment.metadata as Record<string, unknown> || {}),
                            payment_details: paymentCheck.rows?.[0] ?? null,
                            confirmed_via: 'pay_page_poll',
                        },
                    })
                    .eq('id', payment.id);

                // Update order status if applicable
                if (payment.order_id) {
                    await supabase
                        .from('orders')
                        .update({
                            status: 'paid',
                            payment_method: 'qpay',
                            paid_at: new Date().toISOString(),
                        })
                        .eq('id', payment.order_id);

                    // Stock deduction
                    try {
                        const { deductStockForOrder } = await import('@/lib/services/StockService');
                        await deductStockForOrder(payment.order_id);
                    } catch (stockErr) {
                        logger.error('Stock deduction failed (pay page):', { error: String(stockErr) });
                    }
                }

                effectiveStatus = 'paid';
                logger.success('Payment confirmed via pay page poll:', {
                    payment_id: payment.id,
                    order_id: payment.order_id,
                });
            }
        } catch (checkErr) {
            // QPay check failed — just show current DB status
            logger.warn('QPay check failed on pay page:', { error: String(checkErr) });
        }
    }

    // Check if expired
    const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();

    // Get shop info
    let shopName = 'Syncly';
    let shopLogo = null;
    if (payment.payment_type === 'subscription') {
        shopName = 'Syncly';
    } else if (payment.orders) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = payment.orders as any;
        const shop = order?.shops;
        shopName = (shop?.name as string) || 'Shop';
        shopLogo = shop?.logo_url || null;
    }

    // Extract bank deeplinks from metadata
    const urls = (payment.metadata as Record<string, unknown>)?.urls as Array<{
        name: string;
        description: string;
        logo: string;
        link: string;
    }> || [];

    return NextResponse.json({
        id: payment.id,
        amount: payment.amount,
        status: isExpired && effectiveStatus === 'pending' ? 'expired' : effectiveStatus,
        shopName,
        shopLogo,
        paymentType: payment.payment_type,
        planSlug: payment.subscription_plan_slug,
        banks: urls.map(u => ({
            name: u.name,
            description: u.description,
            logo: u.logo,
            link: u.link,
        })),
        qrImage: payment.qpay_qr_image,
        expiresAt: payment.expires_at,
        createdAt: payment.created_at,
    });
}
