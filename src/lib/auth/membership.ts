/**
 * Shop-level RBAC (Role-Based Access Control) helpers.
 *
 * Дэлгүүрийн эзэн (shops.user_id) ажилтнуудаа урьж, эрхийн түвшинтэйгээр
 * (owner / admin / staff) системд оруулдаг. Эзэн нь implicit — shop_members-д
 * мөр байхгүй ч synthetic `owner` гэж тооцогдоно.
 *
 * ⚠️ API маршрутууд service-role (supabaseAdmin) ашигладаг тул RLS алгасагдана.
 * Эрхийн ЖИНХЭНЭ хяналт энд (requireRole / requirePermission) хийгдэнэ.
 */

import { headers } from 'next/headers';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { hasRole, roleCan } from '@/lib/auth/permissions';
import type { Shop, ShopRole, Permission } from '@/types/database';

export { hasRole, roleCan, ROLE_PERMISSIONS } from '@/lib/auth/permissions';

/** getAuthUserShop-той ижил баганууд — одоо байгаа дуудагчдыг эвдэхгүй. */
const SHOP_SELECT =
    'id, name, owner_name, phone, facebook_page_id, facebook_page_name, is_active, setup_completed, created_at, token_usage_total';

export interface ShopAccess {
    shop: Shop;
    role: ShopRole;
    userId: string;
}

/**
 * Нэвтэрсэн хэрэглэгчийн дэлгүүр + role-ийг resolve хийнэ.
 * x-shop-id header-ийг хүндэтгэнэ. Эзэн ЭСВЭЛ active гишүүнийг олно.
 */
export async function getAuthUserShopAccess(): Promise<ShopAccess | null> {
    const userId = await getAuthUser();
    if (!userId) return null;

    const headerList = await headers();
    const requestedShopId = headerList.get('x-shop-id');

    const supabase = supabaseAdmin();

    // 1) Эзэн эсэхийг шалгана.
    let ownerQuery = supabase.from('shops').select(SHOP_SELECT).eq('user_id', userId);
    if (requestedShopId) ownerQuery = ownerQuery.eq('id', requestedShopId);
    const { data: ownerShops, error: ownerErr } = await ownerQuery.limit(1);

    if (ownerErr) {
        logger.error('getAuthUserShopAccess owner query error:', { error: ownerErr });
        return null;
    }
    if (ownerShops && ownerShops.length > 0) {
        return { shop: ownerShops[0] as Shop, role: 'owner', userId };
    }

    // 2) Active гишүүн эсэхийг шалгана.
    let memberQuery = supabase
        .from('shop_members')
        .select(`role, shops!inner(${SHOP_SELECT})`)
        .eq('user_id', userId)
        .eq('status', 'active');
    if (requestedShopId) memberQuery = memberQuery.eq('shop_id', requestedShopId);
    const { data: memberships, error: memberErr } = await memberQuery.limit(1);

    if (memberErr) {
        logger.error('getAuthUserShopAccess member query error:', { error: memberErr });
        return null;
    }
    if (memberships && memberships.length > 0) {
        const row = memberships[0] as unknown as { role: ShopRole; shops: Shop };
        // Supabase join нэг мөрөнд объект эсвэл массиваар буцааж болзошгүй.
        const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
        if (shop) {
            return { shop: shop as Shop, role: row.role, userId };
        }
    }

    return null;
}

/** Шаардлагатай role байхгүй бол алдаа шиднэ. */
export async function requireRole(required: ShopRole): Promise<ShopAccess> {
    const access = await getAuthUserShopAccess();
    if (!access) {
        throw new ForbiddenError('Нэвтрэх эрхгүй: дэлгүүр олдсонгүй');
    }
    if (!hasRole(access.role, required)) {
        throw new ForbiddenError(`Эрх хүрэлцэхгүй: ${required} эрх шаардлагатай`);
    }
    return access;
}

/** Шаардлагатай зөвшөөрөл байхгүй бол алдаа шиднэ. */
export async function requirePermission(perm: Permission): Promise<ShopAccess> {
    const access = await getAuthUserShopAccess();
    if (!access) {
        throw new ForbiddenError('Нэвтрэх эрхгүй: дэлгүүр олдсонгүй');
    }
    if (!roleCan(access.role, perm)) {
        throw new ForbiddenError(`Эрх хүрэлцэхгүй: "${perm}" зөвшөөрөл шаардлагатай`);
    }
    return access;
}

/** requireRole / requirePermission-аас шидэгдэх алдаа (403). */
export class ForbiddenError extends Error {
    status = 403;
    constructor(message: string) {
        super(message);
        this.name = 'ForbiddenError';
    }
}
