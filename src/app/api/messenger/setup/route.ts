import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/messenger/setup
 * One-time setup: whitelist domains for Messenger Platform
 * This allows URLs from our domain to work properly in Messenger
 */
export async function POST() {
    try {
        const supabase = supabaseAdmin();
        
        // Get all shops with Facebook page access tokens
        const { data: shops, error } = await supabase
            .from('shops')
            .select('id, name, facebook_page_access_token, facebook_page_id')
            .not('facebook_page_access_token', 'is', null);

        if (error || !shops?.length) {
            return NextResponse.json({ error: 'No shops with FB tokens found' }, { status: 404 });
        }

        const results = [];
        const DOMAINS = [
            'https://syncly.mn',
            'https://www.syncly.mn',
        ];

        for (const shop of shops) {
            if (!shop.facebook_page_access_token) continue;

            try {
                // Set whitelisted domains via Messenger Profile API
                const response = await fetch(
                    `https://graph.facebook.com/v21.0/me/messenger_profile?access_token=${shop.facebook_page_access_token}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            whitelisted_domains: DOMAINS,
                        }),
                    }
                );

                const data = await response.json();
                
                results.push({
                    shop: shop.name,
                    success: response.ok,
                    data,
                });

                if (response.ok) {
                    logger.success(`Messenger domains whitelisted for ${shop.name}`);
                } else {
                    logger.error(`Failed to whitelist domains for ${shop.name}:`, { data });
                }
            } catch (err) {
                results.push({
                    shop: shop.name,
                    success: false,
                    error: String(err),
                });
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        logger.error('Messenger setup failed:', { error: String(error) });
        return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
    }
}
