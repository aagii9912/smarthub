import { NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const authShop = await getUserShop();
    
    if (!authShop) {
      return NextResponse.json({ orders: [] });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (id, name, phone, address),
        order_items (id, quantity, unit_price, products (id, name))
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authShop = await getUserShop();
    
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
