import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const envPageId = process.env.FACEBOOK_PAGE_ID;
    const pageId = searchParams.get('pageId') || envPageId;
    const shopName = searchParams.get('name') || 'Аагий Shop';

    if (!pageId) {
        return NextResponse.json({ error: 'Page ID not provided and not in env' });
    }

    // Check if shop exists
    const { data: existingShop } = await supabase
        .from('shops')
        .select('*')
        .eq('facebook_page_id', pageId)
        .single();

    if (existingShop) {
        return NextResponse.json({ message: 'Shop already exists', shop: existingShop });
    }

    // Create shop
    const { data: newShop, error } = await supabase
        .from('shops')
        .insert({
            name: shopName,
            facebook_page_id: pageId
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: 'Shop Create Error: ' + error.message });
    }

    // Add some dummy products
    const { error: prodError } = await supabase.from('products').insert([
        { shop_id: newShop.id, name: 'iPhone 15 Pro', price: 4500000, stock: 10 },
        { shop_id: newShop.id, name: 'MacBook Air M3', price: 3800000, stock: 5 },
        { shop_id: newShop.id, name: 'AirPods Pro 2', price: 850000, stock: 20 }
    ]);

    if (prodError) {
        return NextResponse.json({ message: 'Shop created but products failed', error: prodError.message, shop: newShop });
    }

    return NextResponse.json({ message: 'Shop and products created successfully', shop: newShop });
}
