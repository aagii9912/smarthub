/**
 * Order Notification Service
 * Notifies the customer (Messenger / Instagram) when an order status changes.
 * Goes through deliver(): plain text inside the 24-hour window, a Utility
 * Message template outside it (Messenger only). The removed
 * POST_PURCHASE_UPDATE tag is no longer used. No owner push fallback — the
 * owner triggered the status change themselves.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { deliver, type DeliverResult } from '@/lib/operator/deliver';

// Mongolian status messages
const STATUS_MESSAGES: Record<string, string> = {
    confirmed: '✅ Таны #{orderId} захиалга баталгаажлаа! Бид удахгүй бэлтгэж эхэлнэ.',
    processing: '📦 Таны #{orderId} захиалга бэлтгэгдэж байна.',
    shipped: '🚚 Таны #{orderId} захиалга хүргэлтэнд гарлаа! Удахгүй хүргэгдэнэ.',
    delivered: '🎉 Таны #{orderId} захиалга амжилттай хүргэгдлээ! Баярлалаа 🙏',
    cancelled: '❌ Таны #{orderId} захиалга цуцлагдлаа. Асуух зүйл байвал бидэнтэй холбогдоорой.',
};

// `{{status}}` value for the order_status Utility template
const STATUS_LABELS: Record<string, string> = {
    confirmed: 'баталгаажсан',
    processing: 'бэлтгэгдэж байна',
    shipped: 'хүргэлтэнд гарсан',
    delivered: 'хүргэгдсэн',
    cancelled: 'цуцлагдсан',
};

interface NotificationResult {
    success: boolean;
    error?: string;
    delivery?: DeliverResult;
}

/**
 * Send order status notification to the customer
 */
export async function sendOrderStatusNotification(
    customerId: string,
    orderId: string,
    status: string,
    shopId: string
): Promise<NotificationResult> {
    try {
        const messageTemplate = STATUS_MESSAGES[status];
        if (!messageTemplate) {
            logger.info(`[OrderNotification] No message template for status: ${status}`);
            return { success: true }; // Not all statuses need notifications
        }

        const orderRef = orderId.slice(0, 8);
        const delivery = await deliver({
            shopId,
            customerId,
            operation: 'order_status',
            text: messageTemplate.replace('#{orderId}', orderRef),
            utility: {
                purpose: 'order_status',
                params: { order_ref: orderRef, status: STATUS_LABELS[status] },
            },
        });

        logger.info(`[OrderNotification] "${status}" → ${delivery.status}`, { orderId, customerId });

        return { success: delivery.status !== 'undelivered', delivery };
    } catch (error: unknown) {
        logger.error('[OrderNotification] Failed to send notification:', { error });
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Send notifications for bulk order updates (async, non-blocking)
 */
export async function sendBulkOrderNotifications(
    orderIds: string[],
    status: string,
    shopId: string
): Promise<void> {
    // Run in background, don't await
    Promise.all(
        orderIds.map(async (orderId) => {
            try {
                const supabase = supabaseAdmin();
                const { data: order } = await supabase
                    .from('orders')
                    .select('customer_id')
                    .eq('id', orderId)
                    .single();

                if (order?.customer_id) {
                    await sendOrderStatusNotification(order.customer_id, orderId, status, shopId);
                }
            } catch (error: unknown) {
                logger.error(`[BulkNotification] Error for order ${orderId}:`, { error });
            }
        })
    ).catch((error) => {
        logger.error('[BulkNotification] Bulk notification failed:', { error });
    });
}
