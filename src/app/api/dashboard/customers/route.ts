import { NextResponse, NextRequest } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { phoneLookupVariants } from '@/lib/utils/phone';

export async function GET(request: NextRequest) {
  try {
    const authShop = await getAuthUserShop();

    logger.debug('[Customers API] authShop:', { shop: authShop ? { id: authShop.id, name: authShop.name } : null });

    if (!authShop) {
      logger.debug('[Customers API] No authShop found, returning empty array');
      return NextResponse.json({ customers: [] });
    }

    const supabase = supabaseAdmin();
    const shopId = authShop.id;

    // Get query params for filtering/searching
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? true : false;

    let query = supabase
      .from('customers')
      // `tags` and `last_contact_at` power the lead pipeline view — the page's
      // Customer type already declared them but the select never fetched them,
      // so every stage badge rendered empty.
      .select('id, name, facebook_id, phone, address, total_orders, total_spent, is_vip, created_at, tags, last_contact_at')
      .eq('shop_id', shopId);

    // Search by name or phone
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Filter by tag
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    // Sort
    query = query.order(sortBy, { ascending: sortOrder, nullsFirst: false });

    const { data: customers, error } = await query;

    logger.debug('[Customers API] Query result', { count: customers?.length, error });

    if (error) throw error;

    return NextResponse.json({ customers: customers || [] });
  } catch (error: unknown) {
    logger.error('Customers API error:', { error: error });
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}


/**
 * Create a lead / customer by hand.
 *
 * A broker's leads do not all arrive through Messenger — plenty come from a
 * phone call, a walk-in or a referral. The dashboard's primary CTA pointed at
 * this page's "Шинэ харилцагч" button, which did nothing because there was no
 * POST handler at all.
 */
export async function POST(request: NextRequest) {
  try {
    const authShop = await getAuthUserShop();
    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    if (!name && !phone) {
      return NextResponse.json({ error: 'Нэр эсвэл утас оруулна уу' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Дугаараар давхардвал шинэ мөр үүсгэхгүй — брокер нэг хүнийг хоёр удаа
    // бүртгэвэл дараа нь юу нь жинхэнэ нь болох нь ойлгомжгүй болно.
    if (phone) {
      // Same variant set the comment-lead bridge uses, so a number captured from
      // a comment and one typed in here resolve to the same person.
      const variants = phoneLookupVariants(phone);
      const { data: existingRows } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', authShop.id)
        .in('phone', variants.length > 0 ? variants : [phone])
        .limit(1);
      const existing = existingRows?.[0];
      if (existing?.id) {
        return NextResponse.json(
          { error: 'Энэ дугаартай харилцагч аль хэдийн бүртгэлтэй байна', customerId: existing.id },
          { status: 409 },
        );
      }
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        shop_id: authShop.id,
        name: name || null,
        phone: phone || null,
        email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
        address: typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [],
        platform: 'manual',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ customer, message: 'Customer created' }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Customer create error:', { error });
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

// Update customer info
export async function PATCH(request: NextRequest) {
  try {
    const authShop = await getAuthUserShop();

    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const body = await request.json();
    const { id, name, phone, email, notes, tags, contacted } = body;

    if (!id) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    // Verify customer belongs to shop
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .eq('shop_id', authShop.id)
      .single();

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Build update object (only include provided fields)
    const updateData: Partial<{
      name: string;
      phone: string;
      email: string;
      notes: string;
      tags: string[];
      last_contact_at: string;
    }> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (notes !== undefined) updateData.notes = notes;
    if (tags !== undefined) updateData.tags = tags;
    // `contacted: true` records an OFF-PLATFORM contact — the phone call the
    // follow-up queue asks a broker to make. Replying in the inbox already bumps
    // last_contact_at via the chat_history trigger, but a call left no trace, so
    // the same lead re-entered the queue forever.
    if (contacted === true) updateData.last_contact_at = new Date().toISOString();

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ customer, message: 'Customer updated' });
  } catch (error: unknown) {
    logger.error('Customer update error:', { error: error });
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

// Delete customer
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: resolve the shop ONLY via getAuthUserShop(), which scopes the
    // x-shop-id header by user_id. The previous raw-header fallback let any
    // caller delete another shop's customer (and its chat history / cart items /
    // complaints) by spoofing the header — these deletes run on the service-role
    // client, which bypasses RLS. Mirrors GET/PATCH above.
    const authShop = await getAuthUserShop();
    if (!authShop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopId = authShop.id;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('id');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Verify customer belongs to shop
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .eq('shop_id', shopId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Delete related records first
    await supabase.from('chat_history').delete().eq('customer_id', customerId);
    await supabase.from('cart_items').delete().eq('customer_id', customerId);
    await supabase.from('customer_complaints').delete().eq('customer_id', customerId);

    // Delete customer
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('shop_id', shopId);

    if (error) throw error;

    logger.info('Customer deleted', { customerId, customerName: customer.name, shopId });
    return NextResponse.json({ success: true, message: 'Customer deleted' });
  } catch (error: unknown) {
    logger.error('Customer delete error:', { error });
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
