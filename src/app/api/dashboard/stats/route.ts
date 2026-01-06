import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    // Demo shop ID
    const shopId = '00000000-0000-0000-0000-000000000001';

    // Өнөөдрийн захиалгууд
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: todayOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gte('created_at', today.toISOString());

    // Хүлээгдэж буй захиалгууд
    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('status', 'pending');

    // Нийт орлого (өнөөдөр)
    const { data: todayOrdersData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('shop_id', shopId)
      .gte('created_at', today.toISOString());

    const totalRevenue = todayOrdersData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

    // Нийт харилцагч
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId);

    // Сүүлийн захиалгууд
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        customers (
          name,
          phone
        ),
        order_items (
          quantity,
          products (
            name
          )
        )
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Сүүлийн чатууд (demo)
    const { data: recentChats } = await supabase
      .from('chat_history')
      .select(`
        id,
        message,
        created_at,
        customers (
          name
        )
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      stats: {
        todayOrders: todayOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue: Math.round(totalRevenue),
        totalCustomers: totalCustomers || 0,
      },
      recentOrders: recentOrders || [],
      recentChats: recentChats || [],
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

