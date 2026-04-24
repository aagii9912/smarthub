import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/payment/audit
 * Returns payment audit logs + summary stats for the authenticated shop owner.
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

        // Build list query
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

        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to);
        if (action) query = query.eq('action', action);
        if (orderId) query = query.eq('order_id', orderId);

        const { data: logs, error, count } = await query;

        if (error) {
            logger.error('Audit logs fetch error:', { error: error.message });
            throw error;
        }

        // ── Summary stats within the same filter window ──
        let statsQuery = supabase
            .from('payment_audit_logs')
            .select('action, amount')
            .eq('shop_id', shop.id);
        if (from) statsQuery = statsQuery.gte('created_at', from);
        if (to) statsQuery = statsQuery.lte('created_at', to);
        if (orderId) statsQuery = statsQuery.eq('order_id', orderId);

        const { data: statsRows } = await statsQuery;

        const summary = {
            total: 0,
            paidCount: 0,
            paidAmount: 0,
            failedCount: 0,
            expiredCount: 0,
            refundedCount: 0,
            refundedAmount: 0,
            successRate: 0,
        };

        if (statsRows) {
            summary.total = statsRows.length;
            for (const row of statsRows) {
                const amt = Number(row.amount || 0);
                switch (row.action) {
                    case 'paid':
                        summary.paidCount += 1;
                        summary.paidAmount += amt;
                        break;
                    case 'failed':
                        summary.failedCount += 1;
                        break;
                    case 'expired':
                        summary.expiredCount += 1;
                        break;
                    case 'refunded':
                        summary.refundedCount += 1;
                        summary.refundedAmount += amt;
                        break;
                }
            }
            const settled = summary.paidCount + summary.failedCount + summary.expiredCount;
            summary.successRate = settled > 0 ? Math.round((summary.paidCount / settled) * 100) : 0;
        }

        return NextResponse.json({
            logs: logs || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
            summary,
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

/**
 * POST /api/payment/audit
 * Shop owner-initiated lifecycle actions: mark failed, mark refunded.
 *
 * Body:
 *   - payment_id (required)
 *   - action: 'refund' | 'mark_failed' (required)
 *   - amount?: number (only for refund — defaults to full payment amount)
 *   - reason?: string (free text, stored in metadata + payments table columns)
 *   - failure_code?: string (only for mark_failed)
 */
export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const paymentId = (body?.payment_id as string | undefined)?.trim();
        const action = body?.action as 'refund' | 'mark_failed' | undefined;
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        const failureCode = typeof body?.failure_code === 'string' ? body.failure_code.trim() : '';
        const rawAmount = typeof body?.amount === 'number' ? body.amount : undefined;

        if (!paymentId) {
            return NextResponse.json({ error: 'payment_id is required' }, { status: 400 });
        }
        if (action !== 'refund' && action !== 'mark_failed') {
            return NextResponse.json({ error: 'action must be refund or mark_failed' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Ownership check
        const { data: payment, error: payErr } = await supabase
            .from('payments')
            .select('id, shop_id, order_id, amount, status, payment_method, metadata')
            .eq('id', paymentId)
            .eq('shop_id', shop.id)
            .single();

        if (payErr || !payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        const nowIso = new Date().toISOString();
        const prevMetadata = (payment.metadata as Record<string, unknown>) || {};

        if (action === 'refund') {
            if (payment.status !== 'paid') {
                return NextResponse.json(
                    { error: 'Only paid payments can be refunded' },
                    { status: 400 }
                );
            }
            const originalAmount = Number(payment.amount || 0);
            const refundAmount =
                rawAmount !== undefined && rawAmount > 0 && rawAmount <= originalAmount
                    ? rawAmount
                    : originalAmount;

            const { error: updateErr } = await supabase
                .from('payments')
                .update({
                    status: 'refunded',
                    refund_amount: refundAmount,
                    refunded_at: nowIso,
                    refund_reason: reason || null,
                    metadata: {
                        ...prevMetadata,
                        refund: {
                            amount: refundAmount,
                            reason: reason || null,
                            actor: 'shop_owner',
                            at: nowIso,
                        },
                    },
                })
                .eq('id', payment.id);

            if (updateErr) {
                logger.error('Refund update failed:', { error: updateErr.message });
                throw updateErr;
            }

            // Audit entry with rich metadata
            await supabase.from('payment_audit_logs').insert({
                payment_id: payment.id,
                shop_id: payment.shop_id,
                order_id: payment.order_id,
                action: 'refunded',
                old_status: 'paid',
                new_status: 'refunded',
                amount: refundAmount,
                payment_method: payment.payment_method,
                actor: 'shop_owner',
                metadata: {
                    refund_reason: reason || null,
                    original_amount: originalAmount,
                },
                notes: reason || 'Shop owner initiated refund',
            });

            return NextResponse.json({
                success: true,
                action: 'refund',
                refund_amount: refundAmount,
            });
        }

        // mark_failed
        if (payment.status === 'paid') {
            return NextResponse.json(
                { error: 'Cannot mark a paid payment as failed; refund it instead' },
                { status: 400 }
            );
        }

        const { error: updateErr } = await supabase
            .from('payments')
            .update({
                status: 'failed',
                failure_code: failureCode || null,
                failure_reason: reason || null,
                metadata: {
                    ...prevMetadata,
                    failure: {
                        code: failureCode || null,
                        reason: reason || null,
                        actor: 'shop_owner',
                        at: nowIso,
                    },
                },
            })
            .eq('id', payment.id);

        if (updateErr) {
            logger.error('Mark failed update error:', { error: updateErr.message });
            throw updateErr;
        }

        await supabase.from('payment_audit_logs').insert({
            payment_id: payment.id,
            shop_id: payment.shop_id,
            order_id: payment.order_id,
            action: 'failed',
            old_status: payment.status,
            new_status: 'failed',
            amount: Number(payment.amount || 0),
            payment_method: payment.payment_method,
            actor: 'shop_owner',
            metadata: {
                failure_code: failureCode || null,
                failure_reason: reason || null,
            },
            notes: reason || 'Shop owner marked failed',
        });

        return NextResponse.json({ success: true, action: 'mark_failed' });
    } catch (error: unknown) {
        logger.error('Payment audit POST error:', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Action failed' },
            { status: 500 }
        );
    }
}
