/**
 * Check Subscription Payment Status
 * Manually verify QPay payment and activate subscription if paid
 *
 * Supports both invoice-based and payment-based lookups
 * to handle both subscribe and pay flows.
 *
 * Request body:
 *   - invoice_id?: string  — restrict lookup to a specific invoice
 *   - force?: boolean      — bypass idempotency early-return and re-run the
 *                            full activation chain. Used by the wizard's
 *                            verify-then-navigate fail-safe path when the shop
 *                            row was not updated by an earlier call (e.g.
 *                            webhook silent failure).
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
        const { invoice_id, force } = body as { invoice_id?: string; force?: boolean };

        const supabase = supabaseAdmin();

        // ── Strategy 1: Look up by invoices table ──
        // When force=true we also accept already-paid invoices, since the goal
        // is to re-attempt a previously-incomplete activation.
        const invoiceQuery = supabase
            .from('invoices')
            .select('id, qpay_invoice_id, status, amount, description, shop_id')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false });

        if (!force) {
            invoiceQuery.eq('status', 'pending');
        }

        if (invoice_id) {
            invoiceQuery.eq('id', invoice_id);
        }

        const { data: invoice } = await invoiceQuery.limit(1).maybeSingle();

        // ── Strategy 2: Fallback to payments table (for pay/ flow) ──
        let qpayInvoiceId: string | null = invoice?.qpay_invoice_id || null;
        let paymentRecordId: string | null = null;
        let paymentPlanSlug: string | null = null;

        if (!qpayInvoiceId) {
            const paymentQuery = supabase
                .from('payments')
                .select('id, qpay_invoice_id, status, amount, subscription_plan_slug')
                .eq('shop_id', shop.id)
                .eq('payment_type', 'subscription')
                .order('created_at', { ascending: false });

            if (!force) {
                paymentQuery.eq('status', 'pending');
            }

            const { data: paymentRecord } = await paymentQuery.limit(1).maybeSingle();

            if (paymentRecord?.qpay_invoice_id) {
                qpayInvoiceId = paymentRecord.qpay_invoice_id;
                paymentRecordId = paymentRecord.id;
                paymentPlanSlug = paymentRecord.subscription_plan_slug ?? null;
            }
        } else if (paymentRecordId === null) {
            // Have an invoice; pull the corresponding payment row to grab its
            // plan slug for the resolution chain.
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('id, subscription_plan_slug')
                .eq('shop_id', shop.id)
                .eq('qpay_invoice_id', qpayInvoiceId)
                .eq('payment_type', 'subscription')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (paymentRecord) {
                paymentRecordId = paymentRecord.id;
                paymentPlanSlug = paymentRecord.subscription_plan_slug ?? null;
            }
        }

        if (!qpayInvoiceId) {
            return NextResponse.json({
                status: 'no_pending',
                message: 'Хүлээгдэж буй нэхэмжлэх олдсонгүй'
            });
        }

        // ── Idempotency Guard ──
        // Only return 'paid' early when BOTH (a) the invoice is already marked
        // paid AND (b) the shop row already shows subscription_status='active'.
        // If only (a) holds, an earlier call (webhook or previous poll) updated
        // the invoice but failed to update the shop — fall through and re-run
        // the activation chain so we recover from the silent failure.
        if (!force) {
            const { data: existingPaid } = await supabase
                .from('invoices')
                .select('id, status')
                .eq('qpay_invoice_id', qpayInvoiceId)
                .eq('status', 'paid')
                .limit(1)
                .maybeSingle();

            if (existingPaid) {
                const { data: shopRow } = await supabase
                    .from('shops')
                    .select('subscription_status')
                    .eq('id', shop.id)
                    .maybeSingle();

                if (shopRow?.subscription_status === 'active') {
                    logger.info('Payment already processed (idempotency guard)', {
                        invoice_id: existingPaid.id,
                        qpay_invoice_id: qpayInvoiceId,
                        shop_id: shop.id,
                    });
                    return NextResponse.json({
                        status: 'paid',
                        message: 'Төлбөр амжилттай! Subscription идэвхжлээ 🎉'
                    });
                }

                logger.warn('Invoice paid but shop not active — re-running activation', {
                    invoice_id: existingPaid.id,
                    qpay_invoice_id: qpayInvoiceId,
                    shop_id: shop.id,
                    shop_status: shopRow?.subscription_status ?? null,
                });
            }
        }

        // Check QPay payment status (verify-at-source)
        const paymentCheck = await checkPaymentStatus(qpayInvoiceId);

        if (isPaymentCompleted(paymentCheck)) {
            // Payment confirmed! Activate subscription atomically.

            // 1. Update invoice (if exists)
            if (invoice && invoice.status !== 'paid') {
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
                    .eq('id', paymentRecordId)
                    .neq('status', 'paid');
            }

            // 3. Look up existing subscription (if any) for billing cycle + plan
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('billing_cycle, plan_id, plans(slug)')
                .eq('shop_id', shop.id)
                .maybeSingle();

            // 4. Resolve the plan slug in priority order:
            //    a) subscriptions.plans.slug (existing record)
            //    b) payments.subscription_plan_slug (set by /subscribe)
            //    c) invoice.description substring match (legacy fallback)
            const subscriptionPlanSlug =
                (subscription as { plans?: { slug?: string } } | null)?.plans?.slug ?? null;

            let resolvedSlug: string | null = subscriptionPlanSlug || paymentPlanSlug;

            if (!resolvedSlug && invoice?.description) {
                const desc = invoice.description.toLowerCase();
                const candidates = ['professional', 'enterprise', 'starter', 'pro', 'lite'];
                resolvedSlug = candidates.find((slug) => desc.includes(slug)) ?? null;
            }

            if (!resolvedSlug) {
                logger.error('Cannot resolve plan slug for activation', {
                    shop_id: shop.id,
                    qpay_invoice_id: qpayInvoiceId,
                    invoice_id: invoice?.id,
                    payment_id: paymentRecordId,
                });
                return NextResponse.json(
                    {
                        status: 'activation_failed',
                        message: 'План тодорхойлох боломжгүй боллоо. Дэмжлэгийн багт хандана уу.',
                    },
                    { status: 500 }
                );
            }

            // 5. Resolve plan UUID from the slug
            const { data: plan, error: planError } = await supabase
                .from('plans')
                .select('id, slug')
                .eq('slug', resolvedSlug)
                .maybeSingle();

            if (planError || !plan) {
                logger.error('Plan not found for resolved slug', {
                    shop_id: shop.id,
                    resolved_slug: resolvedSlug,
                    error: planError?.message,
                });
                return NextResponse.json(
                    {
                        status: 'activation_failed',
                        message: 'План тодорхойлох боломжгүй боллоо. Дэмжлэгийн багт хандана уу.',
                    },
                    { status: 500 }
                );
            }

            // 6. Compute period end based on billing cycle (default monthly)
            const billingCycle = subscription?.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
            const periodStart = new Date();
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

            // 7. Upsert subscription as active
            const { error: subError } = await supabase
                .from('subscriptions')
                .upsert(
                    {
                        shop_id: shop.id,
                        plan_id: plan.id,
                        status: 'active',
                        billing_cycle: billingCycle,
                        current_period_start: periodStart.toISOString(),
                        current_period_end: periodEnd.toISOString(),
                    },
                    { onConflict: 'shop_id' }
                );

            if (subError) {
                logger.error('Failed to upsert subscription during activation', {
                    shop_id: shop.id,
                    error: subError.message,
                });
                return NextResponse.json(
                    {
                        status: 'activation_failed',
                        message: 'Subscription идэвхжүүлэхэд алдаа гарлаа',
                    },
                    { status: 500 }
                );
            }

            // 8. Update shops row — this is the critical write that flips the
            //    user out of trial. Verify rows-affected and surface failures.
            const { data: shopUpdateRows, error: shopUpdateError } = await supabase
                .from('shops')
                .update({
                    plan_id: plan.id,
                    subscription_plan: plan.slug,
                    subscription_status: 'active',
                    setup_completed: true,
                })
                .eq('id', shop.id)
                .select('id');

            if (shopUpdateError || !shopUpdateRows || shopUpdateRows.length === 0) {
                logger.error('Failed to update shop during activation', {
                    shop_id: shop.id,
                    error: shopUpdateError?.message,
                    rows_affected: shopUpdateRows?.length ?? 0,
                });
                return NextResponse.json(
                    {
                        status: 'activation_failed',
                        message: 'Дэлгүүрийн төлөв шинэчлэхэд алдаа гарлаа',
                    },
                    { status: 500 }
                );
            }

            logger.success('Subscription payment verified and activated', {
                shop_id: shop.id,
                invoice_id: invoice?.id,
                payment_id: paymentRecordId,
                plan_slug: plan.slug,
                forced: !!force,
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
