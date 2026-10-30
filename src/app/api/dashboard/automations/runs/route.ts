import { NextResponse } from 'next/server';
import { getAuthUserShopAccess } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// GET /api/dashboard/automations/runs?view=inbox|log
//   inbox — эзний батлах мессеж, "залгах" даалгаврууд (awaiting_approval)
//   log   — сүүлийн 50 үйлдэл
export async function GET(request: Request) {
    try {
        const access = await getAuthUserShopAccess();
        if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const view = new URL(request.url).searchParams.get('view') === 'log' ? 'log' : 'inbox';
        let query = supabaseAdmin()
            .from('agent_runs')
            .select('id, agent_slug, status, subject_type, subject_id, payload, result, error, created_at, finished_at')
            .eq('shop_id', access.shop.id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (view === 'inbox') query = query.eq('status', 'awaiting_approval');

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ runs: data ?? [] });
    } catch (error: unknown) {
        logger.error('Automation runs GET error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to load runs' }, { status: 500 });
    }
}
