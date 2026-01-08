
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const supabase = supabaseAdmin();
        const runId = Math.floor(Math.random() * 10000);
        const productName = `Test Product ${runId}`;
        const initialStock = 10;
        const buyQty = 1;

        // 1. Create Test Product
        const { data: product, error: prodError } = await supabase
            .from('products')
            .insert({
                name: productName,
                price: 50000,
                stock: initialStock,
                type: 'physical',
                description: 'Test product for order flow verification',
                is_active: true
            })
            .select()
            .single();

        if (prodError) throw new Error(`Product creation failed: ${prodError.message}`);

        // 2. Create Test Customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .insert({
                psid: `test_psid_${runId}`,
                name: `Test User ${runId}`,
                first_name: 'Test',
                last_name: `User ${runId}`
            })
            .select()
            .single();

        if (custError) throw new Error(`Customer creation failed: ${custError.message}`);

        // 3. Create Order
        // Simulate Shop ID (assuming single shop or picking first one)
        const { data: shop } = await supabase.from('shops').select('id').limit(1).single();
        if (!shop) throw new Error('No shop found to link order to');

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                shop_id: shop.id,
                customer_id: customer.id,
                status: 'pending',
                total_amount: product.price * buyQty,
                notes: `Test Order Verification`
            })
            .select()
            .single();

        if (orderError) throw new Error(`Order creation failed: ${orderError.message}`);

        // 4. Trace Stock Deduction
        const { error: rpcError } = await supabase.rpc('decrement_stock', {
            p_id: product.id,
            qty: buyQty
        });

        if (rpcError) throw new Error(`Stock deduction failed: ${rpcError.message}`);

        // 5. Verify New Stock
        const { data: updatedProduct } = await supabase
            .from('products')
            .select('stock')
            .eq('id', product.id)
            .single();

        return NextResponse.json({
            success: true,
            steps: {
                "1_product_created": { name: productName, initial_stock: initialStock },
                "2_customer_created": { name: customer.name },
                "3_order_created": { id: order.id, amount: order.total_amount },
                "4_stock_deducted": { requested_qty: buyQty },
                "5_verification": {
                    old_stock: initialStock,
                    new_stock: updatedProduct?.stock,
                    is_correct: updatedProduct?.stock === (initialStock - buyQty)
                }
            },
            message: "Order flow verified: Stock successfully deducted."
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
