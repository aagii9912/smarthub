import { logger } from '@/lib/utils/logger';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { headers } from 'next/headers';

// Re-export for backward compatibility
export { supabaseAdmin };

// Get authenticated user from Supabase Auth
export async function getAuthUser() {
    const supabase = await createSupabaseServerClient();
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            return null;
        }
        return user.id;
    } catch (err) {
        // Stale cookie with a missing/expired refresh_token throws
        // `AuthApiError: Refresh Token Not Found` on every request. Swallow
        // it so we don't spam logs — caller gets `null` and renders the
        // unauthenticated path.
        const code = (err as { code?: string } | undefined)?.code;
        if (code !== 'refresh_token_not_found') {
            logger.warn('getAuthUser unexpected error', { error: err });
        }
        return null;
    }
}

// Get shop for an authenticated user
export async function getAuthUserShop() {
    const userId = await getAuthUser();
    if (!userId) {
        return null;
    }

    // Check for x-shop-id in headers
    const headerList = await headers();
    const requestedShopId = headerList.get('x-shop-id');

    const supabase = supabaseAdmin();

    // Build query
    let query = supabase
        .from('shops')
        .select('id, name, owner_name, phone, facebook_page_id, facebook_page_name, is_active, setup_completed, created_at, token_usage_total')
        .eq('user_id', userId);

    // If specific shop requested, use it, otherwise get first
    if (requestedShopId) {
        query = query.eq('id', requestedShopId);
    }

    const { data: shops, error } = await query.limit(1);

    if (error) {
        logger.error('getAuthUserShop Error:', { error });
        return null;
    }

    if (!shops || shops.length === 0) {
        return null;
    }

    return shops[0];
}
