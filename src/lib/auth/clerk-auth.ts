import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Get authenticated user from Clerk
export async function getClerkUser() {
    const { userId } = await auth();
    return userId;
}

// Create Supabase admin client (for server-side operations)
export function supabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

// Get shop for a Clerk user
export async function getClerkUserShop() {
    const userId = await getClerkUser();
    if (!userId) {
        // console.log('getClerkUserShop: No userId found from Clerk');
        return null;
    }

    // Check for x-shop-id in headers
    const headerList = await headers();
    const requestedShopId = headerList.get('x-shop-id');

    const supabase = supabaseAdmin();

    // Build query
    let query = supabase
        .from('shops')
        .select('id, name, owner_name, phone, facebook_page_id, facebook_page_name, is_active, setup_completed, created_at')
        .eq('user_id', userId);

    // If specific shop requested, use it, otherwise get first
    if (requestedShopId) {
        query = query.eq('id', requestedShopId);
    }

    const { data: shops, error } = await query.limit(1);

    if (error) {
        console.error('getClerkUserShop Error:', error);
        return null;
    }

    if (!shops || shops.length === 0) {
        // console.log('getClerkUserShop: No shops found for userId:', userId);
        return null;
    }

    return shops[0];
}
