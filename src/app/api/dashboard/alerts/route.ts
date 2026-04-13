/**
 * Dashboard Alerts API
 * GET - Fetch active alerts (low stock, complaints, support requests)
 */

import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkLowStock } from '@/lib/services/StockService';
import { logger } from '@/lib/utils/logger';

export async function GET() {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const alerts: Array<{
            id: string;
            type: 'low_stock' | 'out_of_stock' | 'complaint' | 'support_request';
            severity: 'low' | 'medium' | 'high' | 'critical';
            title: string;
            description: string;
            timestamp: string;
            actionUrl?: string;
        }> = [];

        // 1. Low stock alerts
        const lowStock = await checkLowStock(shop.id);
        for (const item of lowStock.alerts) {
            const isOutOfStock = item.stock === 0;
            alerts.push({
                id: `stock-${item.productId}`,
                type: isOutOfStock ? 'out_of_stock' : 'low_stock',
                severity: isOutOfStock ? 'critical' : 'medium',
                title: isOutOfStock ? `🔴 "${item.name}" дууссан` : `⚠️ "${item.name}" нөөц бага`,
                description: isOutOfStock
                    ? 'Нөхөн оруулах шаардлагатай'
                    : `${item.stock} ширхэг үлдсэн (${item.reserved} нөөцлөгдсөн)`,
                timestamp: new Date().toISOString(),
                actionUrl: '/dashboard/products',
            });
        }

        // 2. Recent unresolved complaints (last 7 days, high severity)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: complaints } = await supabase
            .from('customer_complaints')
            .select('id, complaint_type, description, severity, created_at, customer_id')
            .eq('shop_id', shop.id)
            .gte('created_at', weekAgo)
            .in('severity', ['high', 'medium'])
            .order('created_at', { ascending: false })
            .limit(10);

        if (complaints) {
            for (const complaint of complaints) {
                alerts.push({
                    id: `complaint-${complaint.id}`,
                    type: 'complaint',
                    severity: complaint.severity === 'high' ? 'high' : 'medium',
                    title: `😤 Гомдол: ${complaint.complaint_type}`,
                    description: complaint.description?.slice(0, 100) || 'Тодорхойгүй',
                    timestamp: complaint.created_at,
                    actionUrl: `/dashboard/customers/${complaint.customer_id}`,
                });
            }
        }

        // Sort by severity (critical > high > medium > low)
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return NextResponse.json({
            alerts,
            counts: {
                total: alerts.length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                high: alerts.filter(a => a.severity === 'high').length,
                medium: alerts.filter(a => a.severity === 'medium').length,
            },
        });
    } catch (error) {
        logger.error('Dashboard alerts error:', { error });
        return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }
}
