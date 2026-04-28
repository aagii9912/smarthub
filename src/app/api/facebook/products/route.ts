import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Facebook Shop/Catalog Products API
// Fetches products from Facebook Commerce catalog

interface FBProduct {
    id: string;
    name: string;
    description?: string;
    price?: string;
    currency?: string;
    image_url?: string;
    availability?: string;
    url?: string;
}

export async function GET(request: NextRequest) {
    try {
        // 1. Prefer explicit headers (legacy callers).
        let pageId = request.headers.get('x-fb-page-id');
        let accessToken = request.headers.get('x-fb-access-token');

        // 2. Fall back to the authenticated user's shop record so the setup
        // wizard does not need to pass credentials around in client state.
        if (!pageId || !accessToken) {
            const shop = await getAuthUserShop();
            if (shop?.id) {
                const { data } = await supabaseAdmin()
                    .from('shops')
                    .select('facebook_page_id, facebook_page_access_token')
                    .eq('id', shop.id)
                    .single();
                pageId = pageId || data?.facebook_page_id || null;
                accessToken = accessToken || data?.facebook_page_access_token || null;
            }
        }

        if (!pageId || !accessToken) {
            return NextResponse.json(
                { error: 'Missing pageId or accessToken — connect a Facebook Page first' },
                { status: 400 }
            );
        }

        // First, get the catalog ID for this page
        const catalogRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/commerce_merchant_settings?fields=commerce_enabled,has_catalog&access_token=${accessToken}`
        );
        const catalogData = await catalogRes.json();

        if (catalogData.error) {
            return NextResponse.json(
                { error: catalogData.error.message, code: 'FB_API_ERROR' },
                { status: 400 }
            );
        }

        if (!catalogData.commerce_enabled || !catalogData.has_catalog) {
            return NextResponse.json({
                products: [],
                message: 'Facebook Shop not enabled for this page',
                commerceEnabled: false
            });
        }

        // Get products from the page's catalog
        const productsRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/products?fields=id,name,description,price,currency,image_url,availability,url&limit=100&access_token=${accessToken}`
        );
        const productsData = await productsRes.json();

        if (productsData.error) {
            return NextResponse.json(
                { error: productsData.error.message, code: 'FB_PRODUCTS_ERROR' },
                { status: 400 }
            );
        }

        // Transform to our product format
        const products = (productsData.data || []).map((p: FBProduct) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: parseFloat((p.price || '0').replace(/[^0-9.]/g, '')) || 0,
            currency: p.currency || 'MNT',
            image_url: p.image_url,
            stock: p.availability === 'in stock' ? 999 : 0,
            fb_product_id: p.id,
            source: 'facebook'
        }));

        return NextResponse.json({
            products,
            total: products.length,
            commerceEnabled: true
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch Facebook products';
        logger.error('FB Shop API Error:', { error: error });
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
