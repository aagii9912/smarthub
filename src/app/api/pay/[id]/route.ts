import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPaymentStatus, isPaymentCompleted, getTransactionId } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/pay/[id]
 * Public endpoint - returns payment details for the landing page
 * No auth required (customer accesses via link from chat)
 * 
 * FIX: When status is pending, also checks QPay API to detect
 * payments that succeeded but webhook failed.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = supabaseAdmin();

    // Simple flat query - no joins to avoid Supabase 400 errors
    const { data: payment, error } = await supabase
        .from('payments')
        .select('id, amount, status, payment_method, qpay_invoice_id, qpay_qr_text, qpay_qr_image, metadata, expires_at, created_at, payment_type, subscription_plan_slug, order_id, shop_id')
        .eq('id', id)
        .single();

    if (error || !payment) {
        logger.error('Payment query failed:', { id, error: error?.message });
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // FIX: If pending QPay payment, check QPay API for missed webhooks
    let effectiveStatus = payment.status;

    if (payment.status === 'pending' && payment.payment_method === 'qpay' && payment.qpay_invoice_id) {
        try {
            const paymentCheck = await checkPaymentStatus(payment.qpay_invoice_id);

            if (isPaymentCompleted(paymentCheck)) {
                const transactionId = getTransactionId(paymentCheck);

                // Update payment to paid
                const updatedMetadata = {
                    ...(payment.metadata as Record<string, unknown> || {}),
                    payment_details: paymentCheck.rows?.[0] ?? null,
                    confirmed_via: 'pay_page_poll',
                    messenger_notified: true, // Mark to prevent duplicate
                };

                await supabase
                    .from('payments')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        qpay_transaction_id: transactionId,
                        metadata: updatedMetadata,
                    })
                    .eq('id', payment.id);

                // Update order status directly
                if (payment.order_id) {
                    await supabase
                        .from('orders')
                        .update({
                            status: 'confirmed',
                            payment_status: 'paid',
                            payment_method: 'qpay',
                            paid_at: new Date().toISOString(),
                        })
                        .eq('id', payment.order_id);

                    try {
                        const { deductStockForOrder } = await import('@/lib/services/StockService');
                        await deductStockForOrder(payment.order_id);
                    } catch (stockErr) {
                        logger.error('Stock deduction failed (pay page):', { error: String(stockErr) });
                    }

                    // ── Send Messenger confirmation (backup for missed webhooks) ──
                    try {
                        const { data: orderData } = await supabase
                            .from('orders')
                            .select('*, customers(name, facebook_id), shops(name, facebook_page_access_token, address)')
                            .eq('id', payment.order_id)
                            .single();

                        if (orderData?.customers?.facebook_id && orderData?.shops?.facebook_page_access_token) {
                            const { sendTaggedMessage } = await import('@/lib/facebook/messenger');
                            const amount = Number(payment.amount).toLocaleString();
                            const deliveryFee = Number(orderData.delivery_fee || 0);
                            const deliveryFeeMsg = deliveryFee > 0 ? `\n🚚 Хүргэлт: ${deliveryFee.toLocaleString()}₮` : '';

                            let confirmMsg = '';
                            if (orderData.delivery_method === 'pickup') {
                                const shopAddress = orderData.shops?.address || 'Дэлгүүрийн хаяг';
                                confirmMsg = `✅ Таны ${amount}₮ төлбөр амжилттай баталгаажлаа!\n\n📍 Очиж авах газар: ${shopAddress}\n\nЗахиалга #${payment.order_id.substring(0, 8)} — бэлтгэж эхэлнэ. Баярлалаа! 🙏`;
                            } else {
                                const deliveryAddress = orderData.delivery_address || '';
                                const addressMsg = deliveryAddress ? `\n📦 Хүргэх хаяг: ${deliveryAddress}` : '';
                                confirmMsg = `✅ Таны ${amount}₮ төлбөр амжилттай баталгаажлаа!${deliveryFeeMsg}${addressMsg}\n\nЗахиалга #${payment.order_id.substring(0, 8)} — бэлтгэж эхэлнэ. Баярлалаа! 🙏`;
                            }

                            // Use POST_PURCHASE_UPDATE tag — works even outside 24hr window
                            await sendTaggedMessage({
                                recipientId: orderData.customers.facebook_id,
                                message: confirmMsg,
                                pageAccessToken: orderData.shops.facebook_page_access_token,
                                tag: 'POST_PURCHASE_UPDATE',
                            });

                            logger.success('Messenger confirmation sent via pay page poll (backup)');
                        }
                    } catch (msgErr) {
                        logger.warn('Messenger backup notification failed:', { error: String(msgErr) });
                    }
                }

                effectiveStatus = 'paid';

                // ── Audit log entry (pay page poll confirmation) ──
                try {
                    await supabase
                        .from('payment_audit_logs')
                        .insert({
                            payment_id: payment.id,
                            shop_id: payment.shop_id,
                            order_id: payment.order_id,
                            action: 'paid',
                            old_status: 'pending',
                            new_status: 'paid',
                            amount: Number(payment.amount),
                            payment_method: 'qpay',
                            actor: 'pay_page_poll',
                            metadata: {
                                qpay_transaction_id: transactionId,
                                confirmed_via: 'pay_page_poll',
                            },
                        });
                } catch (auditErr) {
                    logger.warn('Audit log insert failed (non-critical):', { error: String(auditErr) });
                }

                logger.success('Payment confirmed via pay page poll:', {
                    payment_id: payment.id,
                    order_id: payment.order_id,
                });
            }
        } catch (checkErr) {
            // QPay check failed — just show current DB status
            logger.warn('QPay check failed on pay page:', { error: String(checkErr) });
        }
    }

    // Check if expired
    const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();

    // Get shop name via separate query
    let shopName = 'Syncly';
    if (payment.payment_type === 'subscription') {
        shopName = 'Syncly';
    } else if (payment.shop_id) {
        const { data: shop } = await supabase
            .from('shops')
            .select('name')
            .eq('id', payment.shop_id)
            .single();
        shopName = shop?.name || 'Shop';
    }

    // ── Fetch order items with product details ──
    let orderItems: Array<{
        id: string;
        name: string;
        image: string | null;
        quantity: number;
        unitPrice: number;
        variantSpecs: Record<string, string>;
    }> = [];

    if (payment.order_id) {
        const { data: items } = await supabase
            .from('order_items')
            .select('id, quantity, unit_price, variant_specs, product_id, products(name, image_url)')
            .eq('order_id', payment.order_id);

        if (items) {
            orderItems = items.map((item: Record<string, unknown>) => {
                const product = item.products as Record<string, unknown> | null;
                return {
                    id: item.id as string,
                    name: (product?.name as string) || 'Бүтээгдэхүүн',
                    image: (product?.image_url as string) || null,
                    quantity: item.quantity as number,
                    unitPrice: Number(item.unit_price),
                    variantSpecs: (item.variant_specs as Record<string, string>) || {},
                };
            });
        }
    }

    // Extract bank deeplinks from metadata
    const urls = (payment.metadata as Record<string, unknown>)?.urls as Array<{
        name: string;
        description: string;
        logo: string;
        link: string;
    }> || [];

    return NextResponse.json({
        id: payment.id,
        amount: payment.amount,
        status: isExpired && effectiveStatus === 'pending' ? 'expired' : effectiveStatus,
        shopName,
        shopLogo: null,
        paymentType: payment.payment_type,
        planSlug: payment.subscription_plan_slug,
        orderItems,
        banks: urls.map(u => ({
            name: u.name,
            description: u.description,
            logo: u.logo,
            link: u.link,
        })),
        qrImage: payment.qpay_qr_image,
        expiresAt: payment.expires_at,
        createdAt: payment.created_at,
    });
}
