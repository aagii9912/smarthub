import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// GET /api/team/invite/[token] — урилгын мэдээлэл (нийтийн, token-оор)
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> },
) {
    try {
        const { token } = await params;
        if (!token) {
            return NextResponse.json({ error: 'Урилга олдсонгүй' }, { status: 404 });
        }

        const supabase = supabaseAdmin();

        const { data: invite, error } = await supabase
            .from('shop_members')
            .select('id, email, role, status, expires_at, shop_id, shops!inner(name)')
            .eq('invite_token', token)
            .eq('status', 'pending')
            .maybeSingle();

        if (error) throw error;
        if (!invite) {
            return NextResponse.json({ error: 'Урилга олдсонгүй эсвэл хүчингүй болсон' }, { status: 404 });
        }

        if (new Date(invite.expires_at).getTime() < Date.now()) {
            return NextResponse.json({ error: 'Урилгын хугацаа дууссан' }, { status: 410 });
        }

        // Энэ имэйлээр аккаунт байгаа эсэх (бүртгүүлэх эсвэл нэвтрэхийг UI-д шийднэ).
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('email', invite.email)
            .maybeSingle();

        const shop = Array.isArray(invite.shops) ? invite.shops[0] : invite.shops;

        return NextResponse.json({
            invite: {
                email: invite.email,
                role: invite.role,
                shopName: (shop as { name?: string } | null)?.name ?? null,
                accountExists: !!profile,
            },
        });
    } catch (error) {
        logger.error('Invite info API error:', { error });
        return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
    }
}
