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
    if (!userId) return null;

    const supabase = supabaseAdmin();
    const { data: shop } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', userId)
        .single();

    return shop;
}
