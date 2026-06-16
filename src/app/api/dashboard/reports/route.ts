import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfPeriod } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';
import { resolveArchetype } from '@/lib/dashboard/archetypes';
import { pickOne, type SupabaseRelation } from '@/types/supabase-helpers';

interface ReportProduct {
    id: string;
    name: string;
    images?: string[] | null;
}

interface DailyPoint {
    date: string;
    count: number;
    label: string;
}

interface AppointmentsReport {
    total: number;
    completed: number;
    noShow: number;
    cancelled: number;
    upcoming: number;
    noShowRate: number;
    completionRate: number;
    daily: DailyPoint[];
    byStatus: { pending: number; confirmed: number; completed: number; cancelled: number; no_show: number };
}

interface LeadsReport {
    newLeads: number;
    qualified: number;
    converted: number;
    conversionRate: number;
    bySource: { messenger: number; instagram: number; other: number };
    daily: DailyPoint[];
}

/** Build a zero-filled daily map from periodStart→today, then tally rows by date. */
function buildDaily(periodStart: Date, rows: Array<{ ts: string }>): DailyPoint[] {
    const map = new Map<string, number>();
    const cur = new Date(periodStart);
    const today = new Date();
    while (cur <= today) {
        map.set(cur.toISOString().split('T')[0], 0);
        cur.setDate(cur.getDate() + 1);
    }
    rows.forEach((r) => {
        const key = new Date(r.ts).toISOString().split('T')[0];
        if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
        .map(([date, count]) => ({ date, count, label: new Date(date).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' }) }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();

        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const shopId = authShop.id;

        // Get period from query params
        const { searchParams } = new URL(request.url);
        const period = (searchParams.get('period') || 'month') as 'today' | 'week' | 'month' | 'year';

        const periodStart = period === 'year'
            ? new Date(new Date().setFullYear(new Date().getFullYear() - 1))
            : getStartOfPeriod(period as 'today' | 'week' | 'month');

        // Previous period comparison
        const prevPeriodStart = new Date(periodStart);
        const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
        prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);

        // ============================================
        // 1. REVENUE STATISTICS
        // ============================================

        // Run independent queries in parallel
        const [
            allPeriodOrdersResponse,
            prevPeriodOrdersResponse,
            orderItemsResponse,
            totalCustomersResponse,
            newCustomersResponse,
            vipCustomersResponse,
            shopMetaResponse
        ] = await Promise.all([
            // 1. Current Period Orders (for Revenue & Status)
            supabase
                .from('orders')
                .select('id, total_amount, status, payment_status, payment_method, created_at')
                .eq('shop_id', shopId)
                .gte('created_at', periodStart.toISOString()),

            // 2. Previous Period Orders (revenue = paid orders, same
            //    definition as /api/dashboard/stats)
            supabase
                .from('orders')
                .select('total_amount')
                .eq('shop_id', shopId)
                .gte('created_at', prevPeriodStart.toISOString())
                .lt('created_at', periodStart.toISOString())
                .eq('payment_status', 'paid'),

            // 3. Order Items (for Best Sellers — paid orders only)
            supabase
                .from('order_items')
                .select(`
                    quantity,
                    unit_price,
                    product_id,
                    products (id, name, images, price),
                    orders!inner (shop_id, status, payment_status, created_at)
                `)
                .eq('orders.shop_id', shopId)
                .gte('orders.created_at', periodStart.toISOString())
                .eq('orders.payment_status', 'paid'),

            // 4. Customer Counts
            supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', shopId),

            // 5. New Customers
            supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', shopId)
                .gte('created_at', periodStart.toISOString()),

            // 6. VIP Customers
            supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('shop_id', shopId)
                .eq('is_vip', true),

            // 7. Shop capabilities (archetype-aware report blocks)
            supabase
                .from('shops')
                .select('ai_agent_capabilities')
                .eq('id', shopId)
                .single()
        ]);

        const allPeriodOrders = allPeriodOrdersResponse.data || [];
        const prevPeriodOrders = prevPeriodOrdersResponse.data || [];
        const orderItems = orderItemsResponse.data || [];
        const totalCustomers = totalCustomersResponse.count || 0;
        const newCustomers = newCustomersResponse.count || 0;
        const vipCustomers = vipCustomersResponse.count || 0;

        // Process Revenue — only paid orders count as revenue, matching
        // /api/dashboard/stats so both screens show the same number.
        const validOrders = allPeriodOrders.filter(o => o.payment_status === 'paid');

        const totalRevenue = validOrders.reduce((sum, order) =>
            sum + Number(order.total_amount), 0);

        const orderCount = validOrders.length;
        const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

        // Revenue transparency — breakdown by payment status & method.
        // All from allPeriodOrders (no extra query). "Нийт орлого" stays paid-only;
        // these fields let the UI disclose the rest (COD / pending / etc.).
        const paymentBreakdown = { paid: 0, pending: 0, failed: 0, refunded: 0 };
        const paymentCounts = { paid: 0, pending: 0, failed: 0, refunded: 0 };
        let codTotal = 0;
        let prepaidTotal = 0;
        allPeriodOrders.forEach(o => {
            const ps = (o.payment_status ?? 'pending') as keyof typeof paymentBreakdown;
            if (ps in paymentBreakdown) {
                paymentBreakdown[ps] += Number(o.total_amount);
                paymentCounts[ps] += 1;
            }
            if (o.payment_method === 'cod') codTotal += Number(o.total_amount);
            else prepaidTotal += Number(o.total_amount);
        });
        const grossOrderValue = allPeriodOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

        // Process Previous Period Revenue
        const prevRevenue = prevPeriodOrders.reduce((sum, order) =>
            sum + Number(order.total_amount), 0);

        const revenueGrowth = prevRevenue > 0
            ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
            : totalRevenue > 0 ? 100 : 0;

        // Process Best Sellers
        const productSalesMap = new Map<string, {
            id: string;
            name: string;
            image: string | null;
            quantity: number;
            revenue: number;
        }>();

        orderItems.forEach(item => {
            const product = pickOne(item.products as SupabaseRelation<ReportProduct>);
            if (!product) return;

            const existing = productSalesMap.get(product.id);
            const revenue = Number(item.quantity) * Number(item.unit_price);

            if (existing) {
                existing.quantity += item.quantity;
                existing.revenue += revenue;
            } else {
                productSalesMap.set(product.id, {
                    id: product.id,
                    name: product.name,
                    image: product.images?.[0] || null,
                    quantity: item.quantity,
                    revenue: revenue,
                });
            }
        });

        const bestSellersWithPercent = Array.from(productSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
            .map((product, index, array) => ({
                ...product,
                rank: index + 1,
                percent: array[0]?.revenue ? Math.round((product.revenue / array[0].revenue) * 100) : 0,
            }));

        // Process Chart Data (Daily Revenue)
        const dailyRevenueMap = new Map<string, number>();
        const currentDate = new Date(periodStart);
        const today = new Date();
        while (currentDate <= today) {
            const dateKey = currentDate.toISOString().split('T')[0];
            dailyRevenueMap.set(dateKey, 0);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        validOrders.forEach(order => {
            const dateKey = new Date(order.created_at).toISOString().split('T')[0];
            const current = dailyRevenueMap.get(dateKey) || 0;
            dailyRevenueMap.set(dateKey, current + Number(order.total_amount));
        });

        const revenueChartData = Array.from(dailyRevenueMap.entries())
            .map(([date, revenue]) => ({
                date,
                revenue: Math.round(revenue),
                label: new Date(date).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' }),
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Process Order Status Breakdown
        const statusBreakdown = {
            pending: 0,
            confirmed: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
        };

        allPeriodOrders.forEach(order => {
            if (order.status in statusBreakdown) {
                statusBreakdown[order.status as keyof typeof statusBreakdown]++;
            }
        });

        // ============================================
        // ARCHETYPE-AWARE BLOCKS (capability-driven, additive)
        // ============================================
        const caps = (shopMetaResponse.data?.ai_agent_capabilities as string[] | null) ?? [];
        const archetype = resolveArchetype(caps);

        let appointmentsReport: AppointmentsReport | undefined;
        let leadsReport: LeadsReport | undefined;

        if (caps.includes('booking')) {
            const { data: appts } = await supabase
                .from('appointments')
                .select('scheduled_at, status')
                .eq('shop_id', shopId)
                .gte('scheduled_at', periodStart.toISOString());
            const rows = appts || [];
            const byStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
            rows.forEach((a) => {
                if (a.status && a.status in byStatus) byStatus[a.status as keyof typeof byStatus] += 1;
            });
            const terminal = byStatus.completed + byStatus.no_show;
            appointmentsReport = {
                total: rows.length,
                completed: byStatus.completed,
                noShow: byStatus.no_show,
                cancelled: byStatus.cancelled,
                upcoming: byStatus.pending + byStatus.confirmed,
                noShowRate: terminal > 0 ? Math.round((byStatus.no_show / terminal) * 100) : 0,
                completionRate: rows.length > 0 ? Math.round((byStatus.completed / rows.length) * 100) : 0,
                daily: buildDaily(periodStart, rows.map((a) => ({ ts: a.scheduled_at }))),
                byStatus,
            };
        }

        if (caps.includes('lead_capture')) {
            const { data: leadRows } = await supabase
                .from('customers')
                .select('created_at, platform, phone, total_orders')
                .eq('shop_id', shopId)
                .gte('created_at', periodStart.toISOString())
                .limit(5000);
            const rows = leadRows || [];
            const bySource = { messenger: 0, instagram: 0, other: 0 };
            rows.forEach((l) => {
                if (l.platform === 'messenger') bySource.messenger += 1;
                else if (l.platform === 'instagram') bySource.instagram += 1;
                else bySource.other += 1;
            });
            const converted = rows.filter((l) => (l.total_orders ?? 0) > 0).length;
            leadsReport = {
                newLeads: rows.length,
                qualified: rows.filter((l) => !!l.phone).length,
                converted,
                conversionRate: rows.length > 0 ? Math.round((converted / rows.length) * 100) : 0,
                bySource,
                daily: buildDaily(periodStart, rows.map((l) => ({ ts: l.created_at }))),
            };
        }

        return NextResponse.json({
            period,
            periodStart: periodStart.toISOString(),
            archetype,
            appointments: appointmentsReport,
            leads: leadsReport,
            revenue: {
                total: totalRevenue,
                orderCount,
                avgOrderValue,
                growth: revenueGrowth,
                prevPeriodTotal: prevRevenue,
                grossTotal: grossOrderValue,
                unpaidTotal: grossOrderValue - totalRevenue,
                totalOrderCount: allPeriodOrders.length,
                paymentBreakdown,
                paymentCounts,
                codTotal,
                prepaidTotal,
            },
            bestSellers: bestSellersWithPercent,
            chartData: revenueChartData,
            customers: {
                total: totalCustomers,
                new: newCustomers,
                vip: vipCustomers,
            },
            orderStatus: statusBreakdown,
        });

    } catch (error: unknown) {
        logger.error('Reports API error:', { error: error });
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}
