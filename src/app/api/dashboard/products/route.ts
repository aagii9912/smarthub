import { NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createProductSchema, updateProductSchema, parseWithErrors } from '@/lib/validations';
import { logger } from '@/lib/utils/logger';

export async function GET() {
  try {
    const authShop = await getAuthUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    // `select('*')` so the optional lifecycle columns (status, available_from,
    // pre_order_eta, ai_instructions) come back when the migration is applied
    // and silently disappear when it isn't — letting the API stay green
    // through a staged rollout.
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ products: products || [] });
  } catch (error: unknown) {
    logger.error('Products API error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authShop = await getAuthUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Zod validation
    const validation = parseWithErrors(createProductSchema, body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const validData = validation.data;

    // Build the insert payload. The lifecycle/AI-instruction columns are
    // optional from the client and may not yet exist in the DB schema (the
    // migration runs as a separate deploy step). Try once with them, retry
    // without on a "column does not exist" error so existing shops keep
    // working through the staged migration.
    const baseInsert: Record<string, unknown> = {
      shop_id: shopId,
      name: validData.name,
      description: validData.description,
      price: validData.price,
      stock: validData.stock,
      discount_percent: validData.discountPercent,
      is_active: validData.isActive,
      type: validData.type,
      colors: validData.colors,
      sizes: validData.sizes,
      images: validData.images,
      duration_minutes: validData.durationMinutes,
      available_days: validData.availableDays,
      start_time: validData.startTime,
      end_time: validData.endTime,
      max_bookings_per_day: validData.maxBookingsPerDay,
      delivery_type: validData.deliveryType,
      delivery_fee: validData.deliveryFee,
    };

    const lifecycleExtras: Record<string, unknown> = {};
    if (validData.status !== undefined) {
      lifecycleExtras.status = validData.status;
    } else if (validData.isActive === false) {
      lifecycleExtras.status = 'draft';
    }
    if (validData.availableFrom !== undefined) lifecycleExtras.available_from = validData.availableFrom;
    if (validData.preOrderEta !== undefined) lifecycleExtras.pre_order_eta = validData.preOrderEta;
    if (validData.aiInstructions !== undefined) lifecycleExtras.ai_instructions = validData.aiInstructions;

    let { data, error } = await supabase
      .from('products')
      .insert([{ ...baseInsert, ...lifecycleExtras }])
      .select()
      .single();

    if (error && /column .+ does not exist/i.test(error.message || '')) {
      logger.warn('Product insert: retrying without lifecycle extras (migration not applied)', {
        error: error.message,
      });
      const retry = await supabase
        .from('products')
        .insert([baseInsert])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (error: unknown) {
    logger.error('Product create error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authShop = await getAuthUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Zod validation
    const validation = parseWithErrors(updateProductSchema, body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.errors
      }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const { id, ...validData } = validation.data;

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

    // Map camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (validData.name !== undefined) dbUpdates.name = validData.name;
    if (validData.description !== undefined) dbUpdates.description = validData.description;
    if (validData.price !== undefined) dbUpdates.price = validData.price;
    if (validData.stock !== undefined) dbUpdates.stock = validData.stock;
    if (validData.discountPercent !== undefined) dbUpdates.discount_percent = validData.discountPercent;
    if (validData.isActive !== undefined) dbUpdates.is_active = validData.isActive;
    if (validData.type !== undefined) dbUpdates.type = validData.type;
    if (validData.colors !== undefined) dbUpdates.colors = validData.colors;
    if (validData.sizes !== undefined) dbUpdates.sizes = validData.sizes;
    if (validData.images !== undefined) dbUpdates.images = validData.images;
    // Appointment-specific fields
    if (validData.durationMinutes !== undefined) dbUpdates.duration_minutes = validData.durationMinutes;
    if (validData.availableDays !== undefined) dbUpdates.available_days = validData.availableDays;
    if (validData.startTime !== undefined) dbUpdates.start_time = validData.startTime;
    if (validData.endTime !== undefined) dbUpdates.end_time = validData.endTime;
    if (validData.maxBookingsPerDay !== undefined) dbUpdates.max_bookings_per_day = validData.maxBookingsPerDay;
    // Delivery configuration
    if (validData.deliveryType !== undefined) dbUpdates.delivery_type = validData.deliveryType;
    if (validData.deliveryFee !== undefined) dbUpdates.delivery_fee = validData.deliveryFee;

    // Lifecycle (#8/#9/#10) + AI training (#2). Kept in a side-bag so we can
    // retry without them if the migration hasn't been applied yet.
    const lifecycleExtras: Record<string, unknown> = {};
    if (validData.status !== undefined) lifecycleExtras.status = validData.status;
    if (validData.availableFrom !== undefined) lifecycleExtras.available_from = validData.availableFrom;
    if (validData.preOrderEta !== undefined) lifecycleExtras.pre_order_eta = validData.preOrderEta;
    if (validData.aiInstructions !== undefined) lifecycleExtras.ai_instructions = validData.aiInstructions;

    let { data, error } = await supabase
      .from('products')
      .update({ ...dbUpdates, ...lifecycleExtras })
      .eq('id', id)
      .select()
      .single();

    if (error && /column .+ does not exist/i.test(error.message || '')) {
      logger.warn('Product update: retrying without lifecycle extras (migration not applied)', {
        error: error.message,
      });
      const retry = await supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (error: unknown) {
    logger.error('Product update error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authShop = await getAuthUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

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
  } catch (error: unknown) {
    logger.error('Product delete error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

