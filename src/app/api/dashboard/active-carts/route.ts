
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUserShop } from '@/lib/auth/auth';
import { logger } from '@/lib/utils/logger';
import { pickOne, type SupabaseRelation } from '@/types/supabase-helpers';

interface CartCustomer {
    id: string;
    name: string | null;
    facebook_id?: string | null;
    is_vip?: boolean | null;
    phone?: string | null;
}

interface CartItemProduct {
    name: string;
    image_url?: string | null;
}

interface CartItem {
    id: string;
    quantity: number;
    unit_price: number;
    products?: SupabaseRelation<CartItemProduct>;
}

interface CartRow {
    id: string;
    updated_at: string;
    created_at: string;
    customers?: SupabaseRelation<CartCustomer>;
    cart_items?: CartItem[];
}

export async function GET() {
    try {
        const shop = await getAuthUserShop();

        if (!shop) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const supabase = supabaseAdmin();

        // Fetch carts with customer details and items
        const { data: carts, error } = await supabase
            .from('carts')
            .select(`
                id,
                updated_at,
                created_at,
                customers (
                    id,
                    name,
                    facebook_id,
                    is_vip,
                    phone
                ),
                cart_items (
                    id,
                    quantity,
                    unit_price,
                    products (
                        name,
                        image_url
                    )
                )
            `)
            .eq('shop_id', shop.id)
            .order('updated_at', { ascending: false });

        if (error) {
            logger.error('Error fetching active carts:', { error: error });
            return new NextResponse('Internal Server Error', { status: 500 });
        }

        // Transform data for frontend
        const formattedCarts = ((carts as unknown as CartRow[]) || []).map((cart) => {
            const items = cart.cart_items ?? [];
            const customer = pickOne(cart.customers);
            const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
            const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

            return {
                id: customer?.id ?? cart.id,
                cartId: cart.id,
                customer: {
                    id: customer?.id,
                    name: customer?.name || 'Guest',
                    facebookId: customer?.facebook_id,
                    isVip: customer?.is_vip,
                },
                lastActive: cart.updated_at,
                itemCount,
                totalAmount,
                items: items.map((item) => {
                    const product = pickOne(item.products);
                    return {
                        id: item.id,
                        name: product?.name || 'Unknown Product',
                        price: item.unit_price,
                        quantity: item.quantity,
                        image: product?.image_url,
                    };
                }),
            };
        });

        return NextResponse.json({ carts: formattedCarts });

    } catch (error: unknown) {
        logger.error('API Error:', { error: error });
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
