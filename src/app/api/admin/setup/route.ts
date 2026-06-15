/**
 * Admin Setup API — bootstrap the first super admin.
 *
 * Security: this endpoint can grant super_admin, so it must never be open.
 *   - Development: any authenticated user may bootstrap themselves.
 *   - Production: 404 unless ADMIN_SETUP_SECRET is configured AND the caller
 *     supplies it via the `x-admin-setup-secret` header. Unset the env var
 *     after bootstrapping to close the endpoint completely.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth/auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

function secretsMatch(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
    try {
        if (process.env.NODE_ENV === 'production') {
            const expected = process.env.ADMIN_SETUP_SECRET;
            const provided = request.headers.get('x-admin-setup-secret');
            if (!expected || !provided || !secretsMatch(provided, expected)) {
                return new NextResponse('Not Found', { status: 404 });
            }
        }

        const userId = await getAuthUser();

        if (!userId) {
            return NextResponse.json({
                error: 'Not authenticated',
                hint: 'Please sign in first at /admin/login'
            }, { status: 401 });
        }

        // Get user email from Supabase Auth
        const supabaseAuth = await createSupabaseServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        const email = user?.email || 'admin@smarthub.mn';

        const supabase = supabaseAdmin();

        const { data: existingAdmin } = await supabase
            .from('admins')
            .select('id, user_id, email, role')
            .eq('email', email)
            .single();

        let result;

        if (existingAdmin) {
            const { data, error } = await supabase
                .from('admins')
                .update({
                    user_id: userId,
                    role: 'super_admin',
                    is_active: true
                })
                .eq('email', email)
                .select()
                .single();

            if (error) throw error;
            result = { action: 'updated', admin: data };
        } else {
            const { data, error } = await supabase
                .from('admins')
                .insert({
                    user_id: userId,
                    email: email,
                    role: 'super_admin',
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            result = { action: 'created', admin: data };
        }

        logger.warn('Super admin bootstrapped via /api/admin/setup', { userId, email });

        return NextResponse.json({
            success: true,
            message: `Super admin ${result.action} successfully!`,
            details: {
                user_id: userId,
                email: email,
                role: 'super_admin'
            },
            next_step: 'Now go to /admin to access the admin dashboard'
        });

    } catch (error: unknown) {
        logger.error('Admin setup error:', { error: error });
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Check server logs for details'
        }, { status: 500 });
    }
}
