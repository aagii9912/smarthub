/**
 * ProductService - Handles product-related database operations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DatabaseError, NotFoundError } from '@/types/errors';
import type { Product } from '@/types/database';

export interface ProductWithVariants extends Product {
    variants?: Array<{
        id: string;
        color: string | null;
        size: string | null;
        stock: number;
    }>;
}

export interface ProductFilters {
    isActive?: boolean;
    type?: 'physical' | 'service' | 'appointment';
    limit?: number;
    offset?: number;
}

export class ProductService {
    private supabase = supabaseAdmin();

    /**
     * Get product by ID
     */
    async getById(id: string): Promise<ProductWithVariants | null> {
        const { data, error } = await this.supabase
            .from('products')
            .select('*, variants:product_variants(*)')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to get product', { id, error });
            throw new DatabaseError('Failed to get product', { id });
        }

        return data as ProductWithVariants | null;
    }

    /**
     * Find product by name (fuzzy match)
     */
    async findByName(shopId: string, name: string): Promise<ProductWithVariants | null> {
        // Try exact match first
        let { data, error } = await this.supabase
            .from('products')
            .select('*, variants:product_variants(*)')
            .eq('shop_id', shopId)
            .eq('is_active', true)
            .ilike('name', name)
            .single();

        if (!data) {
            // Try fuzzy match
            const { data: fuzzyData } = await this.supabase
                .from('products')
                .select('*, variants:product_variants(*)')
                .eq('shop_id', shopId)
                .eq('is_active', true)
                .ilike('name', `%${name}%`)
                .limit(1)
                .single();

            data = fuzzyData;
        }

        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to find product by name', { shopId, name, error });
            throw new DatabaseError('Failed to find product', { shopId, name });
        }

        return data as ProductWithVariants | null;
    }

    /**
     * Get all products for a shop
     */
    async getByShop(shopId: string, filters?: ProductFilters): Promise<ProductWithVariants[]> {
        let query = this.supabase
            .from('products')
            .select('*, variants:product_variants(*)')
            .eq('shop_id', shopId);

        if (filters?.isActive !== undefined) {
            query = query.eq('is_active', filters.isActive);
        }

        if (filters?.type) {
            query = query.eq('type', filters.type);
        }

        query = query.order('created_at', { ascending: false });

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        if (filters?.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to get products', { shopId, filters, error });
            throw new DatabaseError('Failed to get products', { shopId });
        }

        return (data || []) as ProductWithVariants[];
    }

    /**
     * Check product stock
     */
    async checkStock(productId: string, requiredQty: number): Promise<{
        available: boolean;
        currentStock: number;
        reservedStock: number;
    }> {
        const { data, error } = await this.supabase
            .from('products')
            .select('stock, reserved_stock')
            .eq('id', productId)
            .single();

        if (error) {
            logger.error('Failed to check stock', { productId, error });
            throw new DatabaseError('Failed to check stock', { productId });
        }

        if (!data) {
            throw new NotFoundError('Product', productId);
        }

        const currentStock = data.stock || 0;
        const reservedStock = data.reserved_stock || 0;
        const availableStock = currentStock - reservedStock;

        return {
            available: availableStock >= requiredQty,
            currentStock,
            reservedStock,
        };
    }

    /**
     * Update product stock
     */
    async updateStock(productId: string, delta: number): Promise<void> {
        const { data, error } = await this.supabase
            .from('products')
            .select('stock')
            .eq('id', productId)
            .single();

        if (error || !data) {
            throw new NotFoundError('Product', productId);
        }

        const newStock = Math.max(0, (data.stock || 0) + delta);

        const { error: updateError } = await this.supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);

        if (updateError) {
            logger.error('Failed to update stock', { productId, delta, error: updateError });
            throw new DatabaseError('Failed to update stock', { productId });
        }

        logger.info('Stock updated', { productId, delta, newStock });
    }

    /**
     * Get low stock products (stock <= threshold)
     */
    async getLowStock(shopId: string, threshold: number = 5): Promise<Product[]> {
        const { data, error } = await this.supabase
            .from('products')
            .select('*')
            .eq('shop_id', shopId)
            .eq('is_active', true)
            .lte('stock', threshold)
            .order('stock', { ascending: true });

        if (error) {
            logger.error('Failed to get low stock products', { shopId, threshold, error });
            throw new DatabaseError('Failed to get low stock products', { shopId });
        }

        return data || [];
    }

    /**
     * Calculate discounted price
     */
    calculateDiscountedPrice(price: number, discountPercent: number | null): number {
        if (!discountPercent || discountPercent <= 0) {
            return price;
        }
        return price * (1 - discountPercent / 100);
    }
}

// Export singleton instance
export const productService = new ProductService();
