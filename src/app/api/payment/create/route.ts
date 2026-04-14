import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createShopOrderInvoice } from '@/lib/payment/qpay';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/payment/create
 * Create payment for an order
 * 
 * Uses the SHOP's own QPay merchant account (not Syncly's).
 * Shop must have completed QPay setup (/api/shop/qpay-setup) first.
 * 
 * Body: {
 *   orderId: string,
 *   paymentMethod: 'qpay' | 'cash' | 'bank_transfer'
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { orderId, paymentMethod } = body;

        if (!orderId || !paymentMethod) {
            return NextResponse.json({
                error: 'Missing required fields: orderId, paymentMethod'
            }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Get order details
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, shop_id, total_amount, customer_id, customers(name, email, phone)')
            .eq('id', orderId)
            .eq('shop_id', authShop.id)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Check if payment already exists
        const { data: existingPayment } = await supabase
            .from('payments')
            .select('id, shop_id, amount, status, created_at')
            .eq('order_id', orderId)
            .eq('status', 'paid')
            .single();

        if (existingPayment) {
            return NextResponse.json({
                error: 'Order already paid',
                payment: existingPayment
            }, { status: 400 });
        }

        // Handle different payment methods
        if (paymentMethod === 'qpay') {
            // Get shop's QPay merchant details
            const { data: shop } = await supabase
                .from('shops')
                .select('id, name, qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status')
                .eq('id', authShop.id)
                .single();

            if (!shop?.qpay_merchant_id || shop.qpay_status !== 'active') {
                return NextResponse.json({
                    error: 'QPay тохиргоо хийгдээгүй байна. Эхлээд Тохиргоо → QPay хэсэгт банкны дансаа бүртгүүлнэ үү.',
                    code: 'QPAY_NOT_SETUP',
                    setup_url: '/settings/payment',
                }, { status: 400 });
            }

            // Create QPay invoice using SHOP's merchant account
            const callbackUrl = `${request.nextUrl.origin}/api/payment/webhook?type=order&order=${orderId}`;

            const qpayInvoice = await createShopOrderInvoice({
                shopMerchantId: shop.qpay_merchant_id,
                shopBankCode: shop.qpay_bank_code!,
                shopAccountNumber: shop.qpay_account_number!,
                shopAccountName: shop.qpay_account_name!,
                orderId: order.id,
                amount: Number(order.total_amount),
                shopName: shop.name || 'Shop',
                callbackUrl,
            });

            if (!qpayInvoice) {
                return NextResponse.json({
                    error: 'QPay одоогоор түр ажиллахгүй байна. Дансаар шилжүүлэх эсвэл түр хүлээгээд дахин оролдоно уу.',
                    code: 'QPAY_UNAVAILABLE'
                }, { status: 503 });
            }

            // Create payment record
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    order_id: order.id,
                    shop_id: authShop.id,
                    payment_type: 'order',
                    payment_method: 'qpay',
                    amount: order.total_amount,
                    status: 'pending',
                    qpay_invoice_id: qpayInvoice.invoice_id,
                    qpay_qr_text: qpayInvoice.qr_text,
                    qpay_qr_image: qpayInvoice.qr_image,
                    metadata: {
                        urls: qpayInvoice.urls,
                        shop_merchant_id: shop.qpay_merchant_id,
                    },
                    expires_at: qpayInvoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

            if (paymentError) {
                logger.error('Failed to create payment record', { error: paymentError.message });
                throw new Error('Failed to create payment');
            }

            logger.success('QPay shop payment created:', {
                payment_id: payment.id,
                invoice_id: qpayInvoice.invoice_id,
                shop_merchant: shop.qpay_merchant_id,
            });

            return NextResponse.json({
                success: true,
                payment: {
                    id: payment.id,
                    qr_text: qpayInvoice.qr_text,
                    qr_image: qpayInvoice.qr_image,
                    urls: qpayInvoice.urls,
                    expires_at: payment.expires_at,
                },
            });

        } else if (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') {
            // Create pending payment for manual methods
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    order_id: order.id,
                    shop_id: authShop.id,
                    payment_type: 'order',
                    payment_method: paymentMethod,
                    amount: order.total_amount,
                    status: 'pending',
                })
                .select()
                .single();

            if (paymentError) {
                throw new Error('Failed to create payment');
            }

            // Update order payment method
            await supabase
                .from('orders')
                .update({ payment_method: paymentMethod })
                .eq('id', orderId);

            logger.success(`${paymentMethod} payment created:`, { payment_id: payment.id });

            return NextResponse.json({
                success: true,
                payment: {
                    id: payment.id,
                    method: paymentMethod,
                    amount: payment.amount,
                    status: payment.status,
                },
            });

        } else {
            return NextResponse.json({
                error: 'Invalid payment method'
            }, { status: 400 });
        }

    } catch (error: unknown) {
        logger.error('Payment creation error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Payment creation failed'
        }, { status: 500 });
    }
}
