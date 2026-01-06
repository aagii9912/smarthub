import { NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const authShop = await getUserShop();
    
    if (!authShop) {
      return NextResponse.json({ customers: [] });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_spent', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ customers: customers || [] });
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
