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
    // For now, we just return the first shop found for the user
    // TODO: Implement logic to select "active" shop from cookie or context if multiple exist
    const { data: shops, error } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

    if (error) {
        console.error('Error fetching shop:', error);
        return null;
    }

    return shops?.[0] || null;
}
