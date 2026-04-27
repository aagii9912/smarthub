/**
 * Trial Expiry Cron
 *
 * Runs daily. Finds shops where:
 *   - subscription_status = 'trial'
 *   - trial_ends_at < NOW()
 *
 * Flips them to:
 *   - subscription_status = 'expired_trial'
 *   - trial_expired_at = NOW()
 *   - is_ai_active = false  (belt-and-suspenders: stops AI immediately)
 *
 * The runtime trial gate in AIRouter.routeToAI also blocks expired trials
 * within the gap between actual expiry and this cron firing.
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

        const { data: expired, error } = await supabase
            .from('shops')
            .update({
                subscription_status: 'expired_trial',
                trial_expired_at: nowIso,
                is_ai_active: false,
            })
            .eq('subscription_status', 'trial')
            .lt('trial_ends_at', nowIso)
            .select('id, name, user_id, trial_ends_at');

        if (error) {
            logger.error('Failed to expire trials', { error: error.message });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const count = expired?.length || 0;

        if (count > 0) {
            logger.success(`Expired ${count} trial shop(s)`, {
                shopIds: expired?.map(s => s.id),
            });
        }

        return NextResponse.json({
            success: true,
            expired_count: count,
            expired_shops: expired?.map(s => ({ id: s.id, name: s.name })) ?? [],
            checked_at: nowIso,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('check-trial-expiry crashed', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
