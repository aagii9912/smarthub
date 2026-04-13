/**
 * Stock Service - Handles stock deduction, release, and low stock alerts
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';

/** Products with stock at or below this threshold trigger alerts */
const LOW_STOCK_THRESHOLD = 3;

/**
 * Deduct stock when order is confirmed
 * - Decrements `stock` by ordered quantity
 * - Decrements `reserved_stock` by ordered quantity (was reserved at checkout)
 */
export async function deductStockForOrder(orderId: string): Promise<void> {
    const supabase = supabaseAdmin();

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);

    if (!orderItems || orderItems.length === 0) {
        logger.warn('No order items found for stock deduction:', { orderId });
        return;
    }

    // Get shop_id from the order
    const { data: order } = await supabase
        .from('orders')
        .select('shop_id')
        .eq('id', orderId)
        .single();

    await Promise.all(orderItems.map(async (item) => {
        const { data: product } = await supabase
            .from('products')
            .select('stock, reserved_stock, name')
            .eq('id', item.product_id)
            .single();

        if (product) {
            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            const newReserved = Math.max(0, (product.reserved_stock || 0) - item.quantity);

            await supabase
                .from('products')
                .update({ stock: newStock, reserved_stock: newReserved })
                .eq('id', item.product_id);

            // Check for low stock after deduction
            if (newStock <= LOW_STOCK_THRESHOLD && newStock > 0 && order?.shop_id) {
                await sendPushNotification(order.shop_id, {
                    title: '⚠️ Нөөц бага байна!',
                    body: `"${product.name}" — зөвхөн ${newStock} ширхэг үлдсэн`,
                    url: '/dashboard/products',
                    tag: `low-stock-${item.product_id}`,
                });
                logger.warn('Low stock alert:', { product: product.name, remaining: newStock });
            } else if (newStock === 0 && order?.shop_id) {
                await sendPushNotification(order.shop_id, {
                    title: '🔴 Бараа дууслаа!',
                    body: `"${product.name}" бүрэн дууссан. Нөхөн оруулна уу.`,
                    url: '/dashboard/products',
                    tag: `out-of-stock-${item.product_id}`,
                });
                logger.warn('Out of stock alert:', { product: product.name });
            }
        }
    }));

    logger.info('Stock deducted for order:', { orderId, items: orderItems.length });
}

/**
 * Release reserved stock when order is cancelled
 * - Decrements `reserved_stock` only (stock stays the same)
 */
export async function releaseStockForOrder(orderId: string): Promise<void> {
    const supabase = supabaseAdmin();

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);

    if (!orderItems || orderItems.length === 0) return;

    await Promise.all(orderItems.map(async (item) => {
        const { data: product } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('id', item.product_id)
            .single();

        if (product) {
            const newReserved = Math.max(0, (product.reserved_stock || 0) - item.quantity);

            await supabase
                .from('products')
                .update({ reserved_stock: newReserved })
                .eq('id', item.product_id);
        }
    }));

    logger.info('Reserved stock released for cancelled order:', { orderId });
}

/**
 * Check low stock for a specific shop
 */
export async function checkLowStock(shopId: string): Promise<{
    alerts: Array<{ productId: string; name: string; stock: number; reserved: number }>;
}> {
    const supabase = supabaseAdmin();

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, stock, reserved_stock')
        .eq('shop_id', shopId)
        .lte('stock', LOW_STOCK_THRESHOLD)
        .gt('stock', -1); // Include 0 stock items

    if (error || !products) {
        return { alerts: [] };
    }

    return {
        alerts: products.map(p => ({
            productId: p.id,
            name: p.name,
            stock: p.stock || 0,
            reserved: p.reserved_stock || 0,
        })),
    };
}

/**
 * Check low stock across ALL shops (for cron job)
 * Sends push notifications for critical items
 */
export async function checkAllShopsLowStock(): Promise<{ alertCount: number }> {
    const supabase = supabaseAdmin();

    // Find all products with low stock across all active shops
    const { data: lowStockProducts, error } = await supabase
        .from('products')
        .select('id, name, stock, reserved_stock, shop_id')
        .lte('stock', LOW_STOCK_THRESHOLD)
        .gt('stock', -1);

    if (error || !lowStockProducts || lowStockProducts.length === 0) {
        return { alertCount: 0 };
    }

    // Group by shop and send batch notifications
    const shopAlerts = new Map<string, string[]>();
    for (const product of lowStockProducts) {
        const existing = shopAlerts.get(product.shop_id) || [];
        existing.push(`${product.name} (${product.stock})`);
        shopAlerts.set(product.shop_id, existing);
    }

    for (const [shopId, products] of shopAlerts) {
        const count = products.length;
        await sendPushNotification(shopId, {
            title: `⚠️ ${count} бараа нөөц бага`,
            body: products.slice(0, 3).join(', ') + (count > 3 ? ` +${count - 3}` : ''),
            url: '/dashboard/products',
            tag: `low-stock-daily-${shopId}`,
        });
    }

    logger.info(`Low stock check: ${lowStockProducts.length} products across ${shopAlerts.size} shops`);
    return { alertCount: lowStockProducts.length };
}
