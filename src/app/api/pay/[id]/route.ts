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

    // Simple flat query - no joins to avoid Supabase 400 errors
    const { data: payment, error } = await supabase
        .from('payments')
        .select('id, amount, status, payment_method, qpay_invoice_id, qpay_qr_text, qpay_qr_image, metadata, expires_at, created_at, payment_type, subscription_plan_slug, order_id, shop_id')
        .eq('id', id)
        .single();

    if (error || !payment) {
        logger.error('Payment query failed:', { id, error: error?.message });
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

                // ── Audit log entry (pay page poll confirmation) ──
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
                            actor: 'pay_page_poll',
                            metadata: {
                                qpay_transaction_id: transactionId,
                                confirmed_via: 'pay_page_poll',
                            },
                        });
                } catch (auditErr) {
                    logger.warn('Audit log insert failed (non-critical):', { error: String(auditErr) });
                }

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

    // Get shop name via separate query
    let shopName = 'Syncly';
    if (payment.payment_type === 'subscription') {
        shopName = 'Syncly';
    } else if (payment.shop_id) {
        const { data: shop } = await supabase
            .from('shops')
            .select('name')
            .eq('id', payment.shop_id)
            .single();
        shopName = shop?.name || 'Shop';
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
        shopLogo: null,
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
