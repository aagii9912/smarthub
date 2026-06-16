import { NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';
import type { Shop, ShopRole } from '@/types/database';

const SHOP_FIELDS =
    'id, name, owner_name, phone, facebook_page_id, facebook_page_name, is_active, setup_completed, created_at, instagram_business_account_id, instagram_username, bank_name, account_number, account_name, register_number, merchant_type, description, ai_emotion, ai_instructions, is_ai_active, subscription_plan';

// GET /api/user/shops - Get all shops the current user can access
// (эзэмшдэг + active гишүүн болсон дэлгүүрүүд, role-ийн хамт).
export async function GET() {
    try {
        const userId = await getAuthUser();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        // 1) Эзэмшдэг дэлгүүрүүд
        const { data: ownedShops, error: ownedErr } = await supabase
            .from('shops')
            .select(SHOP_FIELDS)
            .eq('user_id', userId);
        if (ownedErr) throw ownedErr;

        // 2) Active гишүүн болсон дэлгүүрүүд (role-ийн хамт)
        const { data: memberships, error: memberErr } = await supabase
            .from('shop_members')
            .select(`role, shops!inner(${SHOP_FIELDS})`)
            .eq('user_id', userId)
            .eq('status', 'active');
        if (memberErr) throw memberErr;

        // Нэгтгэх: эзэмшил давхцвал эзэн role давамгайлна.
        const byId = new Map<string, Shop & { role: ShopRole }>();
        for (const s of (ownedShops || []) as Shop[]) {
            byId.set(s.id, { ...s, role: 'owner' });
        }
        for (const m of (memberships || []) as unknown as { role: ShopRole; shops: Shop | Shop[] }[]) {
            const shop = Array.isArray(m.shops) ? m.shops[0] : m.shops;
            if (shop && !byId.has(shop.id)) {
                byId.set(shop.id, { ...shop, role: m.role });
            }
        }

        // Эрэмбэ: setup дууссан → идэвхтэй → хуучин эхэлж (bug #7-тэй ижил).
        const shops = Array.from(byId.values()).sort((a, b) => {
            if (!!b.setup_completed !== !!a.setup_completed) return b.setup_completed ? 1 : -1;
            if (!!b.is_active !== !!a.is_active) return b.is_active ? 1 : -1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        return NextResponse.json({ shops });
    } catch (error: unknown) {
        logger.error('User shops API error:', { error: error });
        return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 });
    }
}

// POST /api/user/shops - Create a new shop for the current user
export async function POST(request: Request) {
    try {
        const userId = await getAuthUser();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, owner_name, phone } = body;

        if (!name) {
            return NextResponse.json({ error: 'Shop name is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data: shop, error } = await supabase
            .from('shops')
            .insert([{
                user_id: userId,
                name,
                owner_name: owner_name || null,
                phone: phone || null,
                is_active: true,
                setup_completed: false,
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ shop });
    } catch (error: unknown) {
        logger.error('Create shop error:', { error: error });
        return NextResponse.json({ error: 'Failed to create shop' }, { status: 500 });
    }
}
