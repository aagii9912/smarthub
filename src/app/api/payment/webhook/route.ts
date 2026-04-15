import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

/**
 * Verify QPay webhook signature
 * Uses verify-at-source pattern: always calls QPay API to confirm payment
 * HMAC signature is a secondary check when configured
 */
function verifyWebhookSignature(body: string, signature: string | null): boolean {
    const secret = process.env.QPAY_WEBHOOK_SECRET;
    if (!secret || secret === 'your_qpay_webhook_secret_here') {
        // In Quick Pay v2, QPay may not send HMAC signatures
        // Use verify-at-source pattern instead (checkPaymentStatus)
        logger.warn('QPAY_WEBHOOK_SECRET not configured — using verify-at-source');
        return true;
    }
    if (!signature) return true; // Quick Pay v2 may not include signature

    try {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');

        if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) {
            return false;
        }

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch {
        return false;
    }
}

/**
 * POST /api/payment/webhook
 * Handle QPay payment webhook callbacks
 * 
 * Supports two payment types via query params:
 * - ?type=subscription  → Subscription activation
 * - ?type=order         → Order payment confirmation
 * 
 * Security: Always verify with QPay API (verify-at-source pattern)
 */
export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-qpay-signature');

        if (!verifyWebhookSignature(rawBody, signature)) {
            logger.warn('Invalid webhook signature received');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const body = JSON.parse(rawBody);
        const { searchParams } = new URL(request.url);
        const paymentType = searchParams.get('type') || 'order';

        logger.info('QPay webhook received:', { type: paymentType, data: body });

        // Extract invoice ID
        const invoiceId = body.invoice_id || body.object_id;

        if (!invoiceId) {
            logger.warn('Webhook missing invoice_id');
            return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Find payment by invoice ID
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('id, shop_id, status, amount, metadata, order_id, payment_method, payment_type, subscription_user_id, subscription_plan_slug')
            .eq('qpay_invoice_id', invoiceId)
            .single();

        if (paymentError || !payment) {
            logger.warn('Payment not found for invoice:', { invoiceId });
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Idempotency check
        if (payment.status === 'paid') {
            logger.info('Payment already processed:', { payment_id: payment.id });
            return NextResponse.json({ message: 'Already processed' });
        }

        // ──── VERIFY WITH QPAY API (verify-at-source) ────
        const paymentCheck = await checkPaymentStatus(invoiceId);

        if (!isPaymentCompleted(paymentCheck)) {
            logger.warn('Payment not completed yet:', { invoiceId });
            return NextResponse.json({ message: 'Payment not completed' }, { status: 200 });
        }

        const transactionId = getTransactionId(paymentCheck);

        // Update payment status to paid
        const { error: updateError } = await supabase
            .from('payments')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                qpay_transaction_id: transactionId,
                metadata: {
                    ...(payment.metadata as Record<string, unknown> || {}),
                    payment_details: paymentCheck.rows?.[0] ?? null,
                },
            })
            .eq('id', payment.id);

        if (updateError) {
            logger.error('Failed to update payment', { error: updateError.message });
            throw new Error('Failed to update payment');
        }

        // ──── ROUTE BY PAYMENT TYPE ────
        const effectiveType = payment.payment_type || paymentType;

        if (effectiveType === 'subscription') {
            await handleSubscriptionPayment(supabase, payment);
        } else {
            await handleOrderPayment(supabase, payment, transactionId);
        }

        return NextResponse.json({ success: true, message: 'Payment confirmed' });

    } catch (error: unknown) {
        logger.error('Webhook processing error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

// ──────────────────────────────────────────────
// Subscription Payment Handler (REWRITTEN)
// ──────────────────────────────────────────────

async function handleSubscriptionPayment(
    supabase: ReturnType<typeof supabaseAdmin>,
    payment: Record<string, unknown>
) {
    const userId = payment.subscription_user_id as string;
    const planSlug = payment.subscription_plan_slug as string;
    const shopId = payment.shop_id as string;

    if (!planSlug) {
        logger.error('Subscription payment missing plan_slug', { payment_id: payment.id });
        return;
    }

    // ── Step 1: Look up the plan from database ──
    const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, slug, name')
        .eq('slug', planSlug)
        .single();

    if (planError || !plan) {
        logger.error('Plan not found for slug:', { planSlug, error: planError?.message });
        return;
    }

    // ── Step 2: Resolve shop_id ──
    // Priority: use shop_id from payment record, else look up by user_id
    let resolvedShopId = shopId;

    if (!resolvedShopId && userId) {
        const { data: shop } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .single();

        if (shop) {
            resolvedShopId = shop.id;
        }
    }

    if (!resolvedShopId) {
        logger.error('Cannot resolve shop for subscription payment', {
            payment_id: payment.id,
            userId,
            shopId,
        });
        return;
    }

    // ── Step 3: Get billing cycle from existing subscription or metadata ──
    const metadata = payment.metadata as Record<string, unknown> || {};
    let billingCycle = (metadata.billing_cycle as string) || 'monthly';

    const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('billing_cycle')
        .eq('shop_id', resolvedShopId)
        .single();

    if (existingSub?.billing_cycle) {
        billingCycle = existingSub.billing_cycle;
    }

    // ── Step 4: Calculate subscription period ──
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    // ── Step 5: Upsert subscription with SHOP_ID ──
    const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
            shop_id: resolvedShopId,
            plan_id: plan.id,
            status: 'active',
            billing_cycle: billingCycle,
            current_period_start: startDate.toISOString(),
            current_period_end: endDate.toISOString(),
        }, {
            onConflict: 'shop_id',
        });

    if (subError) {
        logger.error('Failed to activate subscription:', { error: subError.message });
        return;
    }

    // ── Step 6: Update SHOPS table (plan_id + subscription_plan + subscription_status) ──
    const { error: shopUpdateError } = await supabase
        .from('shops')
        .update({
            plan_id: plan.id,
            subscription_plan: plan.slug,
            subscription_status: 'active',
        })
        .eq('id', resolvedShopId);

    if (shopUpdateError) {
        logger.error('Failed to update shop plan:', { error: shopUpdateError.message });
        // Non-fatal — subscription was activated, shop update can be retried
    }

    // ── Step 7: Also mark any related invoice as paid ──
    const invoiceId = metadata.invoice_id as string;
    if (invoiceId) {
        await supabase
            .from('invoices')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);
    }

    logger.success('Subscription activated via QPay:', {
        shop_id: resolvedShopId,
        plan: plan.slug,
        plan_name: plan.name,
        valid_until: endDate.toISOString(),
    });
}

