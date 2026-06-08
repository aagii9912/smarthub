import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/checkout/[token]/products
 * Public, token-scoped product catalog for the cart's shop — lets the customer
 * browse and add items on the checkout-review page. Returns only active,
 * in-stock-or-listed products with their variants.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    try {
        const supabase = supabaseAdmin();

        const { data: cart } = await supabase
            .from('carts')
            .select('shop_id, status')
            .eq('id', token)
            .single();
        if (!cart) return NextResponse.json({ error: 'Сагс олдсонгүй' }, { status: 404 });

        const { data: products } = await supabase
            .from('products')
            .select('id, name, price, image_url, stock, reserved_stock, discount_percent, has_variants, variants:product_variants(id, name, price, stock, is_active)')
            .eq('shop_id', cart.shop_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        const catalog = (products ?? []).map((p: Record<string, unknown>) => {
            const stock = Number(p.stock ?? 0);
            const reserved = Number(p.reserved_stock ?? 0);
            return {
                id: p.id,
                name: p.name,
                price: Number(p.price ?? 0),
                image: (p.image_url as string) || null,
                discount_percent: Number(p.discount_percent ?? 0) || 0,
                available_stock: Math.max(0, stock - reserved),
                has_variants: Boolean(p.has_variants),
                variants: ((p.variants as Array<Record<string, unknown>>) ?? [])
                    .filter((v) => v.is_active !== false)
                    .map((v) => ({
                        id: v.id,
                        name: v.name,
                        price: v.price != null ? Number(v.price) : null,
                        stock: Number(v.stock ?? 0),
                    })),
            };
        });

        return NextResponse.json({ products: catalog });
    } catch (error) {
        logger.error('Checkout catalog failed:', { token, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Алдаа гарлаа' }, { status: 500 });
    }
}
