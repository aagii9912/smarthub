import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfPeriod } from '@/lib/utils/date';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/utils/rate-limiter';
import { apiError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  try {
    const authShop = await getAuthUserShop();

    // Rate limiting (identify by shop ID or use IP fallback)
    const identifier = authShop?.id || request.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimitResult = await checkRateLimit(`stats:${identifier}`, RATE_LIMIT_CONFIGS.dashboard);

    if (!rateLimitResult.allowed) {
      const response = apiError('Too many requests. Please try again later.', null, {
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
      });
      // Add rate limit headers
      const headers = getRateLimitHeaders(rateLimitResult, RATE_LIMIT_CONFIGS.dashboard.maxRequests);
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

    // 🚀 Бүх query-г зэрэгцүүлэн ажиллуулах (Promise.all)
    const [
      periodOrdersResult,
      pendingOrdersResult,
      allOrdersDataResult,
      totalCustomersResult,
      recentOrdersResult,
      recentChatsResult,
      lowStockResult,
    ] = await Promise.all([
      // Захиалгууд (period-д тулгуурласан)
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .gte('created_at', periodStart.toISOString()),

      // Хүлээгдэж буй захиалгууд
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'pending'),

      // Нийт орлого
      supabase
        .from('orders')
        .select('total_amount')
        .eq('shop_id', shopId)
        .in('status', ['confirmed', 'processing', 'shipped', 'delivered']),

      // Нийт харилцагч
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId),

      // Сүүлийн захиалгууд
      supabase
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
        .limit(10),

      // Сүүлийн чатууд (хуучин format - backward compatibility)
      supabase
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
        .limit(50),

      // Low stock products (stock < 5)
      supabase
        .from('products')
        .select('id, name, stock, images')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .eq('type', 'physical')
        .lt('stock', 5)
        .order('stock', { ascending: true })
        .limit(5),
    ]);

    const periodOrders = periodOrdersResult.count;
    const pendingOrders = pendingOrdersResult.count;
    const totalRevenue = allOrdersDataResult.data?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
    const totalCustomers = totalCustomersResult.count;
    const recentOrders = recentOrdersResult.data;
    const recentChats = recentChatsResult.data;
    const lowStockProducts = lowStockResult.data;

    // Хэрэглэгчээр бүлэглэсэн харилцаанууд
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
          isAnswered: !isUserMessage,
        });
      } else {
        existing.messageCount++;
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
  } catch (error: unknown) {
    Sentry.captureException(error, { tags: { route: 'dashboard/stats' } });
    logger.error('Stats API error:', { error: error });
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

