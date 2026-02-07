import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cleanup-orders
 * Cron job to expire unpaid orders older than 30 minutes.
 * Can be called by Vercel Cron or Supabase Edge Functions.
 */
export async function GET(request: NextRequest) {
    // SEC-7: Verify Authorization header for cron security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = supabaseAdmin();
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    try {
        // 1. Find expired 'pending' orders
        const { data: expiredOrders, error: findError } = await supabase
            .from('orders')
            .select('id, shop_id, order_items(product_id, quantity)')
            .eq('status', 'pending')
            .lt('created_at', thirtyMinutesAgo);

        if (findError) throw findError;

        if (!expiredOrders || expiredOrders.length === 0) {
            return NextResponse.json({ message: 'No expired orders found', count: 0 });
        }

        logger.info(`Found ${expiredOrders.length} expired orders to clean up.`);

        // 2. Process all orders (PERF-2: batch instead of N+1)
        let successCount = 0;

        // Collect all stock restoration operations
        const stockUpdates: Array<{ productId: string; quantity: number }> = [];
        for (const order of expiredOrders) {
            if (order.order_items && order.order_items.length > 0) {
                for (const item of order.order_items) {
                    stockUpdates.push({ productId: item.product_id, quantity: item.quantity });
                }
            }
        }

        // Batch restore stock using Promise.all
        if (stockUpdates.length > 0) {
            await Promise.all(stockUpdates.map(async ({ productId, quantity }) => {
                const { data: product } = await supabase
                    .from('products')
                    .select('reserved_stock')
                    .eq('id', productId)
                    .single();

                if (product) {
                    const newReserved = Math.max(0, (product.reserved_stock || 0) - quantity);
                    await supabase
                        .from('products')
                        .update({ reserved_stock: newReserved })
                        .eq('id', productId);
                }
            }));
        }

        // Batch cancel all expired orders
        const orderIds = expiredOrders.map(o => o.id);
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'cancelled',
                notes: 'Auto-expired: Payment not received in 30 mins'
            })
            .in('id', orderIds);

        successCount = updateError ? 0 : orderIds.length;

        return NextResponse.json({
            success: true,
            message: `Successfully expired ${successCount} orders`,
            processed: expiredOrders.length
        });

    } catch (error: any) {
        logger.error('Cleanup Cron Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
