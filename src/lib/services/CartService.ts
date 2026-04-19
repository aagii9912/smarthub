/**
 * CartService - Handles cart-related database operations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DatabaseError, NotFoundError } from '@/types/errors';
import type { CartItem } from '@/types/ai';
import { pickOne, type SupabaseRelation } from '@/types/supabase-helpers';

interface CartItemProductRel { name: string }
interface CartItemRowDb {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    variant_specs?: Record<string, string> | null;
    products?: SupabaseRelation<CartItemProductRel>;
}

export interface AddToCartData {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    variantSpecs?: Record<string, string>;
}

export interface CartWithItems {
    id: string;
    shop_id: string;
    customer_id: string;
    items: CartItem[];
    total_amount: number;
    created_at: string;
    updated_at: string;
}

export class CartService {
    private supabase = supabaseAdmin();

    // Cart expires after 24 hours of inactivity
    static readonly CART_EXPIRY_HOURS = 24;

    /**
     * Check if a cart is expired (older than CART_EXPIRY_HOURS without update)
     */
    isCartExpired(cart: CartWithItems): boolean {
        const lastActivity = new Date(cart.updated_at || cart.created_at);
        const expiryMs = CartService.CART_EXPIRY_HOURS * 60 * 60 * 1000;
        return Date.now() - lastActivity.getTime() > expiryMs;
    }

    /**
     * Get or create cart for a customer
     * Auto-clears expired carts
     */
    async getOrCreate(shopId: string, customerId: string): Promise<CartWithItems> {
        // Try to find existing cart
        const cart = await this.getByCustomer(shopId, customerId);

        if (cart) {
            // If cart is expired, clear it and re-use
            if (this.isCartExpired(cart)) {
                logger.info('Cart expired, clearing items', {
                    cartId: cart.id,
                    age: `${Math.round((Date.now() - new Date(cart.updated_at || cart.created_at).getTime()) / 3600000)}h`,
                });
                await this.clearCart(cart.id);
                // Touch the cart to reset expiry
                await this.supabase
                    .from('carts')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', cart.id);
                return { ...cart, items: [], total_amount: 0, updated_at: new Date().toISOString() };
            }
            return cart;
        }

        // Create new cart
        const { data: newCart, error } = await this.supabase
            .from('carts')
            .insert({
                shop_id: shopId,
                customer_id: customerId,
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create cart', { shopId, customerId, error });
            throw new DatabaseError('Failed to create cart');
        }

        logger.info('Created new cart', { cartId: newCart.id, customerId });

        return {
            ...newCart,
            items: [],
            total_amount: 0,
        };
    }

    /**
     * Clean up all expired carts (for cron job)
     */
    async cleanupExpiredCarts(): Promise<{ deleted: number }> {
        const expiryDate = new Date(
            Date.now() - CartService.CART_EXPIRY_HOURS * 60 * 60 * 1000
        ).toISOString();

        // Find expired carts
        const { data: expiredCarts, error: findError } = await this.supabase
            .from('carts')
            .select('id')
            .lt('updated_at', expiryDate);

        if (findError || !expiredCarts || expiredCarts.length === 0) {
            return { deleted: 0 };
        }

        const cartIds = expiredCarts.map(c => c.id);

        // Delete cart items first
        await this.supabase
            .from('cart_items')
            .delete()
            .in('cart_id', cartIds);

        // Delete expired carts
        const { error: deleteError } = await this.supabase
            .from('carts')
            .delete()
            .in('id', cartIds);

        if (deleteError) {
            logger.error('Failed to cleanup expired carts', { error: deleteError });
            return { deleted: 0 };
        }

        logger.info(`Cleaned up ${cartIds.length} expired carts`);
        return { deleted: cartIds.length };
    }

    /**
     * Get cart by customer
     */
    async getByCustomer(shopId: string, customerId: string): Promise<CartWithItems | null> {
        const { data, error } = await this.supabase
            .from('carts')
            .select(`
                *,
                cart_items(
                    id,
                    product_id,
                    quantity,
                    unit_price,
                    variant_specs,
                    products(name)
                )
            `)
            .eq('shop_id', shopId)
            .eq('customer_id', customerId)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to get cart', { shopId, customerId, error });
            throw new DatabaseError('Failed to get cart');
        }

        if (!data) {
            return null;
        }

        // Transform to CartWithItems format
        const items: CartItem[] = ((data.cart_items || []) as CartItemRowDb[]).map((item) => ({
            id: item.id,
            product_id: item.product_id,
            name: pickOne(item.products)?.name ?? 'Unknown',
            variant_specs: item.variant_specs || {},
            quantity: item.quantity,
            unit_price: item.unit_price,
        }));

        const totalAmount = items.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0
        );

        return {
            id: data.id,
            shop_id: data.shop_id,
            customer_id: data.customer_id,
            items,
            total_amount: totalAmount,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };
    }

    /**
     * Add item to cart (with ON CONFLICT handling)
     */
    async addItem(
        cartId: string,
        item: AddToCartData
    ): Promise<{ success: boolean; newQuantity: number }> {


        // Check if item already exists in cart
        const { data: existingItem } = await this.supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('cart_id', cartId)
            .eq('product_id', item.productId)
            .eq('variant_specs', item.variantSpecs || {})
            .single();

        if (existingItem) {
            // Update quantity
            const newQuantity = existingItem.quantity + item.quantity;
            const { error } = await this.supabase
                .from('cart_items')
                .update({ quantity: newQuantity })
                .eq('id', existingItem.id);

            if (error) {
                logger.error('Failed to update cart item', { cartId, item, error });
                throw new DatabaseError('Failed to update cart item');
            }

            return { success: true, newQuantity };
        }

        // Insert new item
        const { error } = await this.supabase
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                variant_specs: item.variantSpecs || {},
            });

        if (error) {
            logger.error('Failed to add cart item', { cartId, item, error });
            throw new DatabaseError('Failed to add item to cart');
        }

        return { success: true, newQuantity: item.quantity };
    }

    /**
     * Update item quantity
     */
    async updateItemQuantity(cartItemId: string, quantity: number): Promise<void> {
        if (quantity <= 0) {
            return this.removeItem(cartItemId);
        }

        const { error } = await this.supabase
            .from('cart_items')
            .update({ quantity })
            .eq('id', cartItemId);

        if (error) {
            logger.error('Failed to update cart item quantity', { cartItemId, quantity, error });
            throw new DatabaseError('Failed to update cart item');
        }
    }

    /**
     * Remove item from cart
     */
    async removeItem(cartItemId: string): Promise<void> {
        const { error } = await this.supabase
            .from('cart_items')
            .delete()
            .eq('id', cartItemId);

        if (error) {
            logger.error('Failed to remove cart item', { cartItemId, error });
            throw new DatabaseError('Failed to remove cart item');
        }
    }

    /**
     * Clear all items from cart
     */
    async clearCart(cartId: string): Promise<void> {
        const { error } = await this.supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cartId);

        if (error) {
            logger.error('Failed to clear cart', { cartId, error });
            throw new DatabaseError('Failed to clear cart');
        }

        logger.info('Cart cleared', { cartId });
    }

    /**
     * Delete cart entirely
     */
    async deleteCart(cartId: string): Promise<void> {
        // Delete items first (cascade should handle this, but being explicit)
        await this.clearCart(cartId);

        const { error } = await this.supabase
            .from('carts')
            .delete()
            .eq('id', cartId);

        if (error) {
            logger.error('Failed to delete cart', { cartId, error });
            throw new DatabaseError('Failed to delete cart');
        }
    }

    /**
     * Convert cart to order (used when customer confirms order)
     */
    async getCartSummary(cartId: string): Promise<{
        items: CartItem[];
        totalAmount: number;
        itemCount: number;
    }> {
        const { data, error } = await this.supabase
            .from('carts')
            .select(`
                cart_items(
                    id,
                    product_id,
                    quantity,
                    unit_price,
                    variant_specs,
                    products(name)
                )
            `)
            .eq('id', cartId)
            .single();

        if (error) {
            logger.error('Failed to get cart summary', { cartId, error });
            throw new DatabaseError('Failed to get cart summary');
        }

        if (!data) {
            throw new NotFoundError('Cart', cartId);
        }

        const items: CartItem[] = ((data.cart_items || []) as CartItemRowDb[]).map((item) => ({
            id: item.id,
            product_id: item.product_id,
            name: pickOne(item.products)?.name ?? 'Unknown',
            variant_specs: item.variant_specs || {},
            quantity: item.quantity,
            unit_price: item.unit_price,
        }));

        const totalAmount = items.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0
        );

        return {
            items,
            totalAmount,
            itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        };
    }
}

// Export singleton instance
export const cartService = new CartService();
