/**
 * Admin Invoices API
 * Manage all invoices from admin panel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

type ShopRef = { id: string; name: string };

/**
 * Invoice мөрүүдэд `shops: { id, name }`-ийг тусдаа query-ээр залгана.
 *
 * Production DB-д `invoices.shop_id` → `shops.id` foreign key байхгүй тул
 * PostgREST-ийн `shops(...)` embed нь "Could not find a relationship between
 * 'invoices' and 'shops'" (PGRST200) гэж бүх query-г унагадаг.
 */
async function attachShops<T extends { shop_id?: string | null }>(
    supabase: ReturnType<typeof supabaseAdmin>,
    rows: T[]
): Promise<(T & { shops: ShopRef | null })[]> {
    const shopIds = [...new Set(rows.map(r => r.shop_id).filter((id): id is string => !!id))];
    const shopsById = new Map<string, ShopRef>();
    if (shopIds.length > 0) {
        const { data: shops, error } = await supabase.from('shops').select('id, name').in('id', shopIds);
        if (error) throw error;
        for (const shop of shops ?? []) shopsById.set(shop.id, shop);
    }
    return rows.map(r => ({ ...r, shops: (r.shop_id && shopsById.get(r.shop_id)) || null }));
}

// GET - List all invoices
export async function GET(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status');
        const shop_id = searchParams.get('shop_id');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let query = supabase
            .from('invoices')
            .select(`
                *,
                subscriptions(id, status, plans(name))
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }
        if (shop_id) {
            query = query.eq('shop_id', shop_id);
        }

        const { data, count, error } = await query;

        if (error) throw error;

        const invoices = await attachShops(supabase, data ?? []);

        // Calculate totals
        const { data: stats } = await supabase
            .from('invoices')
            .select('status, amount');

        const totals = {
            total: stats?.reduce((sum, i) => sum + i.amount, 0) || 0,
            paid: stats?.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0) || 0,
            pending: stats?.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0) || 0,
            overdue: stats?.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0) || 0
        };

        return NextResponse.json({
            invoices,
            totals,
            total: count,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (error: unknown) {
        logger.error('Invoices fetch error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

// POST - Create new invoice
export async function POST(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { shop_id, subscription_id, amount, due_date, description } = body;

        if (!shop_id || !amount) {
            return NextResponse.json({ error: 'shop_id and amount are required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data, error } = await supabase
            .from('invoices')
            .insert({
                shop_id,
                subscription_id,
                amount,
                due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                description,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select('*')
            .single();

        if (error) throw error;

        const [invoice] = await attachShops(supabase, [data]);

        return NextResponse.json({ invoice });
    } catch (error: unknown) {
        logger.error('Invoice create error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

// PUT - Update invoice status
export async function PUT(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { invoice_id, status, paid_at, notes } = body;

        if (!invoice_id) {
            return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // `invoices` хүснэгтэд updated_at багана байхгүй — оруулбал update бүхэлдээ унана.
        const updateData: Record<string, unknown> = {};
        if (status) {
            updateData.status = status;
            if (status === 'paid' && !paid_at) {
                updateData.paid_at = new Date().toISOString();
            }
        }
        if (paid_at) updateData.paid_at = paid_at;
        if (notes !== undefined) updateData.notes = notes;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoice_id)
            .select('*')
            .single();

        if (error) throw error;

        const [invoice] = await attachShops(supabase, [data]);

        return NextResponse.json({ invoice });
    } catch (error: unknown) {
        logger.error('Invoice update error:', { error: error });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
