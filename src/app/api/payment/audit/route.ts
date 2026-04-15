import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/payment/audit
 * Returns payment audit logs for the authenticated shop owner.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 50, max: 100)
 *   - from (ISO date string)
 *   - to (ISO date string)
 *   - action (filter by action: created, paid, failed, expired, refunded)
 *   - order_id (filter by specific order)
 */
export async function GET(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const action = searchParams.get('action');
        const orderId = searchParams.get('order_id');

        const offset = (page - 1) * limit;
        const supabase = supabaseAdmin();

        // Build query
        let query = supabase
            .from('payment_audit_logs')
            .select(`
                id,
                payment_id,
                order_id,
                action,
                old_status,
                new_status,
                amount,
                payment_method,
                actor,
                actor_id,
                metadata,
                notes,
                created_at
            `, { count: 'exact' })
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (from) {
            query = query.gte('created_at', from);
        }
        if (to) {
            query = query.lte('created_at', to);
        }
        if (action) {
            query = query.eq('action', action);
        }
        if (orderId) {
            query = query.eq('order_id', orderId);
        }

        const { data: logs, error, count } = await query;

        if (error) {
            logger.error('Audit logs fetch error:', { error: error.message });
            throw error;
        }

        return NextResponse.json({
            logs: logs || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        });
    } catch (error: unknown) {
        logger.error('Payment audit error:', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
            { status: 500 }
        );
    }
}
