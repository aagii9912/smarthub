import { logger } from '@/lib/utils/logger';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

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

// Get shop for an authenticated user.
//
// RBAC: эзэн ЭСВЭЛ active гишүүний дэлгүүрийг resolve хийдэг болсон
// (src/lib/auth/membership.ts). Гарын үсэг (shop мөр буцаах) хэвээр тул
// одоо байгаа бүх дуудагч өөрчлөлтгүй ажиллана. Role шаардлагатай шинэ
// маршрутууд getAuthUserShopAccess / requirePermission-ийг шууд дуудна.
export async function getAuthUserShop() {
    // Lazy import — auth.ts ↔ membership.ts хооронд circular import-аас сэргийлнэ
    // (хоёулаа зөвхөн runtime-д функц дотор ашиглагдана).
    const { getAuthUserShopAccess } = await import('@/lib/auth/membership');
    const access = await getAuthUserShopAccess();
    return access?.shop ?? null;
}
