import { NextResponse, NextRequest } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

// Rate limit: Max 30 messages per minute
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60000;

export async function POST(request: NextRequest) {
    try {
        const authShop = await getUserShop();

        if (!authShop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const body = await request.json();
        const { message, customerIds, tag } = body;

        if (!message || !customerIds || customerIds.length === 0) {
            return NextResponse.json({ error: 'Message and recipients required' }, { status: 400 });
        }

        // Get shop with access token
        const { data: shop } = await supabase
            .from('shops')
            .select('facebook_page_id, page_access_token')
            .eq('id', authShop.id)
            .single();

        if (!shop?.page_access_token) {
            return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 });
        }

        // Get eligible customers (with facebook_id and within 24hr window)
        const { data: customers } = await supabase
            .from('customers')
            .select('id, facebook_id, last_contact_at')
            .in('id', customerIds)
            .eq('shop_id', authShop.id)
            .not('facebook_id', 'is', null);

        if (!customers || customers.length === 0) {
            return NextResponse.json({ error: 'No eligible customers found' }, { status: 400 });
        }

        // Filter by 24hr window
        const now = new Date();
        const eligibleCustomers = customers.filter(c => {
            if (!c.last_contact_at) return false;
            const lastContact = new Date(c.last_contact_at);
            const hoursDiff = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
            return hoursDiff <= 24;
        });

        if (eligibleCustomers.length === 0) {
            return NextResponse.json({
                error: 'No customers within 24hr messaging window'
            }, { status: 400 });
        }

        logger.info('Mass message sending:', {
            shopId: authShop.id,
            recipients: eligibleCustomers.length,
            tag
        });

        // Send messages (with rate limiting)
        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const customer of eligibleCustomers.slice(0, RATE_LIMIT)) {
            try {
                const response = await fetch(
                    `https://graph.facebook.com/v18.0/me/messages?access_token=${shop.page_access_token}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipient: { id: customer.facebook_id },
                            message: { text: message },
                            messaging_type: 'MESSAGE_TAG',
                            tag: 'CONFIRMED_EVENT_UPDATE' // Using allowed tag
                        })
                    }
                );

                if (response.ok) {
                    sent++;
                } else {
                    const error = await response.json();
                    failed++;
                    errors.push(error.error?.message || 'Unknown error');
                }

                // Small delay between messages (100ms)
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error: any) {
                failed++;
                errors.push(error.message);
            }
        }

        // Log result
        logger.info('Mass message result:', { sent, failed });

        // Save to marketing history (optional - table may not exist)
        try {
            await supabase.from('marketing_campaigns').insert({
                shop_id: authShop.id,
                message,
                recipients_count: eligibleCustomers.length,
                sent_count: sent,
                failed_count: failed,
                tag,
                created_at: new Date().toISOString()
            });
        } catch {
            // Table may not exist yet, ignore
        }

        return NextResponse.json({
            success: true,
            sent,
            failed,
            total: eligibleCustomers.length,
            errors: errors.slice(0, 3) // Return first 3 errors only
        });

    } catch (error: any) {
        logger.error('Mass message error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
