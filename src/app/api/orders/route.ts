import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { updateOrderStatusSchema, parseWithErrors } from '@/lib/validations';

// GET all orders
export async function GET() {
  try {
    const authShop = await getClerkUserShop();

    if (!authShop) {
      return NextResponse.json({ orders: [] });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

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

// PATCH - Update order status (with Zod validation)
export async function PATCH(request: NextRequest) {
  try {
    const authShop = await getClerkUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Zod validation
    const validation = parseWithErrors(updateOrderStatusSchema, body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 });
    }

    const { orderId, status } = validation.data;

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

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

