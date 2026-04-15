/**
 * Subscription Webhook (DEPRECATED — redirects to unified /api/payment/webhook)
 * 
 * This endpoint is kept for backward compatibility.
 * All new subscription callbacks should use /api/payment/webhook?type=subscription
 * 
 * This handler now uses the same verify-at-source pattern as the main webhook,
 * and delegates to the same activation logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const body = JSON.parse(rawBody);
        const invoice_id = body.invoice_id || body.object_id;

        logger.info('Subscription webhook received (deprecated endpoint)', { invoice_id });

        if (!invoice_id) {
            return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
        }

        // ── Verify with QPay API (verify-at-source, same as main webhook) ──
        const paymentCheck = await checkPaymentStatus(invoice_id);

        if (!isPaymentCompleted(paymentCheck)) {
            logger.warn('Subscription payment not completed yet:', { invoice_id });
            return NextResponse.json({ message: 'Payment not completed' });
        }

        const supabase = supabaseAdmin();

        // Try to find via invoices table first
        const { data: invoice } = await supabase
            .from('invoices')
            .select('id, shop_id, status')
            .eq('qpay_invoice_id', invoice_id)
            .single();

        if (!invoice) {
            // Try payments table as fallback
            const { data: payment } = await supabase
                .from('payments')
                .select('id, shop_id, status, subscription_plan_slug')
                .eq('qpay_invoice_id', invoice_id)
                .single();

            if (!payment) {
                logger.warn('No invoice or payment found for:', { invoice_id });
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }

            // Already processed?
            if (payment.status === 'paid') {
                return NextResponse.json({ message: 'Already processed' });
            }

            // Mark payment as paid
            await supabase
                .from('payments')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('id', payment.id);

            // Activate subscription via same logic
            await activateSubscriptionForShop(supabase, payment.shop_id, payment.subscription_plan_slug);

            return NextResponse.json({ message: 'Subscription activated', shop_id: payment.shop_id });
        }

        // Already processed?
        if (invoice.status === 'paid') {
            return NextResponse.json({ message: 'Already processed' });
        }

        // Update invoice status
        await supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', invoice.id);

        // Also mark any related payment as paid
        await supabase
            .from('payments')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('shop_id', invoice.shop_id)
            .eq('payment_type', 'subscription')
            .eq('status', 'pending');

        // Activate subscription
        await activateSubscriptionForShop(supabase, invoice.shop_id, null);

        logger.success('Subscription activated (deprecated webhook)', {
            shop_id: invoice.shop_id,
            invoice_id,
        });

        return NextResponse.json({
            message: 'Subscription activated successfully',
            shop_id: invoice.shop_id,
        });
    } catch (error: unknown) {
        logger.error('Subscription webhook error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Webhook processing failed' },
            { status: 500 }
        );
    }
}

/**
 * Shared subscription activation logic
 */
async function activateSubscriptionForShop(
    supabase: ReturnType<typeof supabaseAdmin>,
    shopId: string,
    planSlugOverride: string | null,
) {
    // Get existing subscription to find plan
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('billing_cycle, plan_id, plans(slug)')
        .eq('shop_id', shopId)
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
                current_period_end: periodEnd.toISOString(),
            })
            .eq('shop_id', shopId);

        // Update shop's plan
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planSlug = planSlugOverride || (subscription as any).plans?.slug || 'professional';
        await supabase
            .from('shops')
            .update({
                plan_id: subscription.plan_id,
                subscription_plan: planSlug,
                subscription_status: 'active',
            })
            .eq('id', shopId);
    }
}
