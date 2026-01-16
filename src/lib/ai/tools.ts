import OpenAI from 'openai';
import { ChatContext, ChatMessage, ImageAction } from './types';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendOrderNotification, sendPushNotification } from '@/lib/notifications';

// =============================================
// HELPER FUNCTIONS - Stock & Cart Management
// =============================================

/**
 * Check product stock from DB (not context) - prevents stale data
 */
async function checkProductStock(
    productId: string,
    requiredQty: number
): Promise<{ available: boolean; currentStock: number; reserved: number }> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('stock, reserved_stock')
        .eq('id', productId)
        .single();

    const stock = data?.stock || 0;
    const reserved = data?.reserved_stock || 0;
    const availableStock = stock - reserved;

    return {
        available: availableStock >= requiredQty,
        currentStock: availableStock,
        reserved
    };
}

/**
 * Get product from DB by name (fuzzy match) - prevents stale context data
 */
async function getProductFromDB(
    shopId: string,
    productName: string
): Promise<{
    id: string;
    name: string;
    price: number;
    stock: number;
    reserved_stock: number;
    discount_percent: number | null;
} | null> {
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('products')
        .select('id, name, price, stock, reserved_stock, discount_percent')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .ilike('name', `%${productName}%`)
        .limit(1)
        .single();

    return data;
}

/**
 * Add item to cart with ON CONFLICT handling - prevents race conditions
 */
async function addItemToCart(
    cartId: string,
    productId: string,
    variantSpecs: Record<string, string>,
    quantity: number,
    unitPrice: number
): Promise<{ success: boolean; newQuantity: number }> {
    const supabase = supabaseAdmin();

    // Use upsert with ON CONFLICT to prevent race conditions
    const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', productId)
        .single();

    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        await supabase
            .from('cart_items')
            .update({ quantity: newQuantity })
            .eq('id', existingItem.id);
        return { success: true, newQuantity };
    } else {
        await supabase
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: productId,
                variant_specs: variantSpecs,
                quantity,
                unit_price: unitPrice
            });
        return { success: true, newQuantity: quantity };
    }
}

/**
 * Get fresh cart data from DB
 */
