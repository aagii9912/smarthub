/**
 * Admin Users API
 * Manage admin users (super_admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, hasPermission } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET - List all admins
export async function GET() {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        const { data, error } = await supabase
            .from('admins')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ admins: data });
    } catch (error: any) {
        console.error('Admins fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create new admin
export async function POST(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin || admin.role !== 'super_admin') {
            return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { email, role } = body;

        if (!email || !role) {
            return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
        }

        if (!['super_admin', 'admin', 'support'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Check if user exists in auth.users
        const { data: authUsers } = await supabase
            .from('auth.users')
            .select('id')
            .eq('email', email)
            .single();

        // Create admin record
        const { data, error } = await supabase
            .from('admins')
            .insert({
                user_id: authUsers?.id || null,
                email,
                role,
                is_active: true,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ admin: data });
    } catch (error: any) {
        console.error('Admin create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - Update admin
export async function PUT(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin || admin.role !== 'super_admin') {
            return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { admin_id, role, is_active } = body;

        if (!admin_id) {
            return NextResponse.json({ error: 'admin_id is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const updateData: any = {};
        if (role) updateData.role = role;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('admins')
            .update(updateData)
            .eq('id', admin_id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ admin: data });
    } catch (error: any) {
        console.error('Admin update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Delete admin
export async function DELETE(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin || admin.role !== 'super_admin') {
            return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const admin_id = searchParams.get('admin_id');

        if (!admin_id) {
            return NextResponse.json({ error: 'admin_id is required' }, { status: 400 });
        }

        // Prevent self-deletion
        if (admin_id === admin.id) {
            return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { error } = await supabase
            .from('admins')
            .delete()
            .eq('id', admin_id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Admin delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
