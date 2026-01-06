import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Fix page ID - extract numeric ID from URL
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    
    // Get shops with URL-style page IDs
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, name, facebook_page_id')
      .not('facebook_page_id', 'is', null);

    if (error) throw error;

    const fixed = [];
    
    for (const shop of shops || []) {
      const pageId = shop.facebook_page_id;
      
      // Check if it's a URL and extract the ID
      if (pageId && pageId.includes('facebook.com')) {
        // Extract ID from URL like: https://www.facebook.com/profile.php?id=61585794814184
        const match = pageId.match(/id=(\d+)/);
        if (match) {
          const numericId = match[1];
          
          // Update the shop
          const { error: updateError } = await supabase
            .from('shops')
            .update({ facebook_page_id: numericId })
            .eq('id', shop.id);

          if (!updateError) {
            fixed.push({
              shop: shop.name,
              old_id: pageId,
              new_id: numericId
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Page IDs fixed!',
      fixed_count: fixed.length,
      details: fixed
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

