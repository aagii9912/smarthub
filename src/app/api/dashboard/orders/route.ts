import { NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendOrderStatusNotification } from '@/lib/services/OrderNotificationService';
import { logger } from '@/lib/utils/logger';

export async function GET(request: Request) {
  try {
    const authShop = await getClerkUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Verify order belongs to shop and get customer_id
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, customer_id, status')
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

    // Send notification to customer via Facebook Messenger (non-blocking)
    if (existingOrder.customer_id && status !== existingOrder.status) {
      sendOrderStatusNotification(existingOrder.customer_id, id, status, shopId)
        .then((result) => {
          if (result.success) {
            logger.info(`Order ${id} status → ${status}: customer notified`);
          }
        })
        .catch((err) => {
          logger.warn(`Order notification failed (non-critical):`, { error: String(err) });
        });
    }

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
