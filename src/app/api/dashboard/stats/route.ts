import { NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfToday } from '@/lib/utils/date';

export async function GET() {
  try {
    const authShop = await getUserShop();
    
    // Require authenticated shop - no demo fallback
    if (!authShop) {
      return NextResponse.json({
        shop: null,
        stats: {
          todayOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
          totalCustomers: 0,
        },
        recentOrders: [],
        recentChats: [],
      });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const today = getStartOfToday();

    // Өнөөдрийн захиалгууд
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

    // Нийт орлого
    const { data: allOrdersData } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('shop_id', shopId)
      .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

    const totalRevenue = allOrdersData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

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
        notes,
        customers (name, phone),
        order_items (quantity, products (name))
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Сүүлийн чатууд
    const { data: recentChats } = await supabase
      .from('chat_history')
      .select(`
        id,
        message,
        response,
        intent,
        created_at,
        customers (name)
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      shop: { id: authShop.id, name: authShop.name },
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
