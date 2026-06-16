import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// POST /api/team/accept — нэвтэрсэн хэрэглэгч урилгыг хүлээн авна
export async function POST(request: Request) {
    try {
        // Нэвтэрсэн хэрэглэгчийн id + имэйл (auth context)
        const authClient = await createSupabaseServerClient();
        const { data: { user } } = await authClient.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
        }

        const body = await request.json();
        const token = String(body.token || '').trim();
        if (!token) {
            return NextResponse.json({ error: 'Урилгын token дутуу байна' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data: invite, error: fetchErr } = await supabase
            .from('shop_members')
            .select('id, email, role, status, expires_at, shop_id')
            .eq('invite_token', token)
            .eq('status', 'pending')
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!invite) {
            return NextResponse.json({ error: 'Урилга олдсонгүй эсвэл аль хэдийн ашиглагдсан' }, { status: 404 });
        }

        if (new Date(invite.expires_at).getTime() < Date.now()) {
            return NextResponse.json({ error: 'Урилгын хугацаа дууссан' }, { status: 410 });
        }

        // Аюулгүй байдал: нэвтэрсэн хэрэглэгчийн имэйл = урилгын имэйл байх ёстой.
        const userEmail = (user.email || '').toLowerCase();
        if (!userEmail || userEmail !== invite.email.toLowerCase()) {
            return NextResponse.json(
                { error: `Энэ урилга ${invite.email} хаягт илгээгдсэн. Тухайн хаягаараа нэвтэрнэ үү.` },
                { status: 403 },
            );
        }

        // Гишүүнчлэлийг идэвхжүүлж, token-ийг устгана.
        const { error: updateErr } = await supabase
            .from('shop_members')
            .update({
                user_id: user.id,
                status: 'active',
                accepted_at: new Date().toISOString(),
                invite_token: null,
            })
            .eq('id', invite.id);
        if (updateErr) throw updateErr;

        return NextResponse.json({
            success: true,
            shopId: invite.shop_id,
            role: invite.role,
        });
    } catch (error) {
        logger.error('Accept invite API error:', { error });
        return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
    }
}
