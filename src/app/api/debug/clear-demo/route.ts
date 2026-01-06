import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Clear Facebook page from demo shop
export async function POST() {
  try {
    const supabase = supabaseAdmin();

    // Clear demo shop's Facebook connection
    const { error } = await supabase
      .from('shops')
      .update({
        facebook_page_id: null,
        facebook_page_name: null,
        facebook_page_access_token: null
      })
      .eq('name', 'Demo Дэлгүүр');

    if (error) throw error;

    return NextResponse.json({ message: 'Demo shop Facebook cleared!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

