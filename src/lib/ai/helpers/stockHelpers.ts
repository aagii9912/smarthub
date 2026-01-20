/**
 * StockHelpers - Database helper functions for stock and cart management
 * Extracted from openai.ts to enable reuse and testing
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * Check product stock from DB (not context) - prevents stale data
 */
export async function checkProductStock(
    productId: string,
    requiredQty: number
): Promise<{ available: boolean; currentStock: number; reserved: number }> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('stock, reserved_stock')
        .eq('id', productId)
        .single();

    const stock = data?.stock || 0;
    const reserved = data?.reserved_stock || 0;
    const availableStock = stock - reserved;

    return {
        available: availableStock >= requiredQty,
        currentStock: availableStock,
        reserved
    };
}

/**
 * Get product from DB by name (fuzzy match) - prevents stale context data
 */
export async function getProductFromDB(
    shopId: string,
    productName: string
): Promise<{
    id: string;
    name: string;
    price: number;
    stock: number;
    reserved_stock: number;
    discount_percent: number | null;
} | null> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('id, name, price, stock, reserved_stock, discount_percent')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .ilike('name', `%${productName}%`)
        .limit(1)
        .single();

    return data;
}

/**
 * Add item to cart with ON CONFLICT handling - prevents race conditions
 */
export async function addItemToCart(
    cartId: string,
    productId: string,
    variantSpecs: Record<string, string>,
    quantity: number,
    unitPrice: number
): Promise<{ success: boolean; newQuantity: number }> {
    const supabase = supabaseAdmin();

    // Use upsert with ON CONFLICT to prevent race conditions
    const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .single();

    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        await supabase
            .from('cart_items')
            .update({ quantity: newQuantity })
            .eq('id', existingItem.id);
        return { success: true, newQuantity };
    } else {
        await supabase
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: productId,
                variant_specs: variantSpecs,
                quantity,
                unit_price: unitPrice
            });
        return { success: true, newQuantity: quantity };
    }
}

/**
 * Get fresh cart data from DB
 */
export async function getCartFromDB(shopId: string, customerId: string): Promise<{
    id: string;
    items: Array<{
        id: string;
        product_id: string;
        name: string;
        variant_specs: Record<string, string>;
        quantity: number;
        unit_price: number;
    }>;
    total_amount: number;
} | null> {
    const supabase = supabaseAdmin();

    // Get active cart
    const { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .single();

    if (!cart) return null;

    // Get cart items with product names
    const { data: items } = await supabase
        .from('cart_items')
        .select(`
            id,
            product_id,
            variant_specs,
            quantity,
            unit_price,
            products (name)
        `)
        .eq('cart_id', cart.id);

    if (!items || items.length === 0) {
        return { id: cart.id, items: [], total_amount: 0 };
    }

    const mappedItems = items.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.products?.name || item.products?.[0]?.name || 'Unknown',
        variant_specs: item.variant_specs as Record<string, string>,
        quantity: item.quantity,
        unit_price: Number(item.unit_price)
    }));

    const total = mappedItems.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

    return { id: cart.id, items: mappedItems, total_amount: total };
}

/**
 * Reserve stock for a product
 */
export async function reserveStock(productId: string, quantity: number): Promise<boolean> {
    const supabase = supabaseAdmin();

    // First check if enough stock
    const stock = await checkProductStock(productId, quantity);
    if (!stock.available) {
        return false;
    }

    // Update reserved_stock
    const { error } = await supabase
        .from('products')
        .update({
            reserved_stock: stock.reserved + quantity
        })
        .eq('id', productId);

    if (error) {
        logger.error('Failed to reserve stock:', { productId, quantity, error });
        return false;
    }

    return true;
}

/**
 * Restore stock (on order cancellation)
 */
export async function restoreStock(productId: string, quantity: number): Promise<boolean> {
    const supabase = supabaseAdmin();

    const { data } = await supabase
        .from('products')
        .select('reserved_stock')
        .eq('id', productId)
        .single();

    const currentReserved = data?.reserved_stock || 0;
    const newReserved = Math.max(0, currentReserved - quantity);

    const { error } = await supabase
        .from('products')
        .update({ reserved_stock: newReserved })
        .eq('id', productId);

    if (error) {
        logger.error('Failed to restore stock:', { productId, quantity, error });
        return false;
    }

    return true;
}

/**
 * Get or create cart for customer
 */
export async function getOrCreateCart(
    shopId: string,
    customerId: string
): Promise<{ id: string; isNew: boolean }> {
    const supabase = supabaseAdmin();

    // Try to find existing active cart
    const { data: existingCart } = await supabase
        .from('carts')
        .select('id')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .single();

    if (existingCart) {
        return { id: existingCart.id, isNew: false };
    }

    // Create new cart
    const { data: newCart, error } = await supabase
        .from('carts')
        .insert({
            shop_id: shopId,
            customer_id: customerId,
            status: 'active'
        })
        .select('id')
        .single();

    if (error || !newCart) {
        logger.error('Failed to create cart:', { shopId, customerId, error });
        throw new Error('Failed to create cart');
    }

    return { id: newCart.id, isNew: true };
}
