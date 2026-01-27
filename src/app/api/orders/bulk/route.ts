import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

const bulkUpdateSchema = z.object({
    orderIds: z.array(z.string().uuid()),
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
});

export async function POST(request: NextRequest) {
    try {
        const authShop = await getClerkUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = bulkUpdateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({
                error: 'Validation failed',
                details: validation.error.issues
            }, { status: 400 });
        }

        const { orderIds, status } = validation.data;
        const supabase = supabaseAdmin();
        const shopId = authShop.id;

        if (orderIds.length === 0) {
            return NextResponse.json({ success: true, updatedCount: 0 });
        }

        // Update orders
        const { data: updatedOrders, error } = await supabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .in('id', orderIds)
            .eq('shop_id', shopId) // Ensure ownership
            .select();

        if (error) throw error;

        // TODO: If 'delivered', we should theoretically update stats for all of them, 
        // but the `update_customer_stats_manual` RPC takes single ID. 
        // For bulk efficiency we might skip that or loop parallel. 
        // Given the 'bulk' nature, triggering side effects for 50 orders might be heavy.
        // For MVP, we will only do the status update.

        return NextResponse.json({
            success: true,
            updatedCount: updatedOrders?.length || 0,
            message: `${updatedOrders?.length || 0} захиалга шинэчлэгдлээ`
        });

    } catch (error: any) {
        logger.error('Bulk update error:', { error });
        return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
    }
}
