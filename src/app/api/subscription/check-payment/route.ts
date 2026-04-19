/**
 * Check Subscription Payment Status
 * Manually verify QPay payment and activate subscription if paid
 * 
 * Supports both invoice-based and payment-based lookups
 * to handle both subscribe and pay flows
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

        // ── Strategy 1: Look up by invoices table ──
        const invoiceQuery = supabase
            .from('invoices')
            .select('id, qpay_invoice_id, status, amount, description, shop_id')
            .eq('shop_id', shop.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (invoice_id) {
            invoiceQuery.eq('id', invoice_id);
        }

        const { data: invoice } = await invoiceQuery.limit(1).single();

        // ── Strategy 2: Fallback to payments table (for pay/ flow) ──
        let qpayInvoiceId: string | null = invoice?.qpay_invoice_id || null;
        let paymentRecordId: string | null = null;

        if (!qpayInvoiceId) {
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('id, qpay_invoice_id, status, amount')
                .eq('shop_id', shop.id)
                .eq('payment_type', 'subscription')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (paymentRecord?.qpay_invoice_id) {
                qpayInvoiceId = paymentRecord.qpay_invoice_id;
                paymentRecordId = paymentRecord.id;
            }
        }

        if (!qpayInvoiceId) {
            return NextResponse.json({
                status: 'no_pending',
                message: 'Хүлээгдэж буй нэхэмжлэх олдсонгүй'
            });
        }

        // Check QPay payment status
        const paymentCheck = await checkPaymentStatus(qpayInvoiceId);

        if (isPaymentCompleted(paymentCheck)) {
            // Payment confirmed! Activate subscription

            // 1. Update invoice (if exists)
            if (invoice) {
                await supabase
                    .from('invoices')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    })
                    .eq('id', invoice.id);
            }

            // 2. Update payment record (if exists)
            if (paymentRecordId) {
                await supabase
                    .from('payments')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                    })
                    .eq('id', paymentRecordId);
            }

            // 3. Activate subscription
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('billing_cycle, plan_id, plans(slug)')
                .eq('shop_id', shop.id)
                .single();

            const periodEnd = new Date();

            if (subscription) {
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

                // 4. Update shop's plan + subscription_plan + subscription_status
                const planSlug = (subscription as { plans?: { slug?: string } }).plans?.slug || 'professional';
                await supabase
                    .from('shops')
                    .update({
                        plan_id: subscription.plan_id,
                        subscription_plan: planSlug,
                        subscription_status: 'active'
                    })
                    .eq('id', shop.id);
            } else {
                // No subscription record exists — create one
                // Find the plan from the invoice description
                const planSlug = invoice?.description?.toLowerCase().includes('professional') ? 'professional'
                    : invoice?.description?.toLowerCase().includes('starter') ? 'starter'
                    : invoice?.description?.toLowerCase().includes('lite') ? 'lite'
                    : 'professional';

                const { data: plan } = await supabase
                    .from('plans')
                    .select('id, slug')
                    .eq('slug', planSlug)
                    .single();

                if (plan) {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);

                    await supabase
                        .from('subscriptions')
                        .upsert({
                            shop_id: shop.id,
                            plan_id: plan.id,
                            status: 'active',
                            billing_cycle: 'monthly',
                            current_period_start: new Date().toISOString(),
                            current_period_end: periodEnd.toISOString()
                        }, { onConflict: 'shop_id' });

                    await supabase
                        .from('shops')
                        .update({
                            plan_id: plan.id,
                            subscription_plan: plan.slug,
                            subscription_status: 'active'
                        })
                        .eq('id', shop.id);
                }
            }

            logger.success('Subscription payment verified and activated', {
                shop_id: shop.id,
                invoice_id: invoice?.id,
                payment_id: paymentRecordId,
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
