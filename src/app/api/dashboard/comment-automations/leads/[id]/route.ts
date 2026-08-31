import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = ['new', 'contacted', 'converted'] as const;
type LeadStatus = (typeof ALLOWED_STATUS)[number];

/**
 * Resolve the shop for the authenticated user.
 *
 * SECURITY: x-shop-id is attacker-controllable and this route writes through the
 * service-role client (RLS bypass), so the header shop MUST be verified against
 * the user before it is trusted. Mirrors the guard in ../analytics/route.ts.
 */
async function getShopId(request: NextRequest): Promise<string | null> {
    const userId = await getAuthUser();
    if (!userId) return null;

    const supabase = supabaseAdmin();
    const headerShopId = request.headers.get('x-shop-id');
    if (headerShopId) {
        const { data } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', userId)
            .eq('id', headerShopId)
            .maybeSingle();
        return data?.id ?? null;
    }

    const { data } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    return data?.id || null;
}

/**
 * Set a captured comment lead's status.
 *
 * `comment_leads.status` had a CHECK constraint and a UI that told the broker to
 * "filter to Алдсан and contact them by hand" — but nothing in the codebase ever
 * wrote the column, so the same thirty numbers came back untouched every
 * session. This is the write path that lets the list drain.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const status = body?.status as LeadStatus | undefined;

        if (!status || !ALLOWED_STATUS.includes(status)) {
            return NextResponse.json(
                { error: `status нь ${ALLOWED_STATUS.join(' | ')} байх ёстой` },
                { status: 400 },
            );
        }

        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('comment_leads')
            .update({ status })
            .eq('id', id)
            .eq('shop_id', shopId)
            .select('id, status')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: 'Lead олдсонгүй' }, { status: 404 });
        }

        return NextResponse.json({ lead: data });
    } catch (error: unknown) {
        logger.error('comment lead status update failed', { error: String(error) });
        return NextResponse.json({ error: 'Хадгалахад алдаа гарлаа' }, { status: 500 });
    }
}
