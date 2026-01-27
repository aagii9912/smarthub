import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfPeriod } from '@/lib/utils/date';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from '@/lib/utils/rate-limit';
import { apiError } from '@/lib/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    const authShop = await getClerkUserShop();

    // Rate limiting (identify by shop ID or use IP fallback)
    const identifier = authShop?.id || request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResult = checkRateLimit(`stats:${identifier}`, RATE_LIMITS.dashboard);

    if (!rateLimitResult.allowed) {
      const response = apiError('Too many requests. Please try again later.', null, {
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
      });
      // Add rate limit headers
      const headers = getRateLimitHeaders(rateLimitResult, RATE_LIMITS.dashboard.maxRequests);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Get period from query params (default: today)
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'today') as 'today' | 'week' | 'month';

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
        activeConversations: [],
        lowStockProducts: [],
        unansweredCount: 0,
      });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const periodStart = getStartOfPeriod(period);

    // Захиалгууд (period-д тулгуурласан)
    const { count: periodOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gte('created_at', periodStart.toISOString());

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

    // Сүүлийн чатууд (хуучин format - backward compatibility)
    const { data: recentChats } = await supabase
      .from('chat_history')
      .select(`
        id,
        message,
        response,
        intent,
        role,
        created_at,
        customer_id,
        customers (name)
      `)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 🆕 Хэрэглэгчээр бүлэглэсэн харилцаанууд
    const conversationMap = new Map<string, {
      customerId: string;
      customerName: string;
      messageCount: number;
      lastMessage: string;
      lastMessageAt: string;
      lastIntent: string | null;
      isAnswered: boolean;
    }>();

    // Group chats by customer
    recentChats?.forEach(chat => {
      const customerId = chat.customer_id;
      if (!customerId) return;

      const existing = conversationMap.get(customerId);
      const isUserMessage = chat.role === 'user';
      // Handle customers - Supabase can return object or array depending on relation
      const customerObj = chat.customers as unknown as { name: string } | null;
      const customerName = customerObj?.name || 'Харилцагч';

      if (!existing) {
        conversationMap.set(customerId, {
          customerId,
          customerName,
          messageCount: 1,
          lastMessage: chat.message || '',
          lastMessageAt: chat.created_at,
          lastIntent: chat.intent,
          isAnswered: !isUserMessage, // answered if last message is from assistant
        });
      } else {
        existing.messageCount++;
        // Keep the most recent message info
        if (new Date(chat.created_at) > new Date(existing.lastMessageAt)) {
          existing.lastMessage = chat.message || '';
          existing.lastMessageAt = chat.created_at;
          existing.lastIntent = chat.intent;
          existing.isAnswered = !isUserMessage;
        }
      }
    });

    const activeConversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .slice(0, 10);

    // Хариулаагүй харилцагчийн тоо
    const unansweredCount = activeConversations.filter(c => !c.isAnswered).length;

    // 🆕 Low stock products (stock < 5)
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, stock, images')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .eq('type', 'physical')
      .lt('stock', 5)
      .order('stock', { ascending: true })
      .limit(5);

    return NextResponse.json({
      shop: { id: authShop.id, name: authShop.name },
      stats: {
        todayOrders: periodOrders || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue: Math.round(totalRevenue),
        totalCustomers: totalCustomers || 0,
      },
      recentOrders: recentOrders || [],
      recentChats: recentChats || [], // backward compatibility
      activeConversations,
      lowStockProducts: lowStockProducts || [],
      unansweredCount,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

