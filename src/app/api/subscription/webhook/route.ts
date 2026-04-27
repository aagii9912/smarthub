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
            const activation = await activateSubscriptionForShop(supabase, payment.shop_id, payment.subscription_plan_slug);
            if (!activation.ok) {
                return NextResponse.json(
                    { error: 'Subscription activation failed', reason: activation.reason },
                    { status: 500 }
                );
            }

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
        const activation = await activateSubscriptionForShop(supabase, invoice.shop_id, null);
        if (!activation.ok) {
            return NextResponse.json(
                { error: 'Subscription activation failed', reason: activation.reason },
                { status: 500 }
            );
        }

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

type ActivationResult = { ok: true } | { ok: false; reason: string };

/**
 * Shared subscription activation logic
 */
async function activateSubscriptionForShop(
    supabase: ReturnType<typeof supabaseAdmin>,
    shopId: string,
    planSlugOverride: string | null,
): Promise<ActivationResult> {
    // Get existing subscription to find plan
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('billing_cycle, plan_id, plans(slug)')
        .eq('shop_id', shopId)
        .maybeSingle();

    if (!subscription) {
        logger.error('No subscription record found for shop during deprecated webhook activation', {
            shop_id: shopId,
        });
        return { ok: false, reason: 'subscription_not_found' };
    }

    const periodEnd = new Date();
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

    // Update shop's plan — retry once on failure (mirrors /api/payment/webhook)
    const planSlug = planSlugOverride || (subscription as { plans?: { slug?: string } }).plans?.slug || 'professional';
    const shopUpdatePayload = {
        plan_id: subscription.plan_id,
        subscription_plan: planSlug,
        subscription_status: 'active',
    };

    let shopUpdateOk = false;
    let lastShopUpdateError: string | undefined;

    for (let attempt = 1; attempt <= 2; attempt++) {
        const { data: rows, error: shopUpdateError } = await supabase
            .from('shops')
            .update(shopUpdatePayload)
            .eq('id', shopId)
            .select('id');

        if (!shopUpdateError && rows && rows.length > 0) {
            shopUpdateOk = true;
            break;
        }

        lastShopUpdateError = shopUpdateError?.message ?? `rows_affected=${rows?.length ?? 0}`;
        logger.warn('Shop update attempt failed (deprecated webhook), will retry', {
            attempt,
            shop_id: shopId,
            error: lastShopUpdateError,
        });

        if (attempt === 1) {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    if (!shopUpdateOk) {
        logger.error('Failed to update shop plan after retry (deprecated webhook):', {
            shop_id: shopId,
            error: lastShopUpdateError,
        });
        return { ok: false, reason: 'shop_update_failed' };
    }

    return { ok: true };
}
