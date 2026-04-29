/**
 * QPay Status Debug Route
 *
 * Dev-only diagnostic for QPay configuration. Returns presence flags for
 * required env vars (NEVER the values themselves) and the result of a live
 * token request against QPay so an admin can tell whether credentials work.
 *
 * Gated by:
 *   - NODE_ENV !== 'production' (also blocked by middleware in prod)
 *   - The caller must be a row in the `admins` table
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyQPayConfig } from '@/lib/payment/qpay';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        return new NextResponse('Not Found', { status: 404 });
    }

    const userId = await getAuthUser();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAuth = await createSupabaseServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const email = user?.email;
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const { data: admin } = await supabase
        .from('admins')
        .select('id, role, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

    if (!admin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const result = await verifyQPayConfig();
    return NextResponse.json({
        ...result,
        app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
        node_env: process.env.NODE_ENV,
    });
}
