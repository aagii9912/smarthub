/**
 * Stock Service - Handles stock deduction, release, and low stock alerts
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';

/** Products with stock at or below this threshold trigger alerts */
const LOW_STOCK_THRESHOLD = 3;

/**
 * Deduct stock when order is confirmed.
 *
 * Delegates to the `atomic_claim_stock_deduction` RPC which atomically:
 *   - Claims the deduction via orders.stock_deducted_at (idempotent)
 *   - Locks product rows in stable order to prevent deadlocks
 *   - Decrements both `stock` and `reserved_stock` (and variant stock)
 *
 * Safe to call multiple times for the same order — second call returns
 * false and is a no-op. This makes it robust against webhook + manual-check
 * double-firing.
 */
export async function deductStockForOrder(orderId: string): Promise<void> {
    const supabase = supabaseAdmin();

    const { data: claimed, error } = await supabase
        .rpc('atomic_claim_stock_deduction', { p_order_id: orderId });

    if (error) {
        logger.error('atomic_claim_stock_deduction failed:', {
            orderId,
            error: error.message,
        });
        throw error;
    }

    if (claimed === false) {
        logger.info('Stock already deducted for order (idempotent skip):', { orderId });
        return;
    }

    logger.info('Stock deducted for order:', { orderId });

    await notifyLowStockAfterDeduction(orderId).catch((err: unknown) => {
        logger.warn('Low-stock notification failed (non-critical):', {
            orderId,
            error: err instanceof Error ? err.message : String(err),
        });
    });
}

/**
 * Fires low-stock / out-of-stock push notifications after deduction.
 * Runs outside the deduction transaction so notification failures never
 * block stock updates.
 */
async function notifyLowStockAfterDeduction(orderId: string): Promise<void> {
    const supabase = supabaseAdmin();

    const { data: order } = await supabase
        .from('orders')
        .select('shop_id')
        .eq('id', orderId)
        .single();

    if (!order?.shop_id) return;

    const { data: items } = await supabase
        .from('order_items')
        .select('product_id, products!inner(id, name, stock)')
        .eq('order_id', orderId);

    if (!items || items.length === 0) return;

    for (const item of items) {
        const product = item.products as unknown as { id: string; name: string; stock: number | null } | null;
        if (!product) continue;

        const remaining = product.stock ?? 0;

        if (remaining === 0) {
            await sendPushNotification(order.shop_id, {
                title: '🔴 Бараа дууслаа!',
                body: `"${product.name}" бүрэн дууссан. Нөхөн оруулна уу.`,
                url: '/dashboard/products',
                tag: `out-of-stock-${product.id}`,
            });
            logger.warn('Out of stock alert:', { product: product.name });
        } else if (remaining <= LOW_STOCK_THRESHOLD) {
            await sendPushNotification(order.shop_id, {
                title: '⚠️ Нөөц бага байна!',
                body: `"${product.name}" — зөвхөн ${remaining} ширхэг үлдсэн`,
                url: '/dashboard/products',
                tag: `low-stock-${product.id}`,
            });
            logger.warn('Low stock alert:', { product: product.name, remaining });
        }
    }
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