// ──────────────────────────────────────────────
// Order Payment Handler (FIXED: adds order status update)
// ──────────────────────────────────────────────

async function handleOrderPayment(
    supabase: ReturnType<typeof supabaseAdmin>,
    payment: Record<string, unknown>,
    transactionId: string | null
) {
    const orderId = payment.order_id as string;

    if (!orderId) {
        logger.warn('Order payment missing order_id');
        return;
    }

    // FIX: Update order status to 'paid'
    const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
            status: 'paid',
            payment_method: 'qpay',
            paid_at: new Date().toISOString(),
        })
        .eq('id', orderId);

    if (orderUpdateError) {
        logger.error('Failed to update order status:', { error: orderUpdateError.message });
        // Non-fatal — continue with stock and email
    }

    // Deduct stock
    try {
        const { deductStockForOrder } = await import('@/lib/services/StockService');
        await deductStockForOrder(orderId);
    } catch (stockErr: unknown) {
        logger.error('Stock deduction failed (non-critical):', { error: stockErr instanceof Error ? stockErr.message : String(stockErr) });
    }

    // ── Audit log entry (webhook confirmation) ──
    try {
        await supabase
            .from('payment_audit_logs')
            .insert({
                payment_id: payment.id as string,
                shop_id: payment.shop_id as string,
                order_id: orderId,
                action: 'paid',
                old_status: 'pending',
                new_status: 'paid',
                amount: Number(payment.amount),
                payment_method: payment.payment_method as string,
                actor: 'webhook',
                metadata: {
                    qpay_transaction_id: transactionId,
                    confirmed_via: 'qpay_webhook',
                },
            });
    } catch (auditErr) {
        logger.warn('Audit log insert failed (non-critical):', { error: String(auditErr) });
    }

    logger.success('Order payment confirmed:', {
        payment_id: payment.id,
        order_id: orderId,
        transaction_id: transactionId,
    });

    // Send confirmation email
    try {
        const { data: orderData } = await supabase
            .from('orders')
            .select('*, customers(name, email), shops(name)')
            .eq('id', orderId)
            .single();

        if (orderData?.customers?.email) {
            const { sendPaymentConfirmationEmail } = await import('@/lib/email/email');

            await sendPaymentConfirmationEmail({
                customerEmail: orderData.customers.email,
                customerName: orderData.customers.name,
                orderId: orderData.id,
                amount: Number(payment.amount),
                paymentMethod: payment.payment_method as string,
                shopName: orderData.shops.name,
                invoiceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/invoice/${orderData.id}`,
            });

            logger.success('Payment confirmation email sent');
        }
    } catch (emailError: unknown) {
        logger.error('Failed to send email (non-critical)', {
            error: emailError instanceof Error ? emailError.message : String(emailError),
        });
    }
}

/**
 * GET /api/payment/webhook
 * Verify webhook endpoint (for QPay setup verification)
 */
export async function GET() {
    return NextResponse.json({
        message: 'QPay webhook endpoint',
        status: 'active',
        version: 'v2-quickpay',
    });
}
