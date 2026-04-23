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
        prevStats: {
          orders: 0,
          revenue: 0,
        },
        trend: {
          orders: null,
          revenue: null,
        },
        series: {
          orders: [],
          revenue: [],
          buckets: [],
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
    const now = new Date();

    // Previous-period window (same length, immediately before current)
    const periodMs = now.getTime() - periodStart.getTime();
    const prevStart = new Date(periodStart.getTime() - periodMs);
    const prevEnd = periodStart;

    const REVENUE_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'paid'];

    // 🚀 Бүх query-г зэрэгцүүлэн ажиллуулах (Promise.all)
    const [
      periodOrdersListResult,
      prevPeriodOrdersResult,
      pendingOrdersResult,
      totalCustomersResult,
      recentOrdersResult,
      recentChatsResult,
      lowStockResult,
    ] = await Promise.all([
      // Захиалгууд (period — цаг/огноогоор bucket хийхэд хэрэгтэй)
      supabase
        .from('orders')
        .select('created_at, total_amount, status')
        .eq('shop_id', shopId)
        .gte('created_at', periodStart.toISOString()),

      // Өмнөх period-ийн захиалга + орлого (trend бодоход)
      supabase
        .from('orders')
        .select('total_amount, status')
        .eq('shop_id', shopId)
        .gte('created_at', prevStart.toISOString())
        .lt('created_at', prevEnd.toISOString()),

      // Хүлээгдэж буй захиалгууд
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'pending'),

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
        .select('id, name, stock, images, updated_at')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .eq('type', 'physical')
        .lt('stock', 5)
        .order('stock', { ascending: true })
        .limit(5),
    ]);

    const periodOrdersList = periodOrdersListResult.data || [];
    const periodOrders = periodOrdersList.length;

    // Period revenue (only "realized" orders)
    const periodRevenue = periodOrdersList
      .filter((o) => REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Previous period stats (for trend %)
    const prevPeriodOrdersList = prevPeriodOrdersResult.data || [];
    const prevOrders = prevPeriodOrdersList.length;
    const prevRevenue = prevPeriodOrdersList
      .filter((o) => REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Bucket orders into series (24 slots for today, 7 for week, 30 for month)
    const bucketCount = period === 'today' ? 24 : period === 'week' ? 7 : 30;
    const bucketMs = periodMs / bucketCount;
    const ordersSeries = Array.from({ length: bucketCount }, () => 0);
    const revenueSeries = Array.from({ length: bucketCount }, () => 0);
    const buckets: string[] = Array.from({ length: bucketCount }, (_, i) => {
      const t = new Date(periodStart.getTime() + i * bucketMs);
      return t.toISOString();
    });

    periodOrdersList.forEach((o) => {
      const t = new Date(o.created_at).getTime();
      const idx = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((t - periodStart.getTime()) / bucketMs))
      );
      ordersSeries[idx] += 1;
      if (REVENUE_STATUSES.includes(o.status)) {
        revenueSeries[idx] += Number(o.total_amount || 0);
      }
    });

    // Trend % (integer rounded). null when prev has no signal (avoid div-by-zero mocks)
    const calcTrend = (curr: number, prev: number): number | null => {
      if (prev <= 0) return curr > 0 ? null : null;
      return Math.round(((curr - prev) / prev) * 100);
    };
    const ordersTrend = calcTrend(periodOrders, prevOrders);
    const revenueTrend = calcTrend(periodRevenue, prevRevenue);

    const pendingOrders = pendingOrdersResult.count;
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
        // period-filtered revenue (tied to ?period=today|week|month)
        totalRevenue: Math.round(periodRevenue),
        totalCustomers: totalCustomers || 0,
      },
      prevStats: {
        orders: prevOrders,
        revenue: Math.round(prevRevenue),
      },
      trend: {
        orders: ordersTrend,
        revenue: revenueTrend,
      },
      series: {
        orders: ordersSeries,
        revenue: revenueSeries,
        buckets,
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

