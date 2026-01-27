import { NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const authShop = await getClerkUserShop();

    if (!authShop) {
      return NextResponse.json({ orders: [] });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase
      .from('orders')
      .select(`
        *,
        customers (id, name, phone, address),
        order_items (id, quantity, unit_price, products (id, name))
      `)
      .eq('shop_id', shopId);

    if (from) {
      query = query.gte('created_at', from);
    }
    if (to) {
      // Add passing of end of day if only date is provided, but assuming ISO string from frontend
      query = query.lte('created_at', to);
    }

    const { data: orders, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authShop = await getClerkUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    const body = await request.json();
    const { id, status } = body;

    // Verify order belongs to shop
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single();

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
