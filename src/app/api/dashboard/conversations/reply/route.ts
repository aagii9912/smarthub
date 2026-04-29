import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTextMessage, sendTaggedMessage } from '@/lib/facebook/messenger';
import { logger } from '@/lib/utils/logger';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        // Step 1: Authenticate
        let shopId: string | null = null;

        const authShop = await getAuthUserShop();

        if (authShop) {
            shopId = authShop.id;
        } else {
            // Fallback: use x-shop-id header directly (for custom auth sessions)
            const headerList = await headers();
            const headerShopId = headerList.get('x-shop-id');
            if (headerShopId) {
                logger.info('Reply API: using x-shop-id header fallback', { shopId: headerShopId });
                shopId = headerShopId;
            }
        }

        if (!shopId) {
            logger.error('Reply API: No auth - getAuthUserShop returned null and no x-shop-id header');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { customerId, message, aiPauseMode } = await request.json();

        if (!customerId || !message) {
            return NextResponse.json({ error: 'customerId and message are required' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        // Step 2: Get customer's Facebook ID or Instagram ID
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('facebook_id, instagram_id, name')
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .single();

        if (customerError || !customer) {
            logger.error('Customer not found for reply', { customerId, shopId, error: customerError?.message });
            return NextResponse.json({ error: `Хэрэглэгч олдсонгүй (ID: ${customerId})` }, { status: 404 });
        }

        // Determine recipient: prefer facebook_id, fallback to instagram_id
        const recipientId = customer.facebook_id || customer.instagram_id;
        const platform = customer.facebook_id ? 'messenger' : 'instagram';

        if (!recipientId) {
            logger.error('Customer has no facebook_id or instagram_id', { customerId, customerName: customer.name });
            return NextResponse.json({ error: `${customer.name || 'Хэрэглэгч'}-д Facebook/Instagram ID байхгүй байна.` }, { status: 400 });
        }

        // Step 3: Get shop's Facebook page access token (used for both Messenger and IG messaging)
        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('facebook_page_access_token, name')
            .eq('id', shopId)
            .single();

        if (shopError || !shop?.facebook_page_access_token) {
            logger.error('Shop not configured with Facebook', { shopId, error: shopError?.message });
            return NextResponse.json({ error: 'Shop not configured with Facebook' }, { status: 400 });
        }

        // Step 4: Pre-flight messaging-window check.
        // Facebook policy: standard sends require the customer to have messaged within 24h.
        // HUMAN_AGENT tag can extend that to 7 days IF the app has the `human_agent` feature.
        // Beyond 7 days, no path can succeed — short-circuit with a structured 422.
        const { data: lastInbound } = await supabase
            .from('chat_history')
            .select('created_at')
            .eq('customer_id', customerId)
            .eq('shop_id', shopId)
            .not('message', 'is', null)
            .neq('message', '')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const lastInboundAt = lastInbound?.created_at ? new Date(lastInbound.created_at) : null;
        const hoursSinceLast = lastInboundAt
            ? (Date.now() - lastInboundAt.getTime()) / 3_600_000
            : Infinity;

        if (hoursSinceLast > 168) {
            logger.info('Reply API: blocked, conversation outside 7-day window', {
                customerId,
                hoursSinceLast: Math.round(hoursSinceLast),
            });
            return NextResponse.json({
                error: 'OUTSIDE_MESSAGING_WINDOW',
                code: 'OUTSIDE_MESSAGING_WINDOW',
                details: '7 хоногоос их хугацаа өнгөрсөн тул хариу илгээх боломжгүй.',
                last_customer_message_at: lastInboundAt?.toISOString() ?? null,
            }, { status: 422 });
        }

        // Step 5: Send message via Graph API (works for both Messenger and Instagram DM)
        logger.info('Reply API: Sending message', {
            shopName: shop.name,
            customerName: customer.name,
            recipientId,
            platform,
            messageLength: message.length,
            hoursSinceLast: Number.isFinite(hoursSinceLast) ? Math.round(hoursSinceLast) : null,
        });

        try {
            await sendTextMessage({
                recipientId,
                message: message,
                pageAccessToken: shop.facebook_page_access_token,
            });
        } catch (sendError: unknown) {
            const errMsg = sendError instanceof Error ? sendError.message : 'Unknown';
            logger.warn('Reply API: Standard message failed, trying HUMAN_AGENT tag', {
                error: errMsg,
                platform,
            });
            try {
                await sendTaggedMessage({
                    recipientId,
                    message: message,
                    pageAccessToken: shop.facebook_page_access_token,
                    tag: 'HUMAN_AGENT',
                });
            } catch (taggedError: unknown) {
                const taggedMsg = taggedError instanceof Error ? taggedError.message : 'Unknown';
                if (taggedMsg.includes('2018278') || /outside of allowed window/i.test(taggedMsg)) {
                    logger.info('Reply API: HUMAN_AGENT also blocked by FB window policy', {
                        customerId,
                        platform,
                    });
                    return NextResponse.json({
                        error: 'OUTSIDE_MESSAGING_WINDOW',
                        code: 'OUTSIDE_MESSAGING_WINDOW',
                        details: 'Хэрэглэгч 24 цагийн дотор бичээгүй учир Facebook хариу илгээхийг хориглож байна.',
                        last_customer_message_at: lastInboundAt?.toISOString() ?? null,
                    }, { status: 422 });
                }
                throw taggedError;
            }
        }

        // Step 6: Save message to chat_history
        const { error: insertError } = await supabase.from('chat_history').insert({
            shop_id: shopId,
            customer_id: customerId,
            message: '', // User message is empty for shop replies
            response: message, // Shop's reply goes in response
            intent: 'human_reply',
        });

        if (insertError) {
            logger.warn('Reply API: chat_history insert failed (non-blocking)', { error: insertError.message });
        }

        // Step 7: AI Takeover control
        if (aiPauseMode === 'off') {
            // Permanently disable AI for this customer (until manually re-enabled)
            const farFuture = new Date('2099-12-31T23:59:59Z').toISOString();
            await supabase
                .from('customers')
                .update({ ai_paused_until: farFuture })
                .eq('id', customerId);
            logger.info('Reply API: AI permanently disabled for customer', { customerId });
        } else {
            // Default: Pause AI for 30 minutes
            const pauseTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            await supabase
                .from('customers')
                .update({ ai_paused_until: pauseTime })
                .eq('id', customerId);
        }

        logger.info('Reply API: Message sent successfully', { shopId, customerId });

        return NextResponse.json({ success: true, message: 'Message sent successfully' });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        const errStack = error instanceof Error ? error.stack : undefined;
        logger.error('Reply API error:', { error: errMsg, stack: errStack });
        return NextResponse.json({
            error: 'Failed to send message',
            details: errMsg,
        }, { status: 500 });
    }
}
