/**
 * CartService - Handles cart-related database operations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DatabaseError, NotFoundError } from '@/types/errors';
import type { CartItem } from '@/types/ai';

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

    /**
     * Get or create cart for a customer
     */
    async getOrCreate(shopId: string, customerId: string): Promise<CartWithItems> {
        // Try to find existing cart
        const cart = await this.getByCustomer(shopId, customerId);

        if (cart) {
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
        const items: CartItem[] = (data.cart_items || []).map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            name: item.products?.name || item.products?.[0]?.name || 'Unknown',
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

        const items: CartItem[] = (data.cart_items || []).map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            name: item.products?.name || item.products?.[0]?.name || 'Unknown',
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
