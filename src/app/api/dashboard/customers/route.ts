import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const shopId = '00000000-0000-0000-0000-000000000001';

    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_spent', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

