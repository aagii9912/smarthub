import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop, supabaseAdmin } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';

// POST - Add products to shop
export async function POST(request: NextRequest) {
  try {
    const shop = await getAuthUserShop();

    if (!shop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: 'Products array required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    interface ProductInput {
      name?: string;
      price?: string | number;
      description?: string | null;
      type?: 'physical' | 'service' | 'appointment';
      stock?: string | number | null;
      colors?: string[];
      sizes?: string[];
      discount_percent?: number;
      images?: string[];
      image_url?: string;
    }

    // Filter valid products
    const validProducts = (products as ProductInput[])
      .filter((p) => p.name && p.price)
      .map((p) => ({
        shop_id: shop.id,
        name: p.name,
        price: parseFloat(String(p.price ?? 0)) || 0,
        description: p.description || null,
        type: p.type || 'physical',
        stock: p.type === 'service' ? null : (p.stock !== undefined && p.stock !== null && p.stock !== '' ? parseInt(String(p.stock), 10) : 0),
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

    // Note: setup_completed is set AFTER subscription payment is verified
    // in check-payment or webhook handler — NOT here

    return NextResponse.json({
      products: insertedProducts,
      message: `${insertedProducts.length} бүтээгдэхүүн нэмэгдлээ`
    });
  } catch (error: unknown) {
    logger.error('Add products error:', { error: error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// DELETE - Wipe all products for this shop. Used when the user changes their
// business type mid-wizard and the previously-entered products no longer apply.
export async function DELETE() {
  try {
    const shop = await getAuthUserShop();
    if (!shop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('shop_id', shop.id);

    if (error) throw error;
    return NextResponse.json({ message: 'Products cleared' });
  } catch (error: unknown) {
    logger.error('Clear products error:', { error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

