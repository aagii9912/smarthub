import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfPeriod } from '@/lib/utils/date';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/utils/rate-limiter';
import { apiError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { resolveArchetype, dashboardBlocks } from '@/lib/dashboard/archetypes';
import * as Sentry from '@sentry/nextjs';

interface RelatedName { name: string | null; phone?: string | null }

interface AppointmentsBlock {
  stats: { periodCount: number; upcomingCount: number; completedCount: number; noShowRate: number; peakHour: number | null };
  series: number[];
  byHour: number[];
  byWeekday: number[];
  statusBreakdown: { pending: number; confirmed: number; completed: number; cancelled: number; no_show: number };
  upcoming: Array<{
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    customers: RelatedName | RelatedName[] | null;
    products: RelatedName | RelatedName[] | null;
  }>;
}

interface LeadsBlock {
  stats: { newLeads: number; qualified: number; converted: number; conversionRate: number };
  bySource: { messenger: number; instagram: number; other: number };
  recent: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    created_at: string;
    total_orders: number | null;
    is_vip: boolean | null;
  }>;
  followUp: {
    count: number;
    items: Array<{ id: string; name: string | null; phone: string | null; last_contact_at: string | null }>;
  };
}

interface CartFunnelBlock {
  active: number;
  converted: number;
  abandoned: number;
  conversionRate: number;
}

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
        archetype: 'commerce',
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

    // 🚀 Бүх query-г зэрэгцүүлэн ажиллуулах (Promise.all)
    const [
      shopMetaResult,
      periodOrdersListResult,
      prevPeriodOrdersResult,
      pendingOrdersResult,
      totalCustomersResult,
      recentOrdersResult,
      recentChatsResult,
      lowStockResult,
    ] = await Promise.all([
      // Shop-ийн AI agent capabilities + business_type (dashboard архетип тодорхойлоход)
      supabase
        .from('shops')
        .select('ai_agent_capabilities, business_type')
        .eq('id', shopId)
        .single(),

      // Захиалгууд (period — цаг/огноогоор bucket хийхэд хэрэгтэй)
      supabase
        .from('orders')
        .select('created_at, total_amount, status, payment_status')
        .eq('shop_id', shopId)
        .gte('created_at', periodStart.toISOString()),

      // Өмнөх period-ийн захиалга + орлого (trend бодоход)
      supabase
        .from('orders')
        .select('total_amount, status, payment_status')
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

    // Period revenue (зөвхөн QPay төлбөр төлөгдсөн захиалгууд)
    const isPaid = (o: { payment_status?: string | null }) => o.payment_status === 'paid';

    const periodRevenue = periodOrdersList
      .filter(isPaid)
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Previous period stats (for trend %)
    const prevPeriodOrdersList = prevPeriodOrdersResult.data || [];
    const prevOrders = prevPeriodOrdersList.length;
    const prevRevenue = prevPeriodOrdersList
      .filter(isPaid)
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
      if (isPaid(o)) {
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

    // ─── Dashboard архетип (business_type-аар жолоодогдоно, legacy үед capability fallback) ───
    const shopMeta = shopMetaResult.data as
      | { ai_agent_capabilities?: string[] | null; business_type?: string | null }
      | null;
    const caps = shopMeta?.ai_agent_capabilities ?? [];
    const businessType = shopMeta?.business_type ?? null;
    const archetype = resolveArchetype(businessType, caps);
    const blocks = dashboardBlocks(businessType, caps);

    // business_type-аас үүдэх нэмэлт блокууд. `archetype` нь үндсэн layout-г
    // сонгоно; hybrid бизнест (ж: ресторан → cartFunnel + appointments) олон
    // блок зэрэг тооцоологдоно.
    let appointments: AppointmentsBlock | undefined;
    let leads: LeadsBlock | undefined;
    let cartFunnel: CartFunnelBlock | undefined;

    if (blocks.booking) {
      const [periodApptResult, upcomingApptResult] = await Promise.all([
        // Period доторх уулзалтууд (series + статусын задаргаа)
        supabase
          .from('appointments')
          .select('scheduled_at, status')
          .eq('shop_id', shopId)
          .gte('scheduled_at', periodStart.toISOString()),

        // Удахгүй болох уулзалтууд (цуцлагдаагүй)
        supabase
          .from('appointments')
          .select('id, scheduled_at, duration_minutes, status, customers (name, phone), products (name)')
          .eq('shop_id', shopId)
          .gte('scheduled_at', now.toISOString())
          .neq('status', 'cancelled')
          .order('scheduled_at', { ascending: true })
          .limit(8),
      ]);

      const periodAppts = periodApptResult.data || [];
      const apptSeries = Array.from({ length: bucketCount }, () => 0);
      const byHour = Array.from({ length: 24 }, () => 0); // цагийн слотын алдартай байдал
      const byWeekday = Array.from({ length: 7 }, () => 0); // Ня=0 … Бя=6
      const statusBreakdown = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
      periodAppts.forEach((a) => {
        const d = new Date(a.scheduled_at);
        const tt = d.getTime();
        const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((tt - periodStart.getTime()) / bucketMs)));
        apptSeries[idx] += 1;
        byHour[d.getHours()] += 1;
        byWeekday[d.getDay()] += 1;
        if (a.status && a.status in statusBreakdown) {
          statusBreakdown[a.status as keyof typeof statusBreakdown] += 1;
        }
      });

      const terminal = statusBreakdown.completed + statusBreakdown.no_show;
      const noShowRate = terminal > 0 ? Math.round((statusBreakdown.no_show / terminal) * 100) : 0;
      // Хамгийн ачаалалтай цаг (популяр слот)
      const peakHour = byHour.some((v) => v > 0) ? byHour.indexOf(Math.max(...byHour)) : null;

      appointments = {
        stats: {
          periodCount: periodAppts.length,
          upcomingCount: (upcomingApptResult.data || []).length,
          completedCount: statusBreakdown.completed,
          noShowRate,
          peakHour,
        },
        series: apptSeries,
        byHour,
        byWeekday,
        statusBreakdown,
        upcoming: upcomingApptResult.data || [],
      };
    }

    if (blocks.lead) {
      // Follow-up: утастай ч захиалгагүй, сүүлд холбогдсоноос 24ц өнгөрсөн lead-үүд
      const followUpCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [periodLeadListResult, recentLeadsResult, followUpListResult, followUpCountResult] = await Promise.all([
        // Period доторх lead-үүд (newLeads / qualified / converted / source-ийг JS-д тооцоход)
        supabase
          .from('customers')
          .select('platform, phone, total_orders')
          .eq('shop_id', shopId)
          .gte('created_at', periodStart.toISOString())
          .limit(2000),
        // Сүүлийн lead-үүд (нэрээр харуулах)
        supabase
          .from('customers')
          .select('id, name, phone, created_at, total_orders, is_vip')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false })
          .limit(8),
        // Follow-up дараалал
        supabase
          .from('customers')
          .select('id, name, phone, last_contact_at')
          .eq('shop_id', shopId)
          .not('phone', 'is', null)
          .eq('total_orders', 0)
          .lt('last_contact_at', followUpCutoff)
          .order('last_contact_at', { ascending: true })
          .limit(6),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .not('phone', 'is', null)
          .eq('total_orders', 0)
          .lt('last_contact_at', followUpCutoff),
      ]);

      const periodLeadList = periodLeadListResult.data || [];
      const newLeads = periodLeadList.length;
      const qualified = periodLeadList.filter((l) => !!l.phone).length;
      const converted = periodLeadList.filter((l) => (l.total_orders ?? 0) > 0).length;
      const bySource = { messenger: 0, instagram: 0, other: 0 };
      periodLeadList.forEach((l) => {
        if (l.platform === 'messenger') bySource.messenger += 1;
        else if (l.platform === 'instagram') bySource.instagram += 1;
        else bySource.other += 1;
      });

      leads = {
        stats: {
          newLeads,
          qualified,
          converted,
          conversionRate: newLeads > 0 ? Math.round((converted / newLeads) * 100) : 0,
        },
        bySource,
        recent: recentLeadsResult.data || [],
        followUp: {
          count: followUpCountResult.count || 0,
          items: followUpListResult.data || [],
        },
      };
    }

    if (blocks.commerce) {
      // Cart funnel — period доторх сагсны төлвийн задаргаа
      const { data: periodCarts } = await supabase
        .from('carts')
        .select('status')
        .eq('shop_id', shopId)
        .gte('created_at', periodStart.toISOString())
        .limit(5000);

      const carts = periodCarts || [];
      const activeCarts = carts.filter((c) => c.status === 'active').length;
      const convertedCarts = carts.filter((c) => c.status === 'checked_out').length;
      const abandonedCarts = carts.filter((c) => c.status === 'expired').length;
      const totalCarts = carts.length;
      cartFunnel = {
        active: activeCarts,
        converted: convertedCarts,
        abandoned: abandonedCarts,
        conversionRate: totalCarts > 0 ? Math.round((convertedCarts / totalCarts) * 100) : 0,
      };
    }

    return NextResponse.json({
      shop: { id: authShop.id, name: authShop.name },
      archetype,
      appointments,
      leads,
      cartFunnel,
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

