import { NextResponse } from 'next/server';
import { getClerkUser, getClerkUserShop, supabaseAdmin } from '@/lib/auth/clerk-auth';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
    try {
        const { userId: authUserId } = await auth();
        const clerkUserId = await getClerkUser();
        const shop = await getClerkUserShop();

        let rawShops = null;
        let queryError = null;

        if (clerkUserId) {
            const supabase = supabaseAdmin();
            const { data, error } = await supabase
                .from('shops')
                .select('*')
                .eq('user_id', clerkUserId);
            rawShops = data;
            queryError = error;
        }

        return NextResponse.json({
            auth_status: {
                auth_userId: authUserId,
                clerk_userId: clerkUserId,
                isAuthenticated: !!authUserId
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
