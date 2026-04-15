/**
 * Analytics Export API
 * GET /api/dashboard/export?type=orders|customers|conversations&format=csv
 * 
 * Supports CSV export for orders, customers, and AI conversations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        // Get user's shop
        const { data: shop } = await supabase
            .from('shops')
            .select('id, name')
            .eq('owner_id', userId)
            .single();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type') || 'orders';
        const format = searchParams.get('format') || 'csv';
        const days = parseInt(searchParams.get('days') || '30', 10);

        const since = new Date();
        since.setDate(since.getDate() - days);

        let csvContent = '';
        let filename = '';

        switch (type) {
            case 'orders': {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('id, status, total_amount, created_at, customer_id, order_items(quantity, unit_price, products(name))')
                    .eq('shop_id', shop.id)
                    .gte('created_at', since.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(5000);

                csvContent = 'Order ID,Status,Total (₮),Date,Items\n';
                (orders || []).forEach(order => {
                    const items = (order.order_items as any[])
                        ?.map((i: any) => `${i.products?.[0]?.name || i.products?.name || 'Бараа'} x${i.quantity}`)
                        .join('; ') || '';
                    csvContent += `${order.id},${order.status},${order.total_amount},${order.created_at},"${items}"\n`;
                });
                filename = `syncly-orders-${days}d.csv`;
                break;
            }

            case 'customers': {
                const { data: customers } = await supabase
                    .from('customers')
                    .select('id, name, phone, email, vip_status, created_at, message_count')
                    .eq('shop_id', shop.id)
                    .order('message_count', { ascending: false })
                    .limit(5000);

                csvContent = 'Customer ID,Name,Phone,Email,VIP,Messages,Joined\n';
                (customers || []).forEach(c => {
                    csvContent += `${c.id},"${c.name || ''}",${c.phone || ''},${c.email || ''},${c.vip_status ? 'Yes' : 'No'},${c.message_count || 0},${c.created_at}\n`;
                });
                filename = `syncly-customers.csv`;
                break;
            }

            case 'conversations': {
                const { data: chats } = await supabase
                    .from('chat_messages')
                    .select('id, customer_id, sender, message, created_at, token_count')
                    .eq('shop_id', shop.id)
                    .gte('created_at', since.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(10000);

                csvContent = 'Message ID,Customer ID,Sender,Message,Tokens,Date\n';
                (chats || []).forEach(msg => {
                    const cleanMsg = (msg.message || '').replace(/"/g, '""').replace(/\n/g, ' ');
                    csvContent += `${msg.id},${msg.customer_id},${msg.sender},"${cleanMsg}",${msg.token_count || 0},${msg.created_at}\n`;
                });
                filename = `syncly-conversations-${days}d.csv`;
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid type. Use: orders, customers, conversations' }, { status: 400 });
        }

        if (format === 'json') {
            return NextResponse.json({
                success: true,
                data: csvContent,
                filename,
                rows: csvContent.split('\n').length - 2,
            });
        }

        // CSV download
        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        logger.error('Export API error:', { error: String(error) });
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
