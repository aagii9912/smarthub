import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { sendTeamInviteEmail } from '@/lib/email/email';
import { logger } from '@/lib/utils/logger';
import type { ShopRole } from '@/types/database';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

function handleError(error: unknown) {
    if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Team members API error:', { error });
    return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
}

// GET /api/dashboard/team/members — багийн гишүүд + хүлээгдэж буй урилгууд (+ synthetic owner)
export async function GET() {
    try {
        const { shop } = await requirePermission('team:manage');
        const supabase = supabaseAdmin();

        // Эзний мэдээлэл (synthetic owner мөр)
        const { data: ownerShop } = await supabase
            .from('shops')
            .select('user_id, owner_name')
            .eq('id', shop.id)
            .single();

        let ownerRow: Record<string, unknown> | null = null;
        if (ownerShop?.user_id) {
            const { data: ownerProfile } = await supabase
                .from('user_profiles')
                .select('id, email, full_name')
                .eq('id', ownerShop.user_id)
                .maybeSingle();
            ownerRow = {
                id: `owner:${ownerShop.user_id}`,
                user_id: ownerShop.user_id,
                email: ownerProfile?.email ?? null,
                name: ownerProfile?.full_name ?? ownerShop.owner_name ?? null,
                role: 'owner' as ShopRole,
                status: 'active',
                is_owner: true,
            };
        }

        const { data: members, error } = await supabase
            .from('shop_members')
            .select('id, user_id, email, role, status, invited_at, accepted_at, expires_at, invite_token')
            .eq('shop_id', shop.id)
            .neq('status', 'revoked')
            .order('invited_at', { ascending: true });
        if (error) throw error;

        // Гишүүдийн нэрийг хавсаргах (accept хийсэн бол user_profiles-аас)
        const memberUserIds = (members || []).map((m) => m.user_id).filter(Boolean) as string[];
        const namesById = new Map<string, string | null>();
        if (memberUserIds.length > 0) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, full_name')
                .in('id', memberUserIds);
            for (const p of profiles || []) namesById.set(p.id, p.full_name ?? null);
        }

        const memberRows = (members || []).map((m) => {
            const { invite_token, ...rest } = m;
            return {
                ...rest,
                name: m.user_id ? namesById.get(m.user_id) ?? null : null,
                is_owner: false,
                // Имэйл ажиллахгүй үед эзэн линкийг гараар хуваалцаж болохын тулд
                // хүлээгдэж буй гишүүний урилгын линкийг буцаана.
                invite_url: invite_token ? `${APP_URL}/invite/${invite_token}` : null,
            };
        });

        return NextResponse.json({
            members: ownerRow ? [ownerRow, ...memberRows] : memberRows,
        });
    } catch (error) {
        return handleError(error);
    }
}

// POST /api/dashboard/team/members — багийн гишүүн урих
export async function POST(request: Request) {
    try {
        const { shop, role: inviterRole, userId } = await requirePermission('team:manage');
        const supabase = supabaseAdmin();

        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const role = body.role as ShopRole;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Зөв имэйл хаяг оруулна уу' }, { status: 400 });
        }
        if (role !== 'admin' && role !== 'staff') {
            return NextResponse.json({ error: 'Эрх буруу байна' }, { status: 400 });
        }
        // Зөвхөн эзэн admin эрхтэй гишүүн урьж/удирдаж чадна.
        if (role === 'admin' && inviterRole !== 'owner') {
            return NextResponse.json({ error: 'Зөвхөн дэлгүүрийн эзэн админ эрхтэй гишүүн урьж чадна' }, { status: 403 });
        }

        // Эзний имэйл рүү урихаас сэргийлнэ.
        const { data: ownerProfile } = await supabase
            .from('user_profiles')
            .select('email, full_name')
            .eq('id', userId)
            .maybeSingle();
        if (ownerProfile?.email && ownerProfile.email.toLowerCase() === email) {
            return NextResponse.json({ error: 'Та өөрийгөө урих боломжгүй' }, { status: 400 });
        }

        // Аль хэдийн идэвхтэй/хүлээгдэж буй гишүүн эсэхийг шалгана.
        const { data: existing } = await supabase
            .from('shop_members')
            .select('id, status')
            .eq('shop_id', shop.id)
            .eq('email', email)
            .neq('status', 'revoked')
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ error: 'Энэ имэйл аль хэдийн уригдсан байна' }, { status: 409 });
        }

        const token = randomUUID();
        const { data: member, error } = await supabase
            .from('shop_members')
            .insert({
                shop_id: shop.id,
                email,
                role,
                status: 'pending',
                invite_token: token,
                invited_by: userId,
            })
            .select('id, email, role, status, invited_at, expires_at')
            .single();
        if (error) throw error;

        // Урилгын имэйл (Resend тохируулаагүй бол false буцаана).
        const inviteUrl = `${APP_URL}/invite/${token}`;
        const emailSent = await sendTeamInviteEmail({
            to: email,
            shopName: shop.name,
            inviterName: ownerProfile?.full_name || shop.owner_name || 'Дэлгүүрийн эзэн',
            role,
            inviteUrl,
        });

        // inviteUrl-ийг үргэлж буцаана — имэйл ажиллахгүй үед эзэн линкийг
        // гараар хуваалцаж болно.
        return NextResponse.json({ member, inviteUrl, emailSent });
    } catch (error) {
        return handleError(error);
    }
}
