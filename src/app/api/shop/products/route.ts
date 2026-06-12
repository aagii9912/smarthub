import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getAuthUserShop, supabaseAdmin } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';
import { logProductImport } from '@/lib/services/importAudit';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';

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

    interface VariantInput {
      sku?: string;
      options: { color?: string; size?: string };
      price?: number;
      stock: number;
    }

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
      variants?: VariantInput[];
    }

    // Filter valid products
    const validInputs = (products as ProductInput[]).filter((p) => p.name && p.price);
    const validProducts = validInputs.map((p) => ({
        shop_id: shop.id,
        name: p.name,
        price: parseFloat(String(p.price ?? 0)) || 0,
        description: p.description || null,
        type: p.type || 'physical',
        stock: p.type === 'service' ? null : (p.stock !== undefined && p.stock !== null && p.stock !== '' ? parseInt(String(p.stock), 10) : 0),
        colors: p.colors || [],
        sizes: p.sizes || [],
        images: p.images || [],
        has_variants: (p.variants?.length ?? 0) > 0,
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

    // Excel импортоос ирсэн хувилбаруудыг бичнэ — нөөцийг trigger эцэг рүү нэгтгэнэ
    const variantsToInsert = insertedProducts.flatMap((inserted: { id: string }, i: number) =>
      (validInputs[i].variants || []).map((v) => ({
        product_id: inserted.id,
        sku: v.sku || null,
        name: [v.options.color, v.options.size].filter(Boolean).join(' / '),
        options: v.options,
        price: v.price ?? null,
        stock: v.stock,
        is_active: true,
      }))
    );

    if (variantsToInsert.length > 0) {
      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert);
      if (variantError) throw variantError;
    }

    // Note: setup_completed is set AFTER subscription payment is verified
    // in check-payment or webhook handler — NOT here

    // Push notification — bulk imports only (heuristic: 3+ products in one call).
    // Manual single-product additions don't merit a notification, but Excel
    // imports always include many rows.
    if (insertedProducts && insertedProducts.length >= 3) {
      const userId = await getAuthUser();
      await logProductImport({
        shop_id: shop.id,
        user_id: userId,
        action: 'import',
        source: 'setup',
        total_rows: products.length,
        imported_count: insertedProducts.length,
        skipped_count: products.length - validProducts.length,
        status: products.length > validProducts.length ? 'partial' : 'success',
      });

      try {
        const enabled = await isNotificationEnabled(shop.id, 'import');
        if (enabled) {
          await sendPushNotification(shop.id, {
            title: '📥 Бараа импорт дууслаа',
            body: `${insertedProducts.length} бараа амжилттай нэмэгдлээ`,
            url: '/dashboard/products',
            tag: `import-${shop.id}-${Date.now()}`,
          });
        }
      } catch (pushErr) {
        logger.warn('Product import push failed:', { error: String(pushErr) });
      }
    }

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

