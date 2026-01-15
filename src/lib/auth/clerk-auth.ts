import { auth } from '@clerk/nextjs/server';
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

    const supabase = supabaseAdmin();

    // Select specific columns to avoid issues with potential problematic columns (like large JSONB or foreign keys)
    // and match the working pattern of /api/user/shops
    const { data: shops, error } = await supabase
        .from('shops')
        .select('id, name, owner_name, phone, facebook_page_id, facebook_page_name, is_active, setup_completed, created_at')
        .eq('user_id', userId)
        .limit(1);

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
