import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();

        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { subscription } = body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        const supabase = supabaseAdmin();
        const shopId = authShop.id;

        // Upsert subscription (update if exists, insert if new)
        const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert({
                shop_id: shopId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                user_agent: request.headers.get('user-agent') || 'unknown',
            }, {
                onConflict: 'endpoint',
                ignoreDuplicates: false,
            })
            .select()
            .single();

        if (error) {
            logger.error('Subscription error:', { error: error });
            return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Push notification subscribed!',
            id: data.id
        });
    } catch (error: unknown) {
        logger.error('Push subscribe error:', { error: error });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();

        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { endpoint } = body;

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Зөвхөн өөрийн shop-ын subscription-ыг устгана. shop_id хязгаар
        // нь өөр shop-ын subscription-ыг тохиолдлоор устгахаас сэргийлнэ.
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)
            .eq('shop_id', authShop.id);

        if (error) {
            logger.error('Push unsubscribe DB error:', { error });
            return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Unsubscribed' });
    } catch (error: unknown) {
        logger.error('Push unsubscribe error:', { error: error });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
