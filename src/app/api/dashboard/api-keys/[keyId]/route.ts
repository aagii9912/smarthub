/**
 * DELETE /api/dashboard/api-keys/[keyId] — API key-г цуцлах (revoke)
 *
 * Устгахын оронд `revoked_at` тавьж, resolveApiKey түүнийг шүүнэ. Ингэснээр
 * түүх/audit хадгалагдана. Session-auth + `settings:write` эрх шаардана.
 */

import { NextResponse } from 'next/server';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

function handleError(error: unknown) {
    if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('API key revoke error', { error });
    return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ keyId: string }> },
) {
    try {
        const { keyId } = await params;
        const { shop } = await requirePermission('settings:write');
        const supabase = supabaseAdmin();

        // Түлхүүр тухайн дэлгүүрт харьяалагдахыг шалгана.
        const { data: existing, error: fetchErr } = await supabase
            .from('api_keys')
            .select('id, revoked_at')
            .eq('id', keyId)
            .eq('shop_id', shop.id)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!existing) {
            return NextResponse.json({ error: 'Түлхүүр олдсонгүй' }, { status: 404 });
        }
        if ((existing as { revoked_at?: string | null }).revoked_at) {
            return NextResponse.json({ success: true, alreadyRevoked: true });
        }

        const { error } = await supabase
            .from('api_keys')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', keyId)
            .eq('shop_id', shop.id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}
