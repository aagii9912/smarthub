import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { logger } from '@/lib/utils/logger';
import type { ShopRole } from '@/types/database';

function handleError(error: unknown) {
    if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Team member API error:', { error });
    return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
}

/**
 * admin эрхтэй урьсан хүн зөвхөн staff гишүүнийг л өөрчилж/устгаж чадна.
 * Эзэн (owner) бүгдийг хийнэ. Admin гишүүнд хүрэх эрхийг зөвхөн эзэнд олгоно.
 */
function assertCanManage(inviterRole: ShopRole, targetRole: ShopRole) {
    if (inviterRole === 'owner') return;
    // inviterRole === 'admin'
    if (targetRole !== 'staff') {
        throw new ForbiddenError('Зөвхөн дэлгүүрийн эзэн админ эрхтэй гишүүнийг өөрчилж чадна');
    }
}

// PATCH /api/dashboard/team/members/[memberId] — гишүүний эрхийг солих
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ memberId: string }> },
) {
    try {
        const { memberId } = await params;
        const { shop, role: inviterRole } = await requirePermission('team:manage');
        const supabase = supabaseAdmin();

        const body = await request.json();
        const newRole = body.role as ShopRole;
        if (newRole !== 'admin' && newRole !== 'staff') {
            return NextResponse.json({ error: 'Эрх буруу байна' }, { status: 400 });
        }

        const { data: member, error: fetchErr } = await supabase
            .from('shop_members')
            .select('id, role, status')
            .eq('id', memberId)
            .eq('shop_id', shop.id)
            .neq('status', 'revoked')
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!member) {
            return NextResponse.json({ error: 'Гишүүн олдсонгүй' }, { status: 404 });
        }

        // Одоогийн болон шинэ эрх хоёуланд нь удирдах эрхтэй эсэхийг шалгана.
        assertCanManage(inviterRole, member.role as ShopRole);
        assertCanManage(inviterRole, newRole);

        const { data: updated, error } = await supabase
            .from('shop_members')
            .update({ role: newRole })
            .eq('id', memberId)
            .eq('shop_id', shop.id)
            .select('id, email, role, status')
            .single();
        if (error) throw error;

        return NextResponse.json({ member: updated });
    } catch (error) {
        return handleError(error);
    }
}

// DELETE /api/dashboard/team/members/[memberId] — гишүүнийг хасах (revoke)
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ memberId: string }> },
) {
    try {
        const { memberId } = await params;
        const { shop, role: inviterRole } = await requirePermission('team:manage');
        const supabase = supabaseAdmin();

        const { data: member, error: fetchErr } = await supabase
            .from('shop_members')
            .select('id, role, status')
            .eq('id', memberId)
            .eq('shop_id', shop.id)
            .neq('status', 'revoked')
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!member) {
            return NextResponse.json({ error: 'Гишүүн олдсонгүй' }, { status: 404 });
        }

        assertCanManage(inviterRole, member.role as ShopRole);

        const { error } = await supabase
            .from('shop_members')
            .update({ status: 'revoked', invite_token: null })
            .eq('id', memberId)
            .eq('shop_id', shop.id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleError(error);
    }
}
