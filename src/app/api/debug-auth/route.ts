import { NextResponse } from 'next/server';
import { getAuthUser, getAuthUserShop, supabaseAdmin } from '@/lib/auth/clerk-auth';

export async function GET() {
    try {
        const userId = await getAuthUser();
        const shop = await getAuthUserShop();

        let rawShops = null;
        let queryError = null;

        if (userId) {
            const supabase = supabaseAdmin();
            const { data, error } = await supabase
                .from('shops')
                .select('*')
                .eq('user_id', userId);
            rawShops = data;
            queryError = error;
        }

        return NextResponse.json({
            auth_status: {
                user_id: userId,
                isAuthenticated: !!userId
            },
            shop_status: {
                shop_found: !!shop,
                shop_data: shop,
            },
            raw_query: {
                shops_count: rawShops?.length,
                shops: rawShops,
                error: queryError
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
