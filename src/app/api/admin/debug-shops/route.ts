/**
 * Debug endpoint to check admin shops query
 */

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { getAuthUser } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const userId = await getAuthUser();
        const admin = await getAdminUser();
        const supabase = supabaseAdmin();

        // Check admins table directly
        const { data: admins, error: adminError } = await supabase
            .from('admins')
            .select('*');

        // Simple query - just get all shops without joins
        const { data: shops, error, count } = await supabase
            .from('shops')
            .select('id, name, user_id, is_active, created_at', { count: 'exact' });

        return NextResponse.json({
            user_id: userId,
            admin_check: admin ? { email: admin.email, role: admin.role } : null,
            admins_table: admins,
            admins_error: adminError?.message,
            shops_found: shops?.length || 0,
            shops_count: count,
            shops: shops,
            error: error ? { message: error.message, code: error.code } : null
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
