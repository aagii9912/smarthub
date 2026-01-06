import { NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const authShop = await getUserShop();
    const shopId = authShop?.id || '00000000-0000-0000-0000-000000000001';

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

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = supabaseAdmin();
    const authShop = await getUserShop();
    const shopId = authShop?.id || '00000000-0000-0000-0000-000000000001';
    
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
