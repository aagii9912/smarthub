import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createSubscriptionInvoice } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

// Subscription plan prices (MNT)
const PLAN_PRICES: Record<string, { price: number; name: string }> = {
    lite: { price: 89_000, name: 'Lite' },
    starter: { price: 149_000, name: 'Starter' },
    pro: { price: 349_000, name: 'Pro' },
    ultimate: { price: 999_000, name: 'Ultimate' },
};

/**
 * POST /api/subscription/pay
 * Create QPay invoice for subscription payment
 * 
 * Body: {
 *   plan_slug: "lite" | "starter" | "pro" | "ultimate"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { plan_slug } = body;

        // Validate plan
        const plan = PLAN_PRICES[plan_slug];
        if (!plan) {
            return NextResponse.json({
                error: 'Буруу план сонгосон байна',
                available_plans: Object.keys(PLAN_PRICES),
            }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Check for existing pending subscription payment
        const { data: existingPayment } = await supabase
            .from('payments')
            .select('id, qpay_invoice_id, expires_at, status')
            .eq('payment_type', 'subscription')
            .eq('subscription_user_id', userId)
            .eq('subscription_plan_slug', plan_slug)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (existingPayment) {
            // Return existing pending invoice
            return NextResponse.json({
                success: true,
                existing: true,
                payment_id: existingPayment.id,
                message: 'Өмнө үүсгэсэн нэхэмжлэл хүлээгдэж байна',
            });
        }

        // Create QPay invoice for subscription
        const callbackUrl = `${request.nextUrl.origin}/api/payment/webhook?type=subscription&user=${userId}&plan=${plan_slug}`;

        const invoice = await createSubscriptionInvoice({
            planSlug: plan_slug,
            amount: plan.price,
            userId,
            description: `Syncly ${plan.name} план - сарын эрх`,
            callbackUrl,
        });

        if (!invoice) {
            return NextResponse.json({
                error: 'QPay нэхэмжлэл үүсгэж чадсангүй. Дахин оролдоно уу.',
                code: 'QPAY_UNAVAILABLE',
            }, { status: 503 });
        }

        // Save payment record
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                payment_type: 'subscription',
                payment_method: 'qpay',
                amount: plan.price,
                status: 'pending',
                subscription_user_id: userId,
                subscription_plan_slug: plan_slug,
                qpay_invoice_id: invoice.invoice_id,
                qpay_qr_text: invoice.qr_text,
                qpay_qr_image: invoice.qr_image,
                metadata: {
                    urls: invoice.urls,
                    plan_name: plan.name,
                    plan_price: plan.price,
                },
                expires_at: invoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            })
            .select()
            .single();

        if (paymentError) {
            logger.error('Failed to save subscription payment record', { error: paymentError.message });
            throw new Error('Payment record creation failed');
        }

        logger.success('Subscription QPay invoice created:', {
            user_id: userId,
            plan: plan_slug,
            amount: plan.price,
            invoice_id: invoice.invoice_id,
        });

        return NextResponse.json({
            success: true,
            payment: {
                id: payment.id,
                plan: plan_slug,
                plan_name: plan.name,
                amount: plan.price,
                qr_text: invoice.qr_text,
                qr_image: invoice.qr_image,
                urls: invoice.urls,
                expires_at: payment.expires_at,
            },
        });

    } catch (error: unknown) {
        logger.error('Subscription payment error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Subscription payment failed',
        }, { status: 500 });
    }
}
