import { NextResponse } from 'next/server';
import { getUserShop } from '@/lib/auth/server-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const authShop = await getUserShop();
    
    if (!authShop) {
      return NextResponse.json({ products: [] });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ products: products || [] });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authShop = await getUserShop();
    
    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const body = await request.json();

    const { data, error } = await supabase
      .from('products')
      .insert([{
        shop_id: shopId,
        name: body.name,
        description: body.description,
        price: body.price,
        stock: body.stock,
        is_active: true,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error('Product create error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authShop = await getUserShop();
    
    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const body = await request.json();
    const { id, ...updates } = body;

    // Verify product belongs to shop
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single();

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authShop = await getUserShop();
    
    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Verify product belongs to shop
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single();

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product delete error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
