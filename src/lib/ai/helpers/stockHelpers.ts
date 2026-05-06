/**
 * StockHelpers - Database helper functions for stock and cart management
 * Extracted from openai.ts to enable reuse and testing
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { pickOne, type SupabaseRelation } from '@/types/supabase-helpers';

interface CartItemDbRow {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number | string;
    variant_specs?: Record<string, string> | null;
    products?: SupabaseRelation<{ name: string }>;
}

/**
 * Check product stock from DB (not context) - prevents stale data.
 *
 * Services / appointments without an explicit booking cap (stock null or 0)
 * are treated as "always available" — they don't have inventory in the
 * traditional sense, the AI is just logging an order.
 */
export async function checkProductStock(
    productId: string,
    requiredQty: number
): Promise<{ available: boolean; currentStock: number; reserved: number; unlimited?: boolean }> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('stock, reserved_stock, type')
        .eq('id', productId)
        .single();

    const rawStock = (data as unknown as { stock?: number | null })?.stock ?? null;
    const reserved = data?.reserved_stock || 0;
    const productType = (data as unknown as { type?: string })?.type;
    const isService = productType === 'service' || productType === 'appointment';
    const hasExplicitCap = typeof rawStock === 'number' && rawStock > 0;

    if (isService && !hasExplicitCap) {
        return {
            available: true,
            currentStock: Number.MAX_SAFE_INTEGER,
            reserved,
            unlimited: true,
        };
    }

    const stock = rawStock ?? 0;
    const availableStock = stock - reserved;

    return {
        available: availableStock >= requiredQty,
        currentStock: availableStock,
        reserved
    };
}

/**
 * Get product from DB by name. Tries exact (case-insensitive) → prefix →
 * substring in that order; ranking inside each tier is shortest-name-first
 * so "Цамц" doesn't accidentally resolve to "Цамц улаан Premium" when both
 * exist.
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
    const trimmed = productName.trim();
    if (!trimmed) return null;

    // Escape PostgREST ilike wildcards (% and _) coming from user/AI input.
    const escaped = trimmed.replace(/[%_\\]/g, '\\$&');

    const { data: candidates } = await supabase
        .from('products')
        .select('id, name, price, stock, reserved_stock, discount_percent')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .ilike('name', `%${escaped}%`)
        .limit(20);

    if (!candidates || candidates.length === 0) return null;

    const needle = trimmed.toLowerCase();
    const ranked = [...candidates].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aTier = aName === needle ? 0 : aName.startsWith(needle) ? 1 : 2;
        const bTier = bName === needle ? 0 : bName.startsWith(needle) ? 1 : 2;
        if (aTier !== bTier) return aTier - bTier;
        return aName.length - bName.length;
    });

    return ranked[0];
}

/**
 * Add item to cart. Existing rows are matched on (cart_id, product_id, variant_specs)
 * so two different variants of the same product (e.g. red M vs blue L) stay as
 * separate cart_items instead of being merged with the wrong variant info.
 */
export async function addItemToCart(
    cartId: string,
    productId: string,
    variantSpecs: Record<string, string>,
    quantity: number,
    unitPrice: number
): Promise<{ success: boolean; newQuantity: number }> {
    const supabase = supabaseAdmin();

    const { data: candidates } = await supabase
        .from('cart_items')
        .select('id, quantity, variant_specs')
        .eq('cart_id', cartId)
        .eq('product_id', productId);

    const existingItem = (candidates ?? []).find((row) =>
        variantSpecsEqual(
            (row.variant_specs ?? {}) as Record<string, string>,
            variantSpecs
        )
    );

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

function variantSpecsEqual(
    a: Record<string, string>,
    b: Record<string, string>
): boolean {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k, i) => bKeys[i] === k && a[k] === b[k]);
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

    const mappedItems = (items as CartItemDbRow[]).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        name: pickOne(item.products)?.name ?? 'Unknown',
        variant_specs: (item.variant_specs ?? {}) as Record<string, string>,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
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
