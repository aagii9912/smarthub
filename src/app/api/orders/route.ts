import { NextRequest, NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET all orders
export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const authShop = await getUserShop();
    const shopId = authShop?.id || '00000000-0000-0000-0000-000000000001';

    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        status,
        notes,
        delivery_address,
        created_at,
        updated_at,
        customers (id, name, phone, address, facebook_id),
        order_items (id, quantity, unit_price, products (id, name, price))
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// PATCH - Update order status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const authShop = await getUserShop();
    const shopId = authShop?.id || '00000000-0000-0000-0000-000000000001';

    // Verify order belongs to shop
    const { data: order } = await supabase
      .from('orders')
      .select('id, shop_id, customer_id, total_amount')
      .eq('id', orderId)
      .eq('shop_id', shopId)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update order status
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // If delivered, update customer stats
    if (status === 'delivered' && order.customer_id) {
      await supabase.rpc('update_customer_stats_manual', {
        p_customer_id: order.customer_id,
        p_amount: order.total_amount
      });
    }

    return NextResponse.json({ 
      success: true, 
      order: updatedOrder,
      message: `Захиалга "${status}" болгож шинэчлэгдлээ`
    });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
