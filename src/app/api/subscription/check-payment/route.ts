/**
 * Check Subscription Payment Status
 * Manually verify QPay payment and activate subscription if paid
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { invoice_id } = body;

        const supabase = supabaseAdmin();

        // Find the latest pending invoice for this shop
        const query = supabase
            .from('invoices')
            .select('id, qpay_invoice_id, status, amount, description, shop_id')
            .eq('shop_id', shop.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (invoice_id) {
            query.eq('id', invoice_id);
        }

        const { data: invoice, error: invoiceError } = await query.limit(1).single();

        if (invoiceError || !invoice) {
            return NextResponse.json({ 
                status: 'no_pending',
                message: 'Хүлээгдэж буй нэхэмжлэх олдсонгүй' 
            });
        }

        if (!invoice.qpay_invoice_id) {
            return NextResponse.json({ 
                status: 'no_qpay',
                message: 'QPay нэхэмжлэх үүсээгүй байна' 
            });
        }

        // Check QPay payment status
        const paymentCheck = await checkPaymentStatus(invoice.qpay_invoice_id);
        
        if (isPaymentCompleted(paymentCheck)) {
            // Payment confirmed! Activate subscription
            
            // 1. Update invoice
            await supabase
                .from('invoices')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('id', invoice.id);

            // 2. Activate subscription
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('billing_cycle, plan_id')
                .eq('shop_id', shop.id)
                .single();

            if (subscription) {
                const periodEnd = new Date();
                periodEnd.setMonth(periodEnd.getMonth() + 
                    (subscription.billing_cycle === 'yearly' ? 12 : 1));

                await supabase
                    .from('subscriptions')
                    .update({
                        status: 'active',
                        current_period_start: new Date().toISOString(),
                        current_period_end: periodEnd.toISOString()
                    })
                    .eq('shop_id', shop.id);

                // 3. Update shop's plan
                await supabase
                    .from('shops')
                    .update({ plan_id: subscription.plan_id })
                    .eq('id', shop.id);
            }

            logger.success('Subscription payment verified and activated', {
                shop_id: shop.id,
                invoice_id: invoice.id,
            });

            return NextResponse.json({
                status: 'paid',
                message: 'Төлбөр амжилттай! Subscription идэвхжлээ 🎉'
            });
        }

        return NextResponse.json({
            status: 'pending',
            message: 'Төлбөр хүлээгдэж байна. QR код уншуулсны дараа дахин шалгана уу.'
        });

    } catch (error: unknown) {
        logger.error('Check payment error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: 'Төлбөр шалгахад алдаа гарлаа', status: 'error' },
            { status: 500 }
        );
    }
}
