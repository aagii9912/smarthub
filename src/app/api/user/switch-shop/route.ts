import { NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';

// POST /api/user/switch-shop - Switch active shop
export async function POST(request: Request) {
    try {
        const userId = await getAuthUser();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { shopId } = body;

        if (!shopId) {
            return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Эзэмшил эсвэл active гишүүнчлэлийг шалгана.
        const { data: shop, error } = await supabase
            .from('shops')
            .select('id, name, owner_name, is_active, subscription_plan, user_id')
            .eq('id', shopId)
            .single();

        if (error || !shop) {
            return NextResponse.json({ error: 'Shop not found or access denied' }, { status: 404 });
        }

        let role: 'owner' | 'admin' | 'staff' | null = null;
        if (shop.user_id === userId) {
            role = 'owner';
        } else {
            const { data: membership } = await supabase
                .from('shop_members')
                .select('role')
                .eq('shop_id', shopId)
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle();
            role = (membership?.role as 'admin' | 'staff' | undefined) ?? null;
        }

        if (!role) {
            return NextResponse.json({ error: 'Shop not found or access denied' }, { status: 404 });
        }

        // The actual switching is handled client-side via localStorage + context
        // This endpoint just validates and returns the shop data
        const { user_id: _ownerId, ...shopPublic } = shop;
        return NextResponse.json({
            success: true,
            shop: { ...shopPublic, role },
            message: `Switched to ${shop.name}`
        });
    } catch (error: unknown) {
        logger.error('Switch shop error:', { error: error });
        return NextResponse.json({ error: 'Failed to switch shop' }, { status: 500 });
    }
}
