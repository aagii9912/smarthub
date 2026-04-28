import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { sendTextMessage } from '@/lib/facebook/messenger';

const REMINDER_MESSAGE_MN =
    'Таны сагсанд бараа үлдсэн байна. Та худалдан авалтаа дуусгах уу? 🛒';

/**
 * POST /api/dashboard/inbox/remind
 * Send a reminder to a customer about their active cart
 */
export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { customerId } = body;

        if (!customerId) {
            return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // 1. Get customer + the shop's stored FB/IG page tokens.
        const [{ data: customer, error: customerError }, { data: shopRow }] = await Promise.all([
            supabase
                .from('customers')
                .select('id, name, facebook_id, phone, platform')
                .eq('id', customerId)
                .single(),
            supabase
                .from('shops')
                .select('facebook_page_access_token, instagram_access_token')
                .eq('id', shop.id)
                .single(),
        ]);

        if (customerError || !customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        let sentMethod = 'none';

        // 2. Try sending the actual Messenger DM if the shop has the page token.
        if (customer.facebook_id) {
            // For Instagram-only customers, fall back to the IG token alias (Page token).
            const pageAccessToken =
                shopRow?.facebook_page_access_token || shopRow?.instagram_access_token;

            if (pageAccessToken) {
                try {
                    await sendTextMessage({
                        recipientId: customer.facebook_id,
                        message: REMINDER_MESSAGE_MN,
                        pageAccessToken,
                    });
                    sentMethod = customer.platform === 'instagram' ? 'instagram' : 'facebook';
                } catch (fbError) {
                    logger.error('Failed to send DM reminder', { error: fbError, shopId: shop.id });
                }
            } else {
                logger.warn('Shop has no page access token — DM reminder skipped', { shopId: shop.id });
                sentMethod = 'no_token';
            }
        }

        // 3. Fallback / Log
        // We'll send a push notification to the Admin (Shop Owner) confirming the action was taken/attempted
        await sendPushNotification(shop.id, {
            title: '🔔 Сануулга илгээлээ',
            body: `${customer.name}-д сагсны сануулга илгээгдлээ (${sentMethod})`,
            tag: `remind-${customerId}`
        });

        const userMessage =
            sentMethod === 'facebook'
                ? 'Сануулга амжилттай илгээгдлээ (Facebook)'
                : sentMethod === 'instagram'
                    ? 'Сануулга амжилттай илгээгдлээ (Instagram)'
                    : sentMethod === 'no_token'
                        ? 'Шуудан илгээх Page токен тохируулагдаагүй'
                        : 'Сануулга илгээх боломжгүй';

        return NextResponse.json({
            success: sentMethod === 'facebook' || sentMethod === 'instagram',
            method: sentMethod,
            message: userMessage,
        });

    } catch (error: unknown) {
        logger.error('Reminder API error:', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Error' }, { status: 500 });
    }
}
