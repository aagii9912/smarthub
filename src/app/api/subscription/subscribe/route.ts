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
import { getAuthUserShop, getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createSubscriptionInvoice } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();

        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getAuthUser();

        const body = await request.json();
        const { plan_id, billing_cycle = 'monthly' } = body;

        if (!plan_id) {
            return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

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

        // Free plans are not available — all users must pay
        if (amount === 0) {
            return NextResponse.json({
                error: 'Үнэгүй план байхгүй байна. Төлбөртэй план сонгоно уу.',
            }, { status: 400 });
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

            const qpayResult = await createSubscriptionInvoice({
                planSlug: plan.slug,  // FIX: was plan.name → now plan.slug
                amount,
                userId: userId || shop.id,
                description: `Syncly ${plan.name} Plan`,
                callbackUrl,  // FIX: now points to /api/payment/webhook
            });

            if (!qpayResult) {
                return NextResponse.json({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    amount,
                    message: 'QPay одоогоор түр ажиллахгүй байна. Дараа дахин оролдоно уу.',
                    payment_required: true,
                    qpay_error: true
                });
            }

            // Update invoice with QPay info
            await supabase
                .from('invoices')
                .update({
                    qpay_invoice_id: qpayResult.invoice_id,
                    qpay_qr_code: qpayResult.qr_image,
                    qpay_urls: qpayResult.urls
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
                    qpay_invoice_id: qpayResult.invoice_id,
                    qpay_qr_text: qpayResult.qr_text,
                    qpay_qr_image: qpayResult.qr_image,
                    metadata: {
                        urls: qpayResult.urls,
                        plan_name: plan.name,
                        plan_price: amount,
                        invoice_id: invoice.id,
                        billing_cycle,
                    },
                    expires_at: qpayResult.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                });

            // Store pending subscription info
            await supabase
                .from('subscriptions')
                .upsert({
                    shop_id: shop.id,
                    plan_id: plan.id,
                    status: 'pending',
                    billing_cycle
                }, {
                    onConflict: 'shop_id'
                });

            return NextResponse.json({
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                amount,
                qr_code: qpayResult.qr_image,
                urls: qpayResult.urls,
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
        logger.error('Subscribe error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to subscribe' },
            { status: 500 }
        );
    }
}
