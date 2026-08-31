/**
 * Analytics Export API
 * GET /api/dashboard/export?type=orders|customers|conversations&format=csv
 * 
 * Supports CSV export for orders, customers, and AI conversations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUserShop } from '@/lib/auth/auth';
import { pickOne, type OrderItemRow } from '@/types/supabase-helpers';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
    try {
        // Resolve via getAuthUserShop() so the export follows the shop the user
        // has actually selected. The old `.eq('user_id').single()` ignored
        // x-shop-id entirely and errored outright for anyone owning more than
        // one shop, returning "Shop not found".
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

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
                    const items = ((order.order_items ?? []) as OrderItemRow[])
                        .map((i) => `${pickOne(i.products)?.name ?? 'Бараа'} x${i.quantity}`)
                        .join('; ');
                    csvContent += `${order.id},${order.status},${order.total_amount},${order.created_at},"${items}"\n`;
                });
                filename = `syncly-orders-${days}d.csv`;
                break;
            }

            case 'customers': {
                // `vip_status` does not exist on this table — the column is
                // `is_vip`. PostgREST rejected the whole select, the error was
                // swallowed, and the broker downloaded a header-only CSV.
                const { data: customers, error: customersError } = await supabase
                    .from('customers')
                    .select('id, name, phone, email, is_vip, created_at, message_count, platform, tags, last_contact_at')
                    .eq('shop_id', shop.id)
                    .order('message_count', { ascending: false })
                    .limit(5000);

                if (customersError) {
                    logger.error('Customer export query failed', { error: customersError.message });
                    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
                }

                csvContent = 'Customer ID,Name,Phone,Email,VIP,Messages,Source,Tags,Last contact,Joined\n';
                const csvCell = (s: string | null | undefined) => `"${(s || '').replace(/"/g, '""')}"`;
                (customers || []).forEach(c => {
                    const tags = Array.isArray(c.tags) ? c.tags.join(' | ') : '';
                    csvContent += `${c.id},${csvCell(c.name)},${c.phone || ''},${c.email || ''},${c.is_vip ? 'Yes' : 'No'},${c.message_count || 0},${c.platform || ''},${csvCell(tags)},${c.last_contact_at || ''},${c.created_at}\n`;
                });
                filename = `syncly-customers.csv`;
                break;
            }

            case 'conversations': {
                // chat_history stores customer-message + AI-response pairs in one row.
                // Flatten each row into two CSV rows (customer + ai) for analytics export.
                const { data: chats } = await supabase
                    .from('chat_history')
                    .select('id, customer_id, message, response, intent, created_at')
                    .eq('shop_id', shop.id)
                    .gte('created_at', since.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(10000);

                csvContent = 'Message ID,Customer ID,Sender,Message,Intent,Date\n';
                const escape = (s: string | null) => (s || '').replace(/"/g, '""').replace(/\n/g, ' ');
                (chats || []).forEach(row => {
                    if (row.message) {
                        csvContent += `${row.id},${row.customer_id},customer,"${escape(row.message)}",${row.intent || ''},${row.created_at}\n`;
                    }
                    if (row.response) {
                        csvContent += `${row.id},${row.customer_id},ai,"${escape(row.response)}",${row.intent || ''},${row.created_at}\n`;
                    }
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
