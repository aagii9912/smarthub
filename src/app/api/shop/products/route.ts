import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST - Add products to shop
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'Products array required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Get user's shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Filter valid products
    const validProducts = products
      .filter((p: any) => p.name && p.price)
      .map((p: any) => ({
        shop_id: shop.id,
        name: p.name,
        price: parseFloat(p.price) || 0,
        description: p.description || null,
        type: p.type || 'physical',
        stock: p.type === 'service' ? null : (p.stock !== undefined && p.stock !== null && p.stock !== '' ? parseInt(p.stock) : 0),
        colors: p.colors || [],
        sizes: p.sizes || [],
        images: p.images || [],
        is_active: true
      }));

    if (validProducts.length === 0) {
      return NextResponse.json({ message: 'No valid products to add' });
    }

    // Insert products
    const { data: insertedProducts, error } = await supabase
      .from('products')
      .insert(validProducts)
      .select();

    if (error) throw error;

    // Mark setup as complete
    await supabase
      .from('shops')
      .update({ setup_completed: true })
      .eq('id', shop.id);

    return NextResponse.json({ 
      products: insertedProducts,
      message: `${insertedProducts.length} бүтээгдэхүүн нэмэгдлээ`
    });
  } catch (error: any) {
    console.error('Add products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

