import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthenticatedShop() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return shop;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    // Try to get authenticated user's shop
    const authShop = await getAuthenticatedShop();
    
    // Fallback to demo shop if not authenticated
    const shopId = authShop?.id || '00000000-0000-0000-0000-000000000001';

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

    // Нийт орлого (бүх цаг)
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
        customers (
          name
        )
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      shop: authShop ? { id: authShop.id, name: authShop.name } : null,
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
