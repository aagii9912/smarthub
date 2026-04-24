import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';

const updateSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(['new', 'in_progress', 'resolved', 'dismissed']),
    resolution_notes: z.string().optional()
});

export async function GET(request: NextRequest) {
    try {
        const shopId = request.headers.get('x-shop-id');

        if (!shopId) {
            return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data, error } = await supabase
            .from('customer_complaints')
            .select(`
                *,
                customers (
                    name,
                    phone
                )
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false });

        if (error) {
            // If table doesn't exist, return empty array
            if (error.code === '42P01') {
                return NextResponse.json({ complaints: [] });
            }
            throw error;
        }

        return NextResponse.json({ complaints: data || [] });
    } catch (error: unknown) {
        logger.error('Get complaints error:', { error: error });
        return NextResponse.json(
            { error: 'Гомдол авахад алдаа гарлаа' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const shopId = request.headers.get('x-shop-id');

        if (!shopId) {
            return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
        }

        const body = await request.json();
        const parsed = updateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Буруу өгөгдөл', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { id, status, resolution_notes } = parsed.data;
        const supabase = supabaseAdmin();

        // Load previous state to detect status change
        const { data: prev } = await supabase
            .from('customer_complaints')
            .select('status, complaint_type, description, severity')
            .eq('id', id)
            .eq('shop_id', shopId)
            .single();

        const { data, error } = await supabase
            .from('customer_complaints')
            .update({
                status,
                resolution_notes: resolution_notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('shop_id', shopId)
            .select()
            .single();

        if (error) throw error;

        // Fire push notification on status change
        if (prev && prev.status !== status) {
            const statusMap: Record<string, { title: string; body: string }> = {
                in_progress: {
                    title: '⏳ Гомдол хянагдаж байна',
                    body: `"${(prev.description || '').slice(0, 60)}..." гомдлыг хянаж эхэллээ.`,
                },
                resolved: {
                    title: '✅ Гомдол шийдэгдлээ',
                    body: `"${(prev.description || '').slice(0, 60)}..." гомдол шийдвэрлэгдсэн.`,
                },
                dismissed: {
                    title: '❎ Гомдол хаагдлаа',
                    body: `"${(prev.description || '').slice(0, 60)}..." гомдол хаагдсан.`,
                },
                new: {
                    title: '🔄 Гомдол дахин идэвхжлээ',
                    body: `Гомдол шинэчлэгдэж шинээр нээгдлээ.`,
                },
            };

            const notif = statusMap[status];
            if (notif) {
                try {
                    await sendPushNotification(shopId, {
                        ...notif,
                        url: '/dashboard/complaints',
                        tag: `complaint-status-${id}`,
                        actions: [{ action: 'view', title: 'Харах' }],
                    });
                } catch (pushErr) {
                    logger.warn('Complaint status push notification failed (non-critical)', { error: String(pushErr) });
                }
            }
        }

        return NextResponse.json({ success: true, complaint: data });
    } catch (error: unknown) {
        logger.error('Update complaint error:', { error: error });
        return NextResponse.json(
            { error: 'Гомдол шинэчлэхэд алдаа гарлаа' },
            { status: 500 }
        );
    }
}
