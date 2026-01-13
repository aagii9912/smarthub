import { NextRequest, NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfPeriod } from '@/lib/utils/date';

export async function GET(request: NextRequest) {
    try {
        const authShop = await getUserShop();

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

        // ============================================
        // 1. REVENUE STATISTICS
        // ============================================

        // Get all orders in period
        const { data: periodOrders } = await supabase
            .from('orders')
            .select('id, total_amount, status, created_at')
            .eq('shop_id', shopId)
            .gte('created_at', periodStart.toISOString())
            .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

        const totalRevenue = periodOrders?.reduce((sum, order) =>
            sum + Number(order.total_amount), 0) || 0;

        const orderCount = periodOrders?.length || 0;
        const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

        // Previous period comparison
        const prevPeriodStart = new Date(periodStart);
        const periodDays = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
        prevPeriodStart.setDate(prevPeriodStart.getDate() - periodDays);

        const { data: prevPeriodOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('shop_id', shopId)
            .gte('created_at', prevPeriodStart.toISOString())
            .lt('created_at', periodStart.toISOString())
            .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

        const prevRevenue = prevPeriodOrders?.reduce((sum, order) =>
            sum + Number(order.total_amount), 0) || 0;

        const revenueGrowth = prevRevenue > 0
            ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
            : totalRevenue > 0 ? 100 : 0;

        // ============================================
        // 2. BEST SELLING PRODUCTS (Top 10)
        // ============================================

        const { data: orderItems } = await supabase
            .from('order_items')
            .select(`
        quantity,
        unit_price,
        product_id,
        products (id, name, images, price),
        orders!inner (shop_id, status, created_at)
      `)
            .eq('orders.shop_id', shopId)
            .gte('orders.created_at', periodStart.toISOString())
            .in('orders.status', ['confirmed', 'processing', 'shipped', 'delivered']);

        // Aggregate by product
        const productSalesMap = new Map<string, {
            id: string;
            name: string;
            image: string | null;
            quantity: number;
            revenue: number;
        }>();

        orderItems?.forEach(item => {
            const product = item.products as any;
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

        const bestSellers = Array.from(productSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        const maxRevenue = bestSellers[0]?.revenue || 1;
        const bestSellersWithPercent = bestSellers.map((product, index) => ({
            ...product,
            rank: index + 1,
            percent: Math.round((product.revenue / maxRevenue) * 100),
        }));

        // ============================================
        // 3. DAILY REVENUE CHART DATA
        // ============================================

        const dailyRevenueMap = new Map<string, number>();

        // Initialize all days in period
        const currentDate = new Date(periodStart);
        const today = new Date();
        while (currentDate <= today) {
            const dateKey = currentDate.toISOString().split('T')[0];
            dailyRevenueMap.set(dateKey, 0);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Fill with actual data
        periodOrders?.forEach(order => {
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

        // ============================================
        // 4. CUSTOMER ANALYTICS
        // ============================================

        const { count: totalCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId);

        const { count: newCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .gte('created_at', periodStart.toISOString());

        const { count: vipCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .eq('is_vip', true);

        // ============================================
        // 5. ORDER STATUS BREAKDOWN
        // ============================================

        const { data: statusData } = await supabase
            .from('orders')
            .select('status')
            .eq('shop_id', shopId)
            .gte('created_at', periodStart.toISOString());

        const statusBreakdown = {
            pending: 0,
            confirmed: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
        };

        statusData?.forEach(order => {
            if (order.status in statusBreakdown) {
                statusBreakdown[order.status as keyof typeof statusBreakdown]++;
            }
        });

        return NextResponse.json({
            period,
            periodStart: periodStart.toISOString(),

            // Revenue Stats
            revenue: {
                total: totalRevenue,
                orderCount,
                avgOrderValue,
                growth: revenueGrowth,
                prevPeriodTotal: prevRevenue,
            },

            // Best Sellers
            bestSellers: bestSellersWithPercent,

            // Chart Data
            chartData: revenueChartData,

            // Customer Stats
            customers: {
                total: totalCustomers || 0,
                new: newCustomers || 0,
                vip: vipCustomers || 0,
            },

            // Order Status
            orderStatus: statusBreakdown,
        });
    } catch (error) {
        console.error('Reports API error:', error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}
