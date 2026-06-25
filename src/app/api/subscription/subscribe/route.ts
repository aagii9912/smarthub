/**
 * Subscribe API
 * Handle subscription creation with QPay payment
 * 
 * Unified subscription flow:
 * 1. Free plan → direct activation (no payment needed)
 * 2. Paid plan → create QPay invoice + payments record + pending subscription
 *    → QPay webhook → /api/payment/webhook activates subscription
 *    → Manual check → /api/subscription/check-payment also works as fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { createSubscriptionInvoiceDetailed } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/constants/legal';
import { upsertUserSubscription } from '@/lib/billing/subscriptionUpsert';

interface SubscribeConsent {
    terms_accepted?: boolean;
    privacy_accepted?: boolean;
    age_confirmed?: boolean;
    marketing_consent?: boolean;
    terms_version?: string;
    privacy_version?: string;
}

export async function POST(request: NextRequest) {
    try {
        // RBAC: захиалгын багц/төлбөр зөвхөн дэлгүүрийн эзэнд.
        const { shop, userId } = await requirePermission('billing:manage');

        const body = await request.json();
        const { plan_id, billing_cycle = 'monthly', consent } = body as {
            plan_id?: string;
            billing_cycle?: 'monthly' | 'yearly';
            consent?: SubscribeConsent;
        };

        if (!plan_id) {
            return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Look up the shop's existing consent state. getAuthUserShop projects
        // a small set of columns and doesn't include consent fields.
        const { data: consentRow } = await supabase
            .from('shops')
            .select('terms_accepted_at')
            .eq('id', shop.id)
            .single();
        const alreadyConsented = !!consentRow?.terms_accepted_at;

        // Require consent on first subscription. Once recorded on the shop,
        // subsequent subscribe calls (re-subscribe / plan change) skip this gate.
        if (!alreadyConsented) {
            if (!consent?.terms_accepted || !consent?.privacy_accepted || !consent?.age_confirmed) {
                return NextResponse.json(
                    { error: 'Үйлчилгээний нөхцөл, Нууцлалын бодлого болон насны баталгааг хүлээн зөвшөөрнө үү' },
                    { status: 400 }
                );
            }
        }

        // Persist consent on the shop on first acceptance. Marketing consent
        // is allowed to change later, so it's updated even after legal consent
        // is already recorded.
        const now = new Date().toISOString();
        if (!alreadyConsented && consent) {
            await supabase.from('shops').update({
                terms_accepted_at: now,
                terms_version: consent.terms_version || TERMS_VERSION,
                privacy_accepted_at: now,
                privacy_version: consent.privacy_version || PRIVACY_VERSION,
                age_confirmed: true,
                marketing_consent: !!consent.marketing_consent,
                marketing_consent_at: consent.marketing_consent ? now : null,
            }).eq('id', shop.id);
        } else if (consent && typeof consent.marketing_consent === 'boolean') {
            await supabase.from('shops').update({
                marketing_consent: consent.marketing_consent,
                marketing_consent_at: consent.marketing_consent ? now : null,
            }).eq('id', shop.id);
        }

        // Get the plan - support both UUID and slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(plan_id);
        const { data: plan, error: planError } = await supabase
            .from('plans')
            .select('id, name, slug, price_monthly, price_yearly, features, is_active')
            .eq(isUUID ? 'id' : 'slug', plan_id)
            .eq('is_active', true)
            .single();

        if (planError || !plan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        // Calculate amount
        const amount = billing_cycle === 'yearly' && plan.price_yearly
            ? plan.price_yearly
            : plan.price_monthly;

        // Free plan (e.g. Lite freemium) → instant activation, no payment.
        // Mirrors the paid activation in /api/subscription/check-payment but
        // skips the QPay invoice entirely since there is nothing to charge.
        if (amount === 0) {
            const periodStart = new Date();
            const periodEnd = new Date(periodStart);
            periodEnd.setMonth(periodEnd.getMonth() + (billing_cycle === 'yearly' ? 12 : 1));

            // Upsert subscription as active (keyed by user_id — subscriptions
            // has only a PARTIAL unique index, so .upsert(onConflict) is unusable).
            if (userId) {
                const { error: freeSubError } = await upsertUserSubscription(supabase, {
                    user_id: userId,
                    shop_id: shop.id,
                    plan_id: plan.id,
                    status: 'active',
                    billing_cycle,
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    period_anchor_at: periodStart.toISOString(),
                    tokens_used_in_period: 0,
                });

                if (freeSubError) {
                    logger.error('Failed to activate free subscription', {
                        shop_id: shop.id,
                        error: freeSubError.message,
                    });
                    return NextResponse.json(
                        { error: 'Үнэгүй план идэвхжүүлэхэд алдаа гарлаа. Дахин оролдоно уу.' },
                        { status: 500 }
                    );
                }

                // Mirror onto the user_profiles snapshot (middleware paywall reads this).
                await supabase
                    .from('user_profiles')
                    .update({
                        plan_id: plan.id,
                        subscription_plan: plan.slug,
                        subscription_status: 'active',
                    })
                    .eq('id', userId);
            }

            // Mirror onto every shop the user owns so per-shop reads see the
            // active free plan immediately. Clear trial markers and complete
            // setup, matching the paid-activation write.
            await supabase
                .from('shops')
                .update({
                    plan_id: plan.id,
                    subscription_plan: plan.slug,
                    subscription_status: 'active',
                    setup_completed: true,
                })
                .eq('user_id', userId || shop.id);

            logger.success('Free subscription activated', {
                shop_id: shop.id,
                user_id: userId,
                plan_slug: plan.slug,
            });

            return NextResponse.json({
                plan_slug: plan.slug,
                plan_name: plan.name,
                amount: 0,
                free: true,
                payment_required: false,
                message: `${plan.name} план үнэгүй идэвхжлээ 🎉`,
            });
        }

        // Create invoice for paid plan (billing history)
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                shop_id: shop.id,
                amount,
                description: `${plan.name} - ${billing_cycle === 'yearly' ? 'Жилийн' : 'Сарын'} захиалга`
            })
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // Create QPay invoice
        try {
            // FIX: Use plan.slug (not plan.name) and correct callback URL
            const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn'}/api/payment/webhook?type=subscription`;

            const qpayResult = await createSubscriptionInvoiceDetailed({
                planSlug: plan.slug,  // FIX: was plan.name → now plan.slug
                amount,
                userId: userId || shop.id,
                description: `Syncly ${plan.name} Plan`,
                callbackUrl,  // FIX: now points to /api/payment/webhook
            });

            if (!qpayResult.success) {
                return NextResponse.json({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    amount,
                    message: 'QPay одоогоор түр ажиллахгүй байна. Дараа дахин оролдоно уу.',
                    payment_required: true,
                    qpay_error: true,
                    qpay_error_code: qpayResult.code,
                    qpay_error_detail: qpayResult.detail,
                });
            }

            const qpayInvoice = qpayResult.invoice;

            // Update invoice with QPay info
            await supabase
                .from('invoices')
                .update({
                    qpay_invoice_id: qpayInvoice.invoice_id,
                    qpay_qr_code: qpayInvoice.qr_image,
                    qpay_urls: qpayInvoice.urls
                })
                .eq('id', invoice.id);

            // FIX: Also create a PAYMENTS record so webhook handler can find it
            // This is the critical missing piece — webhook looks up by qpay_invoice_id in payments table
            await supabase
                .from('payments')
                .insert({
                    shop_id: shop.id,
                    payment_type: 'subscription',
                    payment_method: 'qpay',
                    amount,
                    status: 'pending',
                    subscription_user_id: userId || shop.id,
                    subscription_plan_slug: plan.slug,
                    qpay_invoice_id: qpayInvoice.invoice_id,
                    qpay_qr_text: qpayInvoice.qr_text,
                    qpay_qr_image: qpayInvoice.qr_image,
                    metadata: {
                        urls: qpayInvoice.urls,
                        plan_name: plan.name,
                        plan_price: amount,
                        invoice_id: invoice.id,
                        billing_cycle,
                    },
                    expires_at: qpayInvoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                });

            // Store pending subscription info — keyed by user (per-user plan model).
            // subscriptions has only a PARTIAL unique index, so .upsert(onConflict)
            // always errors — upsertUserSubscription does manual select-then-write.
            // preserveActive: an existing live plan must not be downgraded to
            // 'pending' by a payment the user may abandon.
            if (userId) {
                const { error: subUpsertError } = await upsertUserSubscription(
                    supabase,
                    {
                        user_id: userId,
                        shop_id: shop.id,
                        plan_id: plan.id,
                        status: 'pending',
                        billing_cycle,
                    },
                    { preserveActive: true }
                );

                if (subUpsertError) {
                    logger.warn('Failed to store pending subscription (non-fatal)', {
                        err: subUpsertError.message,
                    });
                }
            }

            return NextResponse.json({
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                amount,
                qr_code: qpayInvoice.qr_image,
                urls: qpayInvoice.urls,
                message: 'QR кодоор төлбөрөө төлнө үү',
                payment_required: true
            });
        } catch (qpayError: unknown) {
            logger.error('QPay error:', { error: qpayError });

            // Return invoice without QPay for manual payment
            return NextResponse.json({
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                amount,
                message: 'Төлбөрийн систем түр ажиллахгүй байна. Дараа дахин оролдоно уу.',
                payment_required: true,
                qpay_error: true
            });
        }
    } catch (error: unknown) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        logger.error('Subscribe error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to subscribe' },
            { status: 500 }
        );
    }
}
