/**
 * Cart API Routes
 * GET - Get active cart for current shop's customer
 * POST - Add item to cart / Checkout
 * DELETE - Remove item from cart
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Get cart contents
export async function GET(request: NextRequest) {
    try {
        const shop = await getClerkUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customer_id');

        if (!customerId) {
            return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Get or create cart
        const { data: cartId, error: cartError } = await supabase
            .rpc('get_or_create_cart', {
                p_shop_id: shop.id,
                p_customer_id: customerId
            });

        if (cartError) throw cartError;

        // Get cart items with product details
        const { data: items, error: itemsError } = await supabase
            .from('cart_items')
            .select(`
                id,
                product_id,
                variant_specs,
                quantity,
                unit_price,
                products (
                    id,
                    name,
                    image_url,
                    stock,
                    reserved_stock
                )
            `)
            .eq('cart_id', cartId);

        if (itemsError) throw itemsError;

        // Calculate total
        const { data: total } = await supabase
            .rpc('calculate_cart_total', { p_cart_id: cartId });

        return NextResponse.json({
            cart_id: cartId,
            items: items?.map(item => ({
                id: item.id,
                product_id: item.product_id,
                name: (item.products as any)?.name || 'Unknown',
                image_url: (item.products as any)?.image_url,
                variant_specs: item.variant_specs,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.unit_price * item.quantity
            })) || [],
            total_amount: total || 0,
            item_count: items?.length || 0
        });

    } catch (error: any) {
        console.error('Cart GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Add to cart or Checkout
export async function POST(request: NextRequest) {
    try {
        const shop = await getClerkUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, customer_id, product_id, quantity = 1, variant_specs = {}, notes } = body;

        if (!customer_id) {
            return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Get or create cart
        const { data: cartId, error: cartError } = await supabase
            .rpc('get_or_create_cart', {
                p_shop_id: shop.id,
                p_customer_id: customer_id
            });

        if (cartError) throw cartError;

        // CHECKOUT action
        if (action === 'checkout') {
            const { data: orderId, error: checkoutError } = await supabase
                .rpc('checkout_cart', {
                    p_cart_id: cartId,
                    p_notes: notes || 'AI Chat Checkout'
                });

            if (checkoutError) throw checkoutError;

            return NextResponse.json({
                success: true,
                action: 'checkout',
                order_id: orderId,
                message: `Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ!`
            });
        }

        // ADD TO CART action (default)
        if (!product_id) {
            return NextResponse.json({ error: 'product_id is required for add_to_cart' }, { status: 400 });
        }

        // Get product details
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, price, stock, reserved_stock, discount_percent')
            .eq('id', product_id)
            .eq('shop_id', shop.id)
            .single();

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Check stock availability
        const availableStock = (product.stock || 0) - (product.reserved_stock || 0);
        if (availableStock < quantity) {
            return NextResponse.json({
                error: `Үлдэгдэл хүрэлцэхгүй байна. Боломжит: ${availableStock}`,
                available_stock: availableStock
            }, { status: 400 });
        }

        // Calculate price (with discount if applicable)
        const discountedPrice = product.discount_percent
            ? Math.round(product.price * (1 - product.discount_percent / 100))
            : product.price;

        // Check if product already in cart
        const { data: existingItem } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('cart_id', cartId)
            .eq('product_id', product_id)
            .eq('variant_specs', variant_specs)
            .single();

        if (existingItem) {
            // Update quantity
            const newQuantity = existingItem.quantity + quantity;

            // Check stock for new quantity
            if (availableStock < newQuantity) {
                return NextResponse.json({
                    error: `Нийт ${newQuantity} ширхэг авах боломжгүй. Боломжит: ${availableStock}`,
                    available_stock: availableStock
                }, { status: 400 });
            }

            await supabase
                .from('cart_items')
                .update({ quantity: newQuantity })
                .eq('id', existingItem.id);

            return NextResponse.json({
                success: true,
                action: 'updated',
                product_name: product.name,
                quantity: newQuantity,
                message: `${product.name} (${newQuantity}ш) сагсанд шинэчлэгдлээ`
            });
        }

        // Add new item to cart
        const { error: insertError } = await supabase
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: product_id,
                variant_specs: variant_specs,
                quantity: quantity,
                unit_price: discountedPrice
            });

        if (insertError) throw insertError;

        // Update cart updated_at
        await supabase
            .from('carts')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', cartId);

        return NextResponse.json({
            success: true,
            action: 'added',
            product_name: product.name,
            quantity: quantity,
            unit_price: discountedPrice,
            message: `${product.name} (${quantity}ш) сагсанд нэмэгдлээ!`
        });

    } catch (error: any) {
        console.error('Cart POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Remove item from cart
export async function DELETE(request: NextRequest) {
    try {
        const shop = await getClerkUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get('item_id');
        const customerId = searchParams.get('customer_id');

        if (!itemId || !customerId) {
            return NextResponse.json({ error: 'item_id and customer_id are required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Verify item belongs to customer's cart in this shop
        const { data: item, error: itemError } = await supabase
            .from('cart_items')
            .select(`
                id,
                products (name),
                carts!inner (shop_id, customer_id)
            `)
            .eq('id', itemId)
            .single();

        if (itemError || !item) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const cart = item.carts as any;
        if (cart.shop_id !== shop.id || cart.customer_id !== customerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Delete item
        await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId);

        return NextResponse.json({
            success: true,
            message: `${(item.products as any)?.name || 'Бараа'} сагснаас хасагдлаа`
        });

    } catch (error: any) {
        console.error('Cart DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
