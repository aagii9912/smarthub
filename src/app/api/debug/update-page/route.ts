import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Update Facebook page info for a shop
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_name, page_id, page_name, access_token } = body;

    if (!page_id || !access_token) {
      return NextResponse.json({ 
        error: 'page_id and access_token required',
        example: {
          shop_name: 'nybotuslah',
          page_id: '954582514405516',
          page_name: 'Your Page Name',
          access_token: 'EAAG...'
        }
      }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Find shop by name or update first shop if not specified
    let query = supabase.from('shops').select('*');
    if (shop_name) {
      query = query.eq('name', shop_name);
    }
    
    const { data: shops } = await query;
    const shop = shops?.[0];

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Update the shop
    const { data: updated, error } = await supabase
      .from('shops')
      .update({
        facebook_page_id: page_id,
        facebook_page_name: page_name || 'Facebook Page',
        facebook_page_access_token: access_token
      })
      .eq('id', shop.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Page updated successfully!',
      shop: {
        name: updated.name,
        page_id: updated.facebook_page_id,
        page_name: updated.facebook_page_name,
        has_token: !!updated.facebook_page_access_token
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

