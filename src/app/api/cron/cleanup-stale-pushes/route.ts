/**
 * GET /api/cron/cleanup-stale-pushes
 *
 * Daily cron: prune push_subscriptions rows that have either failed
 * `failure_count >= 3` consecutive sends or sat unused for >14 days. Calls
 * the `cleanup_stale_push_subscriptions()` SQL function added in migration
 * 20260428200000.
 *
 * Auth follows the same pattern as the rest of `/api/cron/*` — bearer
 * matches CRON_SECRET in production; bypass in dev/test.
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
        const { data, error } = await supabase.rpc('cleanup_stale_push_subscriptions');

        if (error) {
            logger.error('cleanup-stale-pushes RPC failed', { error: error.message });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const deleted = typeof data === 'number' ? data : 0;
        logger.info('cleanup-stale-pushes complete', { deleted });
        return NextResponse.json({ success: true, deleted });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('cleanup-stale-pushes unexpected error', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
