import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getStartOfPeriod } from '@/lib/utils/date';

export async function GET(request: NextRequest) {
    try {
        const authShop = await getClerkUserShop();

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
            vipCustomersResponse
        ] = await Promise.all([
            // 1. Current Period Orders (for Revenue & Status)
            supabase
                .from('orders')
                .select('id, total_amount, status, created_at')
                .eq('shop_id', shopId)
                .gte('created_at', periodStart.toISOString()),

            // 2. Previous Period Orders (only revenue statuses)
            supabase
                .from('orders')
                .select('total_amount')
                .eq('shop_id', shopId)
                .gte('created_at', prevPeriodStart.toISOString())
                .lt('created_at', periodStart.toISOString())
                .in('status', ['confirmed', 'processing', 'shipped', 'delivered']),

            // 3. Order Items (for Best Sellers)
            supabase
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
                .in('orders.status', ['confirmed', 'processing', 'shipped', 'delivered']),

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
                .eq('is_vip', true)
        ]);

        const allPeriodOrders = allPeriodOrdersResponse.data || [];
        const prevPeriodOrders = prevPeriodOrdersResponse.data || [];
        const orderItems = orderItemsResponse.data || [];
        const totalCustomers = totalCustomersResponse.count || 0;
        const newCustomers = newCustomersResponse.count || 0;
        const vipCustomers = vipCustomersResponse.count || 0;

        // Process Revenue (Filter for valid statuses)
        const validOrders = allPeriodOrders.filter(o =>
            ['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status)
        );

        const totalRevenue = validOrders.reduce((sum, order) =>
            sum + Number(order.total_amount), 0);

        const orderCount = validOrders.length;
        const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

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

        return NextResponse.json({
            period,
            periodStart: periodStart.toISOString(),
            revenue: {
                total: totalRevenue,
                orderCount,
                avgOrderValue,
                growth: revenueGrowth,
                prevPeriodTotal: prevRevenue,
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

    } catch (error) {
        console.error('Reports API error:', error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}