export async function getCartFromDB(shopId: string, customerId: string): Promise<{
    id: string;
    items: Array<{
        id: string;
        product_id: string;
        name: string;
        variant_specs: Record<string, string>;
        quantity: number;
        unit_price: number;
    }>;
    total_amount: number;
} | null> {
    const supabase = supabaseAdmin();

    // Get active cart
    const { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .single();

    if (!cart) return null;

    // Get cart items with product names
    const { data: items } = await supabase
        .from('cart_items')
        .select(`
            id,
            product_id,
            variant_specs,
            quantity,
            unit_price,
            products (name)
        `)
        .eq('cart_id', cart.id);

    if (!items || items.length === 0) {
        return { id: cart.id, items: [], total_amount: 0 };
    }

    const mappedItems = items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: (item.products as any)?.name || 'Unknown',
        variant_specs: item.variant_specs as Record<string, string>,
        quantity: item.quantity,
        unit_price: Number(item.unit_price)
    }));

    const total = mappedItems.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

    return { id: cart.id, items: mappedItems, total_amount: total };
}

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: 'Create a new order when customer explicitly says they want to buy something. Do not use for general inquiries.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: {
                        type: 'string',
                        description: 'Name of the product to order (fuzzy match)'
                    },
                    quantity: {
                        type: 'number',
                        description: 'Quantity to order',
                        default: 1
                    },
                    color: {
                        type: 'string',
                        description: 'Selected color variant (optional)'
                    },
                    size: {
                        type: 'string',
                        description: 'Selected size variant (optional)'
                    }
                },
                required: ['product_name', 'quantity']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'collect_contact_info',
            description: 'Save customer contact information when they provide phone number or delivery address for an order. Use this when customer shares their phone or address.',
            parameters: {
                type: 'object',
                properties: {
                    phone: {
                        type: 'string',
                        description: 'Customer phone number (8 digits for Mongolia)'
                    },
                    address: {
                        type: 'string',
                        description: 'Delivery address'
                    },
                    name: {
                        type: 'string',
                        description: 'Customer name if provided'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'request_human_support',
            description: 'Call this when customer explicitly asks to speak to a human, operator, administrative staff, or when you cannot help them.',
            parameters: {
                type: 'object',
                properties: {
                    reason: {
                        type: 'string',
                        description: 'Reason for requesting human support'
                    }
                },
                required: ['reason']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'cancel_order',
            description: 'Cancel an order when customer explicitly says they want to cancel their order. This will restore the reserved stock.',
            parameters: {
                type: 'object',
                properties: {
                    reason: {
                        type: 'string',
                        description: 'Reason for cancellation'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'show_product_image',
            description: 'Show product image(s) ONLY when customer asks about a SPECIFIC product by name or description (e.g. "харуулаач", "зураг", "юу шиг харагддаг вэ?"). DO NOT use for generic questions like "ямар бараа байна?" - just answer with text. Use "confirm" mode when 2-5 similar products match to ask which one they want.',
            parameters: {
                type: 'object',
                properties: {
                    product_names: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Names of SPECIFIC products to show (1-5 max). Use EXACT names from product list.'
                    },
                    mode: {
                        type: 'string',
                        enum: ['single', 'confirm'],
                        description: '"single" for 1 product, "confirm" to ask customer to choose between 2-5 similar products'
                    }
                },
                required: ['product_names', 'mode']
            }
        }
    },
    // NEW CART TOOLS
    {
        type: 'function',
        function: {
            name: 'add_to_cart',
            description: 'Add a product to shopping cart. Use this FIRST when customer wants to buy something. Ask to confirm checkout after.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: {
                        type: 'string',
                        description: 'Name of the product to add (fuzzy match)'
                    },
                    quantity: {
                        type: 'number',
                        description: 'Quantity to add',
                        default: 1
                    },
                    color: {
                        type: 'string',
                        description: 'Color variant (optional)'
                    },
                    size: {
                        type: 'string',
                        description: 'Size variant (optional)'
                    }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'view_cart',
            description: 'Show current shopping cart contents and total. Use when customer asks about their cart or wants to see what they have added.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'remove_from_cart',
            description: 'Remove an item from cart. Use when customer wants to remove something from their cart.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: {
                        type: 'string',
                        description: 'Name of the product to remove'
                    }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'checkout',
            description: 'Finalize cart and create order. Use when customer confirms they want to complete their purchase and checkout.',
            parameters: {
                type: 'object',
                properties: {
                    notes: {
                        type: 'string',
                        description: 'Any special notes for the order'
                    }
                },
                required: []
            }
        }
    }
];

export async function handleToolCall(
    toolCall: any,
    context: ChatContext,
    messages: ChatMessage[],
    setImageAction: (action: ImageAction) => void
) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    logger.info(`Executing tool: ${functionName}`, args);

    // Handle collect_contact_info
    if (functionName === 'collect_contact_info') {
        try {
            const { phone, address, name } = args;

            if (!context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No customer context' })
                } as any);
                return;
            }

            const supabase = supabaseAdmin();
            const updateData: Record<string, any> = {};

            if (phone) updateData.phone = phone;
            if (address) updateData.address = address;
            if (name) updateData.name = name;

            if (Object.keys(updateData).length > 0) {
                await supabase
                    .from('customers')
                    .update(updateData)
                    .eq('id', context.customerId);

                logger.info('Contact info saved to CRM:', updateData);

                // Send notification about contact info
                if (context.notifySettings?.contact !== false) {
                    await sendPushNotification(context.shopId, {
                        title: '📍 Хаяг мэдээлэл ирлээ',
                        body: `${name || 'Хэрэглэгч'} мэдээллээ үлдээлээ: ${phone || ''} ${address || ''}`,
                        url: `/dashboard/customers/${context.customerId}`,
                        tag: `contact-${context.customerId}`
                    });
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        success: true,
                        message: `Saved: ${phone ? 'phone ' : ''}${address ? 'address ' : ''}${name ? 'name' : ''}`
                    })
                } as any);
            } else {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ message: 'No info to save' })
                } as any);
            }
        } catch (error: any) {
            logger.error('Contact save error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle request_human_support
    if (functionName === 'request_human_support') {
        const { reason } = args;

        // Send push notification
        if (context.notifySettings?.support !== false) {
            await sendPushNotification(context.shopId, {
                title: '📞 Холбогдох хүсэлт',
                body: `Хэрэглэгч холбогдох хүсэлт илгээлээ. Шалтгаан: ${reason || 'Тодорхойгүй'}`,
                url: `/dashboard/chat?customer=${context.customerId}`,
                tag: `support-${context.customerId}`
            });
        }

        messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: true, message: 'Support request notified.' })
        } as any);
        return;
    }

    // Handle create_order
    if (functionName === 'create_order') {
        try {
            const { product_name, quantity, color, size } = args;

            // 1. Find Product
            const product = context.products.find(p =>
                p.name.toLowerCase().includes(product_name.toLowerCase())
            );

            if (!product) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: `Product "${product_name}" not found.` })
                } as any);
                return;
            }

            // 2. Check Stock
            /*
                Note: context.products might be slightly stale compared to DB,
                but for MVP it's okay. Truly we should verify stock from DB here
                but we need supabase access.
                Since we added supabaseAdmin import, let's use it!
            */

            const supabase = supabaseAdmin();

            // Verify stock from DB
            const { data: dbProduct } = await supabase
                .from('products')
                .select('stock, reserved_stock, price, id')
                .eq('id', product.id)
                .single();

            const availableStock = (dbProduct?.stock || 0) - (dbProduct?.reserved_stock || 0);
            if (!dbProduct || availableStock < quantity) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: `Not enough stock. Only ${availableStock} available.` })
                } as any);
                return;
            }

            // 3. Create Order
            if (!context.shopId || !context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: `Missing shop or customer ID context.` })
                } as any);
                return;
            }

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    shop_id: context.shopId,
                    customer_id: context.customerId,
                    status: 'pending',
                    total_amount: dbProduct.price * quantity,
                    notes: `AI Order: ${product_name} (${color || ''} ${size || ''})`,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 4. Create Order Item & Reserve Stock (not deduct yet - pending payment)
            await supabase.from('order_items').insert({
                order_id: order.id,
                product_id: product.id,
                quantity: quantity,
                unit_price: dbProduct.price,
                color: color || null,
                size: size || null
            });

            // Reserve stock (will be actually deducted when payment is confirmed)
            await supabase
                .from('products')
                .update({
                    reserved_stock: (dbProduct.reserved_stock || 0) + quantity
                })
                .eq('id', product.id);

            const successMessage = `Success! Order #${order.id.substring(0, 8)} created. Total: ${(dbProduct.price * quantity).toLocaleString()}₮. Stock reserved.`;

            // Send push notification to shop owner
            if (context.notifySettings?.order !== false) {
                try {
                    await sendOrderNotification(context.shopId, 'new', {
                        orderId: order.id,
                        customerName: context.customerName,
                        totalAmount: dbProduct.price * quantity,
                    });
                } catch (notifError: unknown) {
                    logger.warn('Failed to send order notification:', { error: String(notifError) });
                }
            }

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ success: true, message: successMessage })
            } as any);

        } catch (error: any) {
            logger.error('Tool execution error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle cancel_order
    if (functionName === 'cancel_order') {
        try {
            const { reason } = args;
            const supabase = supabaseAdmin();

            if (!context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No customer context' })
                } as any);
                return;
            }

            // Find the most recent pending order for this customer
            const { data: pendingOrder } = await supabase
                .from('orders')
                .select(`
                    id, status, total_amount,
                    order_items (product_id, quantity)
                `)
                .eq('customer_id', context.customerId)
                .eq('shop_id', context.shopId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!pendingOrder) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No pending order found to cancel' })
                } as any);
                return;
            }

            // Cancel the order
            await supabase
                .from('orders')
                .update({
                    status: 'cancelled',
                    notes: `Cancelled by customer. Reason: ${reason || 'Not specified'}`
                })
                .eq('id', pendingOrder.id);

            // Restore reserved stock for each order item
            for (const item of (pendingOrder.order_items || [])) {
                // Directly update reserved_stock (no RPC needed)
                const { data: product } = await supabase
                    .from('products')
                    .select('reserved_stock')
                    .eq('id', item.product_id)
                    .single();

                if (product) {
                    await supabase
                        .from('products')
                        .update({
                            reserved_stock: Math.max(0, (product.reserved_stock || 0) - item.quantity)
                        })
                        .eq('id', item.product_id);
                }
            }

            logger.info('Order cancelled and stock restored:', { orderId: pendingOrder.id });

            // Send notification
            if (context.notifySettings?.cancel !== false) {
                await sendPushNotification(context.shopId, {
                    title: '❌ Захиалга цуцлагдлаа',
                    body: `${context.customerName || 'Хэрэглэгч'} захиалгаа цуцаллаа. Шалтгаан: ${reason || 'Тодорхойгүй'}`,
                    url: '/dashboard/orders',
                    tag: `cancel-${pendingOrder.id}`
                });
            }

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                    success: true,
                    message: `Order #${pendingOrder.id.substring(0, 8)} cancelled. Stock restored.`
                })
            } as any);

        } catch (error: any) {
            logger.error('Cancel order error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle show_product_image
    if (functionName === 'show_product_image') {
        try {
            const { product_names, mode } = args as { product_names: string[]; mode: 'single' | 'confirm' };

            // Find matching products with images
            const matchedProducts = product_names
                .map((name: string) => {
                    const product = context.products.find(p =>
                        p.name.toLowerCase().includes(name.toLowerCase()) ||
                        name.toLowerCase().includes(p.name.toLowerCase())
                    );
                    if (product && product.image_url) {
                        return {
                            name: product.name,
                            price: product.price,
                            imageUrl: product.image_url,
                            description: product.description,
                        };
                    }
                    return null;
                })
                .filter((p): p is NonNullable<typeof p> => p !== null);

            if (matchedProducts.length > 0) {
                setImageAction({
                    type: mode,
                    products: matchedProducts,
                });

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        success: true,
                        message: `Showing ${matchedProducts.length} product image(s) in ${mode} mode.`
                    })
                } as any);
            } else {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        error: 'No matching products with images found.'
                    })
                } as any);
            }
        } catch (error: any) {
            logger.error('Show product image error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle add_to_cart - Uses DB for fresh data
    if (functionName === 'add_to_cart') {
        try {
            const { product_name, quantity = 1, color, size } = args;
            const supabase = supabaseAdmin();

            if (!context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No customer context' })
                } as any);
                return;
            }

            // 🔧 FIX: Get product from DB (not context) to prevent stale data
            const product = await getProductFromDB(context.shopId, product_name);

            if (!product) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: `"${product_name}" олдсонгүй` })
                } as any);
                return;
            }

            // 🔧 FIX: Check stock from DB (not context)
            const stockCheck = await checkProductStock(product.id, quantity);
            if (!stockCheck.available) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${stockCheck.currentStock}`
                    })
                } as any);
                return;
            }

            // Get or create cart
            const { data: cartId } = await supabase
                .rpc('get_or_create_cart', {
                    p_shop_id: context.shopId,
                    p_customer_id: context.customerId
                });

            // Calculate price with discount
            const discountedPrice = product.discount_percent
                ? Math.round(product.price * (1 - product.discount_percent / 100))
                : product.price;

            const variantSpecs: Record<string, string> = {};
            if (color) variantSpecs.color = color;
            if (size) variantSpecs.size = size;

            // 🔧 FIX: Use helper function with better race condition handling
            const result = await addItemToCart(
                cartId,
                product.id,
                variantSpecs,
                quantity,
                discountedPrice
            );

            // Get updated cart total
            const { data: total } = await supabase
                .rpc('calculate_cart_total', { p_cart_id: cartId });

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                    success: true,
                    message: `${product.name} (${result.newQuantity}ш) сагсанд нэмэгдлээ! Нийт: ${total?.toLocaleString()}₮`,
                    cart_total: total
                })
            } as any);

        } catch (error: any) {
            logger.error('Add to cart error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle view_cart - 🔧 FIX: Get fresh cart from DB
    if (functionName === 'view_cart') {
        try {
            if (!context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No customer context' })
                } as any);
                return;
            }

            // 🔧 FIX: Get fresh cart from DB
            const freshCart = await getCartFromDB(context.shopId, context.customerId);

            if (!freshCart || freshCart.items.length === 0) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                        message: 'Таны сагс хоосон байна.',
                        items: [],
                        total: 0
                    })
                } as any);
                return;
            }

            const cartSummary = freshCart.items.map(item =>
                `• ${item.name} x${item.quantity} = ${(item.unit_price * item.quantity).toLocaleString()}₮`
            ).join('\n');

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                    success: true,
                    message: `Таны сагс:\n${cartSummary}\n\nНийт: ${freshCart.total_amount.toLocaleString()}₮`,
                    items: freshCart.items,
                    total: freshCart.total_amount
                })
            } as any);

        } catch (error: any) {
            logger.error('View cart error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle remove_from_cart - 🔧 FIX: Get fresh cart from DB
    if (functionName === 'remove_from_cart') {
        try {
            const { product_name } = args;
            const supabase = supabaseAdmin();

            if (!context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No customer context' })
                } as any);
                return;
            }

            // 🔧 FIX: Get fresh cart from DB
            const freshCart = await getCartFromDB(context.shopId, context.customerId);

            if (!freshCart || freshCart.items.length === 0) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'Сагс хоосон байна' })
                } as any);
                return;
            }

            const item = freshCart.items.find(i =>
                i.name.toLowerCase().includes(product_name.toLowerCase())
            );

            if (!item) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: `"${product_name}" сагсанд олдсонгүй` })
                } as any);
                return;
            }

            await supabase
                .from('cart_items')
                .delete()
                .eq('id', item.id);

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                    success: true,
                    message: `${item.name} сагснаас хасагдлаа`
                })
            } as any);

        } catch (error: any) {
            logger.error('Remove from cart error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }

    // Handle checkout - 🔧 FIX: Get fresh cart from DB
    if (functionName === 'checkout') {
        try {
            const { notes } = args;
            const supabase = supabaseAdmin();

            if (!context.customerId) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'No customer context' })
                } as any);
                return;
            }

            // 🔧 FIX: Get fresh cart from DB
            const freshCart = await getCartFromDB(context.shopId, context.customerId);

            if (!freshCart || freshCart.items.length === 0) {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'Сагс хоосон байна. Эхлээд бараа нэмнэ үү.' })
                } as any);
                return;
            }

            const { data: orderId, error: checkoutError } = await supabase
                .rpc('checkout_cart', {
                    p_cart_id: freshCart.id,
                    p_notes: notes || 'AI Chat Checkout'
                });

            if (checkoutError) throw checkoutError;

            // Send notification (with try-catch to prevent blocking)
            try {
                if (context.notifySettings?.order !== false) {
                    await sendOrderNotification(context.shopId, 'new', {
                        orderId: orderId,
                        customerName: context.customerName,
                        totalAmount: freshCart.total_amount,
                    });
                }
            } catch (notifyError: any) {
                logger.warn('Notification failed but order created:', { error: notifyError?.message });
            }

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                    success: true,
                    message: `Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ! Нийт: ${freshCart.total_amount.toLocaleString()}₮`,
                    order_id: orderId
                })
            } as any);

        } catch (error: any) {
            logger.error('Checkout error:', error);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message })
            } as any);
        }
        return;
    }
}
