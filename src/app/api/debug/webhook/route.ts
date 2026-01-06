import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Debug endpoint to check webhook configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    
    // Get all shops with Facebook page connected
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, facebook_page_id, facebook_page_name, facebook_page_access_token, is_active')
      .not('facebook_page_id', 'is', null);

    if (error) {
      return NextResponse.json({ 
        error: error.message,
        hint: 'Database error - check if facebook_page_access_token column exists'
      }, { status: 500 });
    }

    const diagnostics = shops?.map(shop => ({
      shop_name: shop.name,
      page_id: shop.facebook_page_id,
      page_name: shop.facebook_page_name,
      has_access_token: !!shop.facebook_page_access_token,
      token_length: shop.facebook_page_access_token?.length || 0,
      is_active: shop.is_active
    }));

    return NextResponse.json({
      message: 'Webhook debug info',
      verify_token: process.env.FACEBOOK_VERIFY_TOKEN ? 'SET' : 'NOT SET (using default)',
      webhook_url: 'https://smarthub-opal.vercel.app/api/webhook',
      connected_shops: diagnostics?.length || 0,
      shops: diagnostics,
      checklist: {
        '1_webhook_verified': 'Check Facebook Developer Console > Webhooks',
        '2_page_subscribed': 'Messenger > Settings > Webhooks > Add subscriptions',
        '3_events_selected': 'messages, messaging_postbacks, messaging_optins',
        '4_token_saved': diagnostics?.some(s => s.has_access_token) ? '✅ At least one shop has token' : '❌ No shops have access token',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

