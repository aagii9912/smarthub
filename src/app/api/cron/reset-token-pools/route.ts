/**
 * Token Pool Reset Cron
 *
 * Runs daily. Rolls the per-user 30-day token (credit) pool over for any user
 * whose billing window has elapsed. The RPC `reset_user_token_pool_if_due` is
 * idempotent: it only acts on rows where period_anchor_at is NULL or > 30 days
 * old.
 *
 * NOTE: This previously also enforced 3-day trial expiry. Trials were retired
 * when Lite became a free plan (see migration 20260625140000), so only the
 * token-pool reset remains.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    try {
        if (process.env.NODE_ENV === 'production' && CRON_SECRET) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${CRON_SECRET}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabase = supabaseAdmin();
        const nowIso = new Date().toISOString();
        const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Roll the per-user token pool over for any user whose 30-day window has
        // elapsed. The RPC is idempotent (acts only on due rows).
        const { data: dueSubs, error: dueErr } = await supabase
            .from('subscriptions')
            .select('user_id')
            .in('status', ['active', 'pending', 'past_due'])
            .or(`period_anchor_at.is.null,period_anchor_at.lt.${thirtyDaysAgoIso}`);

        let resetCount = 0;
        if (dueErr) {
            logger.error('reset-token-pools: failed to enumerate subs', { error: dueErr.message });
            return NextResponse.json({ error: dueErr.message }, { status: 500 });
        } else if (dueSubs && dueSubs.length > 0) {
            const uniqueUserIds = Array.from(new Set(dueSubs.map(s => s.user_id).filter(Boolean) as string[]));
            for (const uid of uniqueUserIds) {
                const { error: rpcErr } = await supabase.rpc('reset_user_token_pool_if_due', { p_user_id: uid });
                if (!rpcErr) resetCount++;
            }
            if (resetCount > 0) {
                logger.success(`Reset token pool for ${resetCount} user(s)`);
            }
        }

        return NextResponse.json({
            success: true,
            token_pool_resets: resetCount,
            checked_at: nowIso,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('reset-token-pools crashed', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
