import { NextRequest, NextResponse } from 'next/server';
import { getClerkUserShop } from '@/lib/auth/clerk-auth';
import { supabaseAdmin } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
    try {
        const authShop = await getClerkUserShop();

        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const shopId = authShop.id;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'orders'; // orders | products | sales

        let workbook;
        let filename;

        if (type === 'orders') {
            // Export Orders
            const { data: orders } = await supabase
                .from('orders')
                .select(`
          id,
          total_amount,
          status,
          notes,
          delivery_address,
          created_at,
          customers (name, phone)
        `)
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false })
                .limit(500);

            const exportData = orders?.map(order => ({
                'Огноо': new Date(order.created_at).toLocaleDateString('mn-MN'),
                'Харилцагч': (order.customers as any)?.name || '-',
                'Утас': (order.customers as any)?.phone || '-',
                'Дүн': Number(order.total_amount),
                'Төлөв': translateStatus(order.status),
                'Хүргэлтийн хаяг': order.delivery_address || '-',
                'Тэмдэглэл': order.notes || '-',
            })) || [];

            workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Захиалгууд');
            filename = `захиалгууд_${new Date().toISOString().split('T')[0]}.xlsx`;

        } else if (type === 'products') {
            // Export Products
            const { data: products } = await supabase
                .from('products')
                .select('id, name, description, price, stock, is_active, type, discount_percent')
                .eq('shop_id', shopId)
                .order('name');

            const exportData = products?.map(product => ({
                'Нэр': product.name,
                'Тайлбар': product.description || '-',
                'Үнэ': Number(product.price),
                'Хөнгөлөлт %': product.discount_percent || 0,
                'Үлдэгдэл': product.stock || 0,
                'Төрөл': product.type === 'digital' ? 'Дижитал' : 'Биет',
                'Идэвхтэй': product.is_active ? 'Тийм' : 'Үгүй',
            })) || [];

            workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Бүтээгдэхүүн');
            filename = `бүтээгдэхүүн_${new Date().toISOString().split('T')[0]}.xlsx`;

        } else if (type === 'sales') {
            // Export Sales Report
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: orders } = await supabase
                .from('orders')
                .select(`
          total_amount,
          status,
          created_at,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
                .eq('shop_id', shopId)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .in('status', ['confirmed', 'processing', 'shipped', 'delivered'])
                .order('created_at', { ascending: false });

            const exportData: any[] = [];

            orders?.forEach(order => {
                const items = order.order_items as any[];
                items?.forEach(item => {
                    exportData.push({
                        'Огноо': new Date(order.created_at).toLocaleDateString('mn-MN'),
                        'Бүтээгдэхүүн': item.products?.name || '-',
                        'Тоо ширхэг': item.quantity,
                        'Нэгж үнэ': Number(item.unit_price),
                        'Нийт': item.quantity * Number(item.unit_price),
                        'Захиалгын төлөв': translateStatus(order.status),
                    });
                });
            });

            workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Борлуулалт');
            filename = `борлуулалт_${new Date().toISOString().split('T')[0]}.xlsx`;

        } else {
            return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
        }

        // Generate Excel buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            },
        });

    } catch (error) {
        console.error('Export API error:', error);
        return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
    }
}

function translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
        pending: 'Хүлээгдэж буй',
        confirmed: 'Баталгаажсан',
        processing: 'Боловсруулж байна',
        shipped: 'Хүргэлтэнд',
        delivered: 'Хүргэгдсэн',
        cancelled: 'Цуцлагдсан',
    };
    return statusMap[status] || status;
}
