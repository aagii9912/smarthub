import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCheckoutSummary } from '@/lib/services/CheckoutService';
import { logger } from '@/lib/utils/logger';

/**
 * Item mutations for a checkout-review link (token = cart id).
 * Public + token-scoped: every write is validated against the token's cart and
 * its shop, and quantities are clamped to available stock. After each change we
 * return the fresh summary so the page can show live totals.
 *
 *   POST   { product_id, variant_specs?, quantity? }  → add / increment
 *   PATCH  { item_id, quantity }                       → set qty (0 = remove)
 *   DELETE ?item_id=...                                → remove
 */

interface ActiveCart {
    id: string;
    shop_id: string;
}

async function loadActiveCart(token: string): Promise<ActiveCart | null> {
    const supabase = supabaseAdmin();
    const { data: cart } = await supabase
        .from('carts')
        .select('id, shop_id, status')
        .eq('id', token)
        .single();
    if (!cart || cart.status !== 'active') return null;
    return { id: cart.id, shop_id: cart.shop_id };
}

function sameVariant(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    try {
        const cart = await loadActiveCart(token);
        if (!cart) return NextResponse.json({ error: 'Сагс олдсонгүй эсвэл хаагдсан' }, { status: 404 });

        const body = await request.json();
        const { product_id, variant_specs = {}, quantity = 1 } = body;
        if (!product_id) return NextResponse.json({ error: 'product_id шаардлагатай' }, { status: 400 });
        const addQty = Math.max(1, Math.floor(Number(quantity) || 1));

        const supabase = supabaseAdmin();

        // Product must belong to this cart's shop and be active
        const { data: product } = await supabase
            .from('products')
            .select('id, name, price, stock, reserved_stock, discount_percent, is_active')
            .eq('id', product_id)
            .eq('shop_id', cart.shop_id)
            .single();
        if (!product || product.is_active === false) {
            return NextResponse.json({ error: 'Бараа олдсонгүй' }, { status: 404 });
        }

        const available = (product.stock || 0) - (product.reserved_stock || 0);

        // Merge with an existing identical line if present
        const { data: existingRows } = await supabase
            .from('cart_items')
            .select('id, quantity, variant_specs')
            .eq('cart_id', cart.id)
            .eq('product_id', product_id);
        const existing = (existingRows ?? []).find((r) => sameVariant(r.variant_specs, variant_specs));

        const targetQty = (existing?.quantity ?? 0) + addQty;
        if (available < targetQty) {
            return NextResponse.json(
                { error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${available}`, available_stock: available },
                { status: 400 },
            );
        }

        if (existing) {
            await supabase.from('cart_items').update({ quantity: targetQty }).eq('id', existing.id);
        } else {
            const unitPrice = product.discount_percent
                ? Math.round(product.price * (1 - product.discount_percent / 100))
                : product.price;
            await supabase.from('cart_items').insert({
                cart_id: cart.id,
                product_id,
                variant_specs,
                quantity: addQty,
                unit_price: unitPrice,
            });
        }

        await supabase.from('carts').update({ updated_at: new Date().toISOString() }).eq('id', cart.id);

        return NextResponse.json({ success: true, summary: await getCheckoutSummary(token) });
    } catch (error) {
        logger.error('Checkout item POST failed:', { token, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Алдаа гарлаа' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    try {
        const cart = await loadActiveCart(token);
        if (!cart) return NextResponse.json({ error: 'Сагс олдсонгүй эсвэл хаагдсан' }, { status: 404 });

        const body = await request.json();
        const { item_id, quantity } = body;
        if (!item_id || typeof quantity !== 'number') {
            return NextResponse.json({ error: 'item_id, quantity шаардлагатай' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Item must belong to this cart
        const { data: item } = await supabase
            .from('cart_items')
            .select('id, cart_id, products(stock, reserved_stock)')
            .eq('id', item_id)
            .single();
        if (!item || item.cart_id !== cart.id) {
            return NextResponse.json({ error: 'Бараа олдсонгүй' }, { status: 404 });
        }

        const qty = Math.floor(quantity);
        if (qty <= 0) {
            await supabase.from('cart_items').delete().eq('id', item_id);
            return NextResponse.json({ success: true, summary: await getCheckoutSummary(token) });
        }

        const p = (Array.isArray(item.products) ? item.products[0] : item.products) as
            | { stock?: number; reserved_stock?: number }
            | null;
        const available = (p?.stock || 0) - (p?.reserved_stock || 0);
        if (available < qty) {
            return NextResponse.json(
                { error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${available}`, available_stock: available },
                { status: 400 },
            );
        }

        await supabase.from('cart_items').update({ quantity: qty }).eq('id', item_id);
        return NextResponse.json({ success: true, summary: await getCheckoutSummary(token) });
    } catch (error) {
        logger.error('Checkout item PATCH failed:', { token, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Алдаа гарлаа' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const { token } = await params;
    try {
        const cart = await loadActiveCart(token);
        if (!cart) return NextResponse.json({ error: 'Сагс олдсонгүй эсвэл хаагдсан' }, { status: 404 });

        const itemId = new URL(request.url).searchParams.get('item_id');
        if (!itemId) return NextResponse.json({ error: 'item_id шаардлагатай' }, { status: 400 });

        const supabase = supabaseAdmin();
        const { data: item } = await supabase
            .from('cart_items')
            .select('id, cart_id')
            .eq('id', itemId)
            .single();
        if (!item || item.cart_id !== cart.id) {
            return NextResponse.json({ error: 'Бараа олдсонгүй' }, { status: 404 });
        }

        await supabase.from('cart_items').delete().eq('id', itemId);
        return NextResponse.json({ success: true, summary: await getCheckoutSummary(token) });
    } catch (error) {
        logger.error('Checkout item DELETE failed:', { token, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Алдаа гарлаа' }, { status: 500 });
    }
}
