import { NextResponse } from 'next/server';
import { getAuthUserShopAccess } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { getPack } from '@/lib/industry-packs/registry';
import { listShopAutomations, loadShopBusinessType } from '@/lib/operator/settings';
import { logger } from '@/lib/utils/logger';

// GET /api/dashboard/automations — дэлгүүрийн салбарын automation-ууд + хүлээгдэж буй даалгаврын тоо
export async function GET() {
    try {
        const access = await getAuthUserShopAccess();
        if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const shopId = access.shop.id;
        const businessType = await loadShopBusinessType(shopId);
        const [automations, pending] = await Promise.all([
            listShopAutomations(shopId, businessType),
            supabaseAdmin()
                .from('agent_runs')
                .select('id', { count: 'exact', head: true })
                .eq('shop_id', shopId)
                .eq('status', 'awaiting_approval'),
        ]);

        const pack = getPack(businessType);
        return NextResponse.json({
            pack: pack ? { id: pack.id, label: pack.meta.label } : null,
            automations,
            pendingCount: pending.count ?? 0,
        });
    } catch (error: unknown) {
        logger.error('Automations GET error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: 'Failed to load automations' }, { status: 500 });
    }
}
