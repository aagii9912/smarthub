import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/pay/[id]
 * Public endpoint - returns payment details for the landing page
 * No auth required (customer accesses via link from chat)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = supabaseAdmin();

    const { data: payment, error } = await supabase
        .from('payments')
        .select(`
            id,
            amount,
            status,
            payment_method,
            qpay_qr_text,
            qpay_qr_image,
            metadata,
            expires_at,
            created_at,
            payment_type,
            subscription_plan_slug,
            orders(id, shops(name, logo_url)),
            shop_id
        `)
        .eq('id', id)
        .single();

    if (error || !payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Extract bank deeplinks from metadata
    const urls = (payment.metadata as Record<string, unknown>)?.urls as Array<{
        name: string;
        description: string;
        logo: string;
        link: string;
    }> || [];

    // Check if expired
    const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();

    // Get shop info
    let shopName = 'Syncly';
    let shopLogo = null;
    if (payment.payment_type === 'subscription') {
        shopName = 'Syncly';
    } else if (payment.orders) {
        const order = payment.orders as Record<string, unknown>;
        const shop = order.shops as Record<string, unknown>;
        shopName = (shop?.name as string) || 'Shop';
        shopLogo = shop?.logo_url || null;
    }

    return NextResponse.json({
        id: payment.id,
        amount: payment.amount,
        status: isExpired && payment.status === 'pending' ? 'expired' : payment.status,
        shopName,
        shopLogo,
        paymentType: payment.payment_type,
        planSlug: payment.subscription_plan_slug,
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
