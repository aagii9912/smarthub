/**
 * Subscription Webhook
 * Handle QPay payment callbacks for subscriptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { invoice_id, payment_status } = body;

        logger.info('Subscription webhook received', { invoice_id, payment_status });

        if (!invoice_id) {
            return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Get invoice
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select('*, shops(id, name)')
            .eq('qpay_invoice_id', invoice_id)
            .single();

        if (invoiceError || !invoice) {
            logger.warn('Invoice not found', { invoice_id });
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Check if already processed
        if (invoice.status === 'paid') {
            return NextResponse.json({ message: 'Already processed' });
        }

        // Update invoice status
        await supabase
            .from('invoices')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString()
            })
            .eq('id', invoice.id);

        // Activate subscription
        const periodEnd = new Date();
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('billing_cycle, plan_id')
            .eq('shop_id', invoice.shop_id)
            .single();

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
                .eq('shop_id', invoice.shop_id);

            // Update shop's plan
            await supabase
                .from('shops')
                .update({ plan_id: subscription.plan_id })
                .eq('id', invoice.shop_id);
        }

        logger.success('Subscription activated', {
            shop: invoice.shops?.name,
            invoice_id
        });

        return NextResponse.json({
            message: 'Subscription activated successfully',
            shop_id: invoice.shop_id
        });
    } catch (error: any) {
        logger.error('Subscription webhook error:', error);
        return NextResponse.json(
            { error: error.message || 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
