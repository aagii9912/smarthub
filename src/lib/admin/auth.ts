/**
 * Admin Authentication & Authorization
 * Middleware for Super Admin access
 */

import { createServerSupabase } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

export interface AdminUser {
    id: string;
    email: string;
    role: 'super_admin' | 'admin' | 'support';
}

/**
 * Check if current user is an admin
 * Returns admin info or null if not authorized
 */
export async function getAdminUser(): Promise<AdminUser | null> {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('Admin auth: No user found');
            return null;
        }

        console.log('Admin auth: User found:', user.id, user.email);

        // Check if user is in admins table
        const adminDb = supabaseAdmin();
        const { data: admin, error } = await adminDb
            .from('admins')
            .select('id, email, role')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();

        if (error) {
            console.log('Admin auth: Error checking admins table:', error.message);
            return null;
        }

        if (!admin) {
            console.log('Admin auth: User not in admins table');
            return null;
        }

        console.log('Admin auth: Admin found:', admin.email, admin.role);

        return {
            id: admin.id,
            email: admin.email,
            role: admin.role as AdminUser['role']
        };
    } catch (error) {
        console.error('Admin auth error:', error);
        return null;
    }
}

/**
 * Check if user has required admin role
 */
export async function requireAdmin(requiredRole?: AdminUser['role']): Promise<AdminUser> {
    const admin = await getAdminUser();

    if (!admin) {
        throw new Error('Unauthorized: Admin access required');
    }

    if (requiredRole && admin.role !== requiredRole && admin.role !== 'super_admin') {
        throw new Error(`Unauthorized: ${requiredRole} role required`);
    }

    return admin;
}

/**
 * Role hierarchy check
 */
export function hasPermission(userRole: AdminUser['role'], requiredRole: AdminUser['role']): boolean {
    const hierarchy: Record<AdminUser['role'], number> = {
        'support': 1,
        'admin': 2,
        'super_admin': 3
    };

    return hierarchy[userRole] >= hierarchy[requiredRole];
}
