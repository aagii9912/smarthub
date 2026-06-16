import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { sendTeamInviteEmail } from '@/lib/email/email';
import { logger } from '@/lib/utils/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

function handleError(error: unknown) {
    if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Team resend API error:', { error });
    return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
}

// POST /api/dashboard/team/members/[memberId]/resend — урилгыг дахин илгээх
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ memberId: string }> },
) {
    try {
        const { memberId } = await params;
        const { shop, userId } = await requirePermission('team:manage');
        const supabase = supabaseAdmin();

        const { data: member, error: fetchErr } = await supabase
            .from('shop_members')
            .select('id, email, role, status')
            .eq('id', memberId)
            .eq('shop_id', shop.id)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!member || member.status !== 'pending') {
            return NextResponse.json({ error: 'Хүлээгдэж буй урилга олдсонгүй' }, { status: 404 });
        }

        // Token + хугацааг шинэчилнэ.
        const token = randomUUID();
        const { error } = await supabase
            .from('shop_members')
            .update({
                invite_token: token,
                invited_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('id', memberId)
            .eq('shop_id', shop.id);
        if (error) throw error;

        const { data: ownerProfile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', userId)
            .maybeSingle();

        const inviteUrl = `${APP_URL}/invite/${token}`;
        const emailSent = await sendTeamInviteEmail({
            to: member.email,
            shopName: shop.name,
            inviterName: ownerProfile?.full_name || shop.owner_name || 'Дэлгүүрийн эзэн',
            role: member.role as 'admin' | 'staff',
            inviteUrl,
        });

        return NextResponse.json({ success: true, inviteUrl, emailSent });
    } catch (error) {
        return handleError(error);
    }
}
