/**
 * RBAC-ийн цэвэр логик (server/client хоёуланд аюулгүй).
 *
 * Энд server-only зүйл (next/headers, supabaseAdmin) импортлохгүй — ингэснээр
 * client component-ууд (AuthContext, Sidebar) role/permission шалгаж чадна.
 * Server талын resolve / guard-ууд src/lib/auth/membership.ts дотор байна.
 */

import type { ShopRole, Permission } from '@/types/database';

/** Role шатлал (өндөр тоо = илүү эрх). */
export const ROLE_RANK: Record<ShopRole, number> = {
    staff: 1,
    admin: 2,
    owner: 3,
};

/**
 * Role бүрийн эзэмших зөвшөөрлүүд. Унших эрх бүх role-д нээлттэй тул энд
 * зөвхөн эмзэг (бичих / удирдах) зөвшөөрлүүдийг жагсаав.
 */
export const ROLE_PERMISSIONS: Record<ShopRole, Permission[]> = {
    owner: [
        'orders:write',
        'products:write',
        'inbox:write',
        'customers:export',
        'ai:write',
        'settings:write',
        'team:manage',
        'billing:manage',
        'shop:delete',
    ],
    admin: [
        'orders:write',
        'products:write',
        'inbox:write',
        'customers:export',
        'ai:write',
        'settings:write',
        'team:manage',
    ],
    staff: ['orders:write', 'products:write', 'inbox:write'],
};

/** role нь required-аас дээгүүр эсвэл тэнцүү эрхтэй эсэх. */
export function hasRole(role: ShopRole, required: ShopRole): boolean {
    return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** role нь тухайн зөвшөөрөлтэй эсэх. */
export function roleCan(role: ShopRole, perm: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}
