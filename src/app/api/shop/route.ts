import { NextRequest, NextResponse } from 'next/server';
import { getClerkUser, supabaseAdmin } from '@/lib/auth/clerk-auth';

// GET - Get user's shop
export async function GET() {
  try {
    const userId = await getClerkUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    const { data: shop, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({ shop });
  } catch (error: any) {
    console.error('Get shop error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create or update shop (upsert)
export async function POST(request: NextRequest) {
  try {
    const userId = await getClerkUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, owner_name, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Shop name required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Check if shop already exists
    const { data: existingShop } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingShop) {
      // Update existing shop instead of returning error
      const { data: updatedShop, error } = await supabase
        .from('shops')
        .update({ name, owner_name, phone })
        .eq('id', existingShop.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ shop: updatedShop });
    }

    // Create new shop
    const { data: shop, error } = await supabase
      .from('shops')
      .insert({
        name,
        owner_name,
        phone,
        user_id: userId,
        is_active: true,
        setup_completed: false
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ shop });
  } catch (error: any) {
    console.error('Create shop error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update shop
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getClerkUser();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = supabaseAdmin();

    // Get user's shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Update shop
    const { data: updatedShop, error } = await supabase
      .from('shops')
      .update(body)
      .eq('id', shop.id)
      .select()
      .single();

    if (error) {
      console.error('Update shop DB error:', error);
      throw error;
    }

    return NextResponse.json({ shop: updatedShop });
  } catch (error: any) {
    console.error('Update shop error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
