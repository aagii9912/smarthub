/**
 * OrderService - Handles order-related database operations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DatabaseError, NotFoundError, ValidationError } from '@/types/errors';
import type { Order, OrderStatus, OrderItem } from '@/types/database';
import type { CreateOrderData } from '@/types/ai';

export interface OrderWithItems extends Order {
    order_items: Array<OrderItem & {
        products?: {
            name: string;
            image_url: string | null;
        };
    }>;
    customers?: {
        name: string | null;
        phone: string | null;
        facebook_id: string | null;
    };
}

export interface OrderFilters {
    status?: OrderStatus | OrderStatus[];
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}

export class OrderService {
    private supabase = supabaseAdmin();

    /**
     * Get order by ID with items
     */
    async getById(id: string): Promise<OrderWithItems | null> {
        const { data, error } = await this.supabase
            .from('orders')
            .select(`
                *,
                order_items(*, products(name, image_url)),
                customers(name, phone, facebook_id)
            `)
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to get order', { id, error });
            throw new DatabaseError('Failed to get order', { id });
        }

        return data as OrderWithItems | null;
    }

    /**
     * Create a new order with items
     */
    async create(data: CreateOrderData): Promise<OrderWithItems> {
        if (!data.items || data.items.length === 0) {
            throw new ValidationError('Order must have at least one item');
        }

        // Calculate total amount
        const totalAmount = data.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
        );

        // Create order
        const { data: order, error: orderError } = await this.supabase
            .from('orders')
            .insert({
                shop_id: data.shopId,
                customer_id: data.customerId,
                status: 'pending' as OrderStatus,
                total_amount: totalAmount,
                notes: data.notes,
                delivery_address: data.deliveryAddress,
            })
            .select()
            .single();

        if (orderError) {
            logger.error('Failed to create order', { data, error: orderError });
            throw new DatabaseError('Failed to create order');
        }

        // Create order items
        const orderItems = data.items.map(item => ({
            order_id: order.id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            variant_specs: item.variantSpecs || {},
        }));

        const { error: itemsError } = await this.supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            logger.error('Failed to create order items', { orderId: order.id, error: itemsError });
            // Rollback order creation
            await this.supabase.from('orders').delete().eq('id', order.id);
            throw new DatabaseError('Failed to create order items');
        }

        // Reserve stock for each item
        for (const item of data.items) {
            await this.reserveStock(item.productId, item.quantity);
        }

        logger.info('Order created', { orderId: order.id, totalAmount, itemCount: data.items.length });

        // Return order with items
        return this.getById(order.id) as Promise<OrderWithItems>;
    }

    /**
     * Update order status
     */
    async updateStatus(id: string, status: OrderStatus): Promise<Order> {
        const { data, error } = await this.supabase
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update order status', { id, status, error });
            throw new DatabaseError('Failed to update order status', { id, status });
        }

        if (!data) {
            throw new NotFoundError('Order', id);
        }

        logger.info('Order status updated', { orderId: id, status });
        return data;
    }

    /**
     * Cancel order and restore stock
     */
    async cancel(id: string): Promise<Order> {
        const order = await this.getById(id);

        if (!order) {
            throw new NotFoundError('Order', id);
        }

        if (order.status === 'cancelled') {
            throw new ValidationError('Order is already cancelled');
        }

        // Restore stock for each item
        for (const item of order.order_items) {
            await this.restoreStock(item.product_id, item.quantity);
        }

        // Update status to cancelled
        return this.updateStatus(id, 'cancelled');
    }

    /**
     * Get orders for a shop with filters
     */
    async getByShop(shopId: string, filters?: OrderFilters): Promise<OrderWithItems[]> {
        let query = this.supabase
            .from('orders')
            .select(`
                *,
                order_items(*, products(name, image_url)),
                customers(name, phone, facebook_id)
            `)
            .eq('shop_id', shopId);

        // Apply status filter
        if (filters?.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }

        // Apply date filters
        if (filters?.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('created_at', filters.endDate);
        }

        // Order by created_at descending
        query = query.order('created_at', { ascending: false });

        // Apply pagination
        if (filters?.limit) {
            query = query.limit(filters.limit);
        }
        if (filters?.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to get orders', { shopId, filters, error });
            throw new DatabaseError('Failed to get orders', { shopId });
        }

        return (data || []) as OrderWithItems[];
    }

    /**
     * Get orders for a customer
     */
    async getByCustomer(customerId: string, limit?: number): Promise<OrderWithItems[]> {
        let query = this.supabase
            .from('orders')
            .select(`
                *,
                order_items(*, products(name, image_url))
            `)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to get customer orders', { customerId, error });
            throw new DatabaseError('Failed to get customer orders', { customerId });
        }

        return (data || []) as OrderWithItems[];
    }

    /**
     * Reserve stock for a product
     */
    private async reserveStock(productId: string, quantity: number): Promise<void> {
        // Try RPC first (atomic operation)
        const { error } = await this.supabase.rpc('reserve_stock', {
            p_product_id: productId,
            p_quantity: quantity,
        });

        if (error) {
            logger.warn('reserve_stock RPC failed, using fallback', { productId, error: error.message });

            // Fallback: fetch current value then update
            const { data: product, error: fetchError } = await this.supabase
                .from('products')
                .select('reserved_stock')
                .eq('id', productId)
                .single();

            if (fetchError) {
                logger.warn('Could not fetch product for stock reservation', { productId, error: fetchError });
                return;
            }

            const currentReserved = product?.reserved_stock || 0;
            const { error: updateError } = await this.supabase
                .from('products')
                .update({ reserved_stock: currentReserved + quantity })
                .eq('id', productId);

            if (updateError) {
                logger.warn('Could not reserve stock (fallback)', { productId, quantity, error: updateError });
            } else {
                logger.info('Stock reserved via fallback', { productId, quantity, newReserved: currentReserved + quantity });
            }
        }
    }

    /**
     * Restore stock for a product (on cancellation)
     */
    private async restoreStock(productId: string, quantity: number): Promise<void> {
        const { error } = await this.supabase.rpc('restore_stock', {
            p_product_id: productId,
            p_quantity: quantity,
        });

        if (error) {
            logger.warn('Could not restore stock', { productId, quantity, error });
        }
    }

    /**
     * Get today's order stats for a shop
     */
    async getTodayStats(shopId: string): Promise<{
        count: number;
        totalAmount: number;
        pendingCount: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await this.supabase
            .from('orders')
            .select('id, total_amount, status')
            .eq('shop_id', shopId)
            .gte('created_at', today.toISOString());

        if (error) {
            logger.error('Failed to get today stats', { shopId, error });
            throw new DatabaseError('Failed to get order stats', { shopId });
        }

        const orders = data || [];
        return {
            count: orders.length,
            totalAmount: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
            pendingCount: orders.filter(o => o.status === 'pending').length,
        };
    }
}

// Export singleton instance
export const orderService = new OrderService();
