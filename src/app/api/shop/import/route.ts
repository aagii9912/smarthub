import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { parseProductFile, ParsedProduct } from '@/lib/utils/file-parser';

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
                setAll() { },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// POST - Import products from Excel/DOCX file
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const preview = formData.get('preview') === 'true';

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse file
        const products = await parseProductFile(buffer, file.name);

        if (products.length === 0) {
            return NextResponse.json({
                error: 'Файлаас бүтээгдэхүүн олдсонгүй. Формат шалгана уу.',
                hint: 'Excel: Нэр, Үнэ баганууд байх ёстой. DOCX: "Нэр - Үнэ" формат'
            }, { status: 400 });
        }

        // If preview mode, just return parsed products
        if (preview) {
            return NextResponse.json({
                preview: true,
                products,
                count: products.length
            });
        }

        // Get user's shop
        const supabase = supabaseAdmin();
        const { data: shop } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (!shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
        }

        // Prepare products for database
        const productsToInsert = products.map((p: ParsedProduct) => ({
            shop_id: shop.id,
            name: p.name,
            price: p.price,
            description: p.description || null,
            stock: p.stock ?? 0,
            type: p.type || 'physical',
            colors: p.colors || [],
            sizes: p.sizes || [],
            images: [],
            is_active: true
        }));

        // Insert products
        const { data: insertedProducts, error } = await supabase
            .from('products')
            .insert(productsToInsert)
            .select();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            products: insertedProducts,
            count: insertedProducts.length,
            message: `${insertedProducts.length} бүтээгдэхүүн амжилттай импорт хийгдлээ!`
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({
            error: error.message || 'Import failed',
        }, { status: 500 });
    }
}
