import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/facebook/messenger';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/dashboard/conversations/[customerId]/checkout-link
 *
 * Shop owner mints (and optionally sends) the EDITABLE checkout-review link for
 * a customer's active cart. The customer can then add/remove items, change
 * quantities, and pay themselves — no order is created until they confirm.
 *
 * Body: { sendToCustomer?: boolean }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ customerId: string }> },
) {
    try {
        const { customerId } = await params;
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const sendToCustomer = Boolean(body?.sendToCustomer);

        const supabase = supabaseAdmin();

        const { data: shop } = await supabase
            .from('shops')
            .select('id, name, facebook_page_access_token')
            .eq('id', authShop.id)
            .single();
        if (!shop) {
            return NextResponse.json({ error: 'Shop олдсонгүй' }, { status: 404 });
        }

        const { data: customer } = await supabase
            .from('customers')
            .select('id, name, facebook_id')
            .eq('id', customerId)
            .eq('shop_id', authShop.id)
            .maybeSingle();
        if (!customer) {
            return NextResponse.json({ error: 'Хэрэглэгч олдсонгүй' }, { status: 404 });
        }

        // Ensure an active cart exists for this customer (creates one if needed)
        const { data: cartId, error: cartError } = await supabase.rpc('get_or_create_cart', {
            p_shop_id: authShop.id,
            p_customer_id: customerId,
        });
        if (cartError || !cartId) {
            logger.error('checkout-link: cart creation failed', { error: cartError?.message });
            return NextResponse.json({ error: 'Сагс үүсгэхэд алдаа гарлаа' }, { status: 500 });
        }

        const link = `${request.nextUrl.origin}/checkout/${cartId}`;

        let sentToCustomerOk = false;
        if (sendToCustomer && customer.facebook_id && shop.facebook_page_access_token) {
            try {
                const text = `🛒 Захиалгаа доорх линкээр шалгаж, бараа нэмэх/хасах, тоо ширхэг өөрчилж, дараа нь шууд төлбөрөө төлнө үү:\n${link}`;
                await sendTextMessage({
                    recipientId: customer.facebook_id,
                    message: text,
                    pageAccessToken: shop.facebook_page_access_token,
                });
                sentToCustomerOk = true;
            } catch (err) {
                logger.warn('checkout-link FB send failed (non-critical)', { error: String(err) });
            }
        }

        return NextResponse.json({
            success: true,
            link,
            cart_id: cartId,
            sentToCustomer: sentToCustomerOk,
        });
    } catch (error: unknown) {
        logger.error('checkout-link error', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
