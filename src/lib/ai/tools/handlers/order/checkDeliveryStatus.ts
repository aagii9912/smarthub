/**
 * Check Delivery Status Handler
 * Provides delivery tracking info and ETA for shipped orders
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { CheckDeliveryStatusArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

/** Estimated delivery times by status (in hours) */
const DELIVERY_ESTIMATES: Record<string, { label: string; eta: string; progress: number }> = {
    pending: { label: '⏳ Хүлээгдэж буй', eta: 'Баталгаажсаны дараа 1-3 хоногт', progress: 10 },
    confirmed: { label: '✅ Баталгаажсан', eta: '1-3 хоногийн дотор', progress: 25 },
    processing: { label: '📦 Бэлтгэж байна', eta: '1-2 хоногийн дотор', progress: 50 },
    shipped: { label: '🚚 Хүргэлтэнд гарсан', eta: 'Өнөөдөр эсвэл маргааш', progress: 75 },
    delivered: { label: '✔️ Хүргэгдсэн', eta: 'Хүргэгдсэн', progress: 100 },
    cancelled: { label: '❌ Цуцлагдсан', eta: '-', progress: 0 },
};

export async function executeCheckDeliveryStatus(
    args: CheckDeliveryStatusArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();

    try {
        if (!context.customerId) {
            return { success: false, error: 'Хэрэглэгч тодорхойгүй' };
        }

        let query = supabase
            .from('orders')
            .select('id, status, total_amount, created_at, updated_at, notes, order_items(product_name, quantity)')
            .eq('shop_id', context.shopId)
            .eq('customer_id', context.customerId)
            .in('status', ['confirmed', 'processing', 'shipped', 'delivered', 'paid'])
            .order('created_at', { ascending: false });

        if (args.order_id) {
            query = query.eq('id', args.order_id);
        } else {
            query = query.limit(3);
        }

        const { data: orders, error } = await query;

        if (error) {
            logger.error('Delivery status check failed:', { error });
            return { success: false, error: 'Хүргэлтийн мэдээлэл хайхад алдаа гарлаа' };
        }

        if (!orders || orders.length === 0) {
            return {
                success: true,
                message: 'Хүргэгдэх захиалга одоогоор байхгүй байна. Шинэ захиалга өгсөн бол баталгаажсаны дараа хүргэлт эхэлнэ.',
                data: { deliveries: [] },
            };
        }

        const deliveries = orders.map(order => {
            const statusInfo = DELIVERY_ESTIMATES[order.status] || DELIVERY_ESTIMATES.pending;
            const items = (order.order_items as { product_name: string; quantity: number }[])?.map(
                (item: { product_name: string; quantity: number }) => `${item.product_name} x${item.quantity}`
            ).join(', ') || '';

            // Calculate time since order
            const orderDate = new Date(order.created_at);
            const hoursAgo = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60 * 60));

            return {
                orderId: order.id.substring(0, 8).toUpperCase(),
                status: statusInfo.label,
                eta: statusInfo.eta,
                progress: statusInfo.progress,
                items,
                total: order.total_amount,
                orderedAgo: hoursAgo < 24 ? `${hoursAgo} цагийн өмнө` : `${Math.round(hoursAgo / 24)} өдрийн өмнө`,
            };
        });

        // Build readable message
        const deliveryText = deliveries.map(d =>
            `📦 #${d.orderId}\n` +
            `   Статус: ${d.status}\n` +
            `   Бараа: ${d.items}\n` +
            `   Хүргэлт: ${d.eta}\n` +
            `   Захиалсан: ${d.orderedAgo}`
        ).join('\n\n');

        return {
            success: true,
            message: `Таны хүргэлтийн мэдээлэл:\n\n${deliveryText}`,
            data: { deliveries },
            actions: [
                {
                    type: 'delivery_option',
                    buttons: [
                        {
                            id: 'call_delivery',
                            label: '📞 Хүргэлтийн утас',
                            icon: 'phone',
                            variant: 'secondary',
                            payload: 'CALL_DELIVERY',
                        },
                        {
                            id: 'human_support',
                            label: '👤 Оператор холбох',
                            variant: 'ghost',
                            payload: 'REQUEST_HUMAN',
                        },
                    ],
                },
            ],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Check delivery status error:', { error: errorMessage });
        return { success: false, error: 'Хүргэлтийн статус шалгахад алдаа гарлаа' };
    }
}
