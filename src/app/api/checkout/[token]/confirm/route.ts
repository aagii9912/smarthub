import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { performCheckout, type CheckoutPaymentType } from '@/lib/services/CheckoutService';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/checkout/[token]/confirm
 * Public, token-scoped. Optionally saves the customer's phone/address, then
 * converts the cart into an order + payment via the shared checkout core and
 * returns the pay link (or COD/bank info). This is the ONLY point an order /
 * QPay invoice is created, so the amount is never stale.
 *
 * Body: { phone?, address?, payment_type? }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    try {
        const supabase = supabaseAdmin();

        const { data: cart } = await supabase
            .from('carts')
            .select('id, shop_id, customer_id, status')
            .eq('id', token)
            .single();
        if (!cart) return NextResponse.json({ error: 'Сагс олдсонгүй' }, { status: 404 });
        if (cart.status !== 'active') {
            return NextResponse.json({ error: 'Энэ сагс аль хэдийн захиалга болсон байна' }, { status: 409 });
        }

        const body = await request.json().catch(() => ({}));
        const phone: string | undefined = body?.phone?.toString().trim() || undefined;
        const address: string | undefined = body?.address?.toString().trim() || undefined;
        const paymentType = (body?.payment_type as CheckoutPaymentType | undefined) ?? 'qpay';

        // Persist any delivery contact info the customer entered on the page
        if (phone || address) {
            await supabase
                .from('customers')
                .update({
                    ...(phone ? { phone } : {}),
                    ...(address ? { address } : {}),
                })
                .eq('id', cart.customer_id);
        }

        const result = await performCheckout({
            shopId: cart.shop_id,
            customerId: cart.customer_id,
            paymentType,
            notes: 'Checkout link',
            notifyOrder: true,
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        if (result.awaitingDeliveryInfo) {
            return NextResponse.json(
                {
                    error: 'Хүргэлтийн мэдээлэл дутуу байна',
                    needsDeliveryInfo: true,
                    missingPhone: result.missingPhone,
                    missingAddress: result.missingAddress,
                },
                { status: 422 },
            );
        }

        return NextResponse.json({
            success: true,
            orderId: result.orderId,
            paymentId: result.paymentId,
            paymentLink: result.paymentLink,
            qpay: result.qpay,
            paymentMethod: result.paymentMethod,
            deliveryFee: result.deliveryFee,
            deliveryMethod: result.deliveryMethod,
            total: result.totalWithDelivery,
            shop: result.shop,
        });
    } catch (error) {
        logger.error('Checkout confirm failed:', { token, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Алдаа гарлаа' }, { status: 500 });
    }
}
