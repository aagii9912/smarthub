import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPushNotificationVerbose } from '@/lib/notifications';
import { logger } from '@/lib/utils/logger';

interface TestResponse {
    vapidConfigured: boolean;
    subscriptionsFound: number;
    attempted: number;
    succeeded: number;
    failed: number;
    errors: { endpoint: string; statusCode?: number; message: string }[];
    reason?: 'vapid_not_configured' | 'db_error' | 'no_subscriptions';
}

export async function POST() {
    try {
        const authShop = await getAuthUserShop();
        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const vapidConfigured = Boolean(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
        );

        const supabase = supabaseAdmin();
        const { count } = await supabase
            .from('push_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('shop_id', authShop.id);
        const subscriptionsFound = count ?? 0;

        const result = await sendPushNotificationVerbose(authShop.id, {
            title: '🔔 Туршилтын мэдэгдэл',
            body: 'Push notification ажиллаж байна. Энэ мессежийг харж байгаа бол тохиргоо зөв.',
            tag: 'push-test',
            url: '/dashboard',
        });

        const response: TestResponse = result.ok
            ? {
                  vapidConfigured,
                  subscriptionsFound,
                  attempted: result.succeeded + result.failed,
                  succeeded: result.succeeded,
                  failed: result.failed,
                  errors: result.errors,
              }
            : {
                  vapidConfigured,
                  subscriptionsFound,
                  attempted: 0,
                  succeeded: 0,
                  failed: 0,
                  errors: [],
                  reason: result.reason,
              };

        return NextResponse.json(response);
    } catch (error: unknown) {
        logger.error('Push test endpoint error:', { error });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
