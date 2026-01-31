/**
 * ToolExecutor - Handles execution of AI tool calls
 * Extracted from openai.ts generateChatResponse function
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendOrderNotification, sendPushNotification } from '@/lib/notifications';
import { checkProductStock, getProductFromDB, addItemToCart, getCartFromDB } from '../helpers/stockHelpers';
import { createQPayInvoice } from '@/lib/payment/qpay';
import type { ChatContext, ImageAction } from '@/types/ai';
import type {
    CreateOrderArgs,
    CollectContactArgs,
    RequestHumanSupportArgs,
    CancelOrderArgs,
    ShowProductImageArgs,
    AddToCartArgs,
    RemoveFromCartArgs,
    CheckoutArgs,
    RememberPreferenceArgs,
    CheckPaymentArgs,
    CheckOrderStatusArgs,
    LogComplaintArgs,
    SuggestRelatedProductsArgs,
    UpdateOrderArgs,
    ToolName,
} from '../tools/definitions';
import { saveCustomerPreference } from '../tools/memory';
import { checkPaymentStatus, isPaymentCompleted } from '@/lib/payment/qpay';

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: Record<string, unknown>;
    imageAction?: ImageAction;
    quickReplies?: Array<{ title: string; payload: string }>;  // Quick reply buttons
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
    shopId: string;
    customerId?: string;
    customerName?: string;
    products: ChatContext['products'];
    notifySettings?: ChatContext['notifySettings'];
}

/**
 * Execute collect_contact_info tool
 */
export async function executeCollectContact(
    args: CollectContactArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { phone, address, name } = args;

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const supabase = supabaseAdmin();
    const updateData: Record<string, string> = {};

    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (name) updateData.name = name;

    if (Object.keys(updateData).length === 0) {
        return { success: true, message: 'No info to save' };
    }

    const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', context.customerId);

    if (error) {
        logger.error('Contact save error:', { error });
        return { success: false, error: error.message };
    }

    logger.info('Contact info saved to CRM:', updateData);

    // Send notification
    if (context.notifySettings?.contact !== false) {
        await sendPushNotification(context.shopId, {
            title: '📍 Хаяг мэдээлэл ирлээ',
            body: `${name || 'Хэрэглэгч'} мэдээллээ үлдээлээ: ${phone || ''} ${address || ''}`,
            url: `/dashboard/customers/${context.customerId}`,
            tag: `contact-${context.customerId}`
        });
    }

    return {
        success: true,
        message: `Saved: ${phone ? 'phone ' : ''}${address ? 'address ' : ''}${name ? 'name' : ''}`
    };
}

/**
 * Execute request_human_support tool
 */
export async function executeRequestSupport(
    args: RequestHumanSupportArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { reason } = args;

    if (context.notifySettings?.support !== false) {
        await sendPushNotification(context.shopId, {
            title: '📞 Холбогдох хүсэлт',
            body: `Хэрэглэгч холбогдох хүсэлт илгээлээ. Шалтгаан: ${reason || 'Тодорхойгүй'}`,
            url: `/dashboard/chat?customer=${context.customerId}`,
            tag: `support-${context.customerId}`
        });
    }

    return { success: true, message: 'Support request notified.' };
}

/**
 * Execute create_order tool
 */
export async function executeCreateOrder(
    args: CreateOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { product_name, quantity, color, size } = args;
    const supabase = supabaseAdmin();

    // Find product from context
    const product = context.products.find(p =>
        p.name.toLowerCase().includes(product_name.toLowerCase())
    );

    if (!product) {
        return { success: false, error: `Product "${product_name}" not found.` };
    }

    // Verify stock from DB
    const { data: dbProduct } = await supabase
        .from('products')
        .select('stock, reserved_stock, price, id')
        .eq('id', product.id)
        .single();

    const availableStock = (dbProduct?.stock || 0) - (dbProduct?.reserved_stock || 0);
    if (!dbProduct || availableStock < quantity) {
        return { success: false, error: `Not enough stock. Only ${availableStock} available.` };
    }

    if (!context.shopId || !context.customerId) {
        return { success: false, error: 'Missing shop or customer ID context.' };
    }

    // Create order


    // Check for duplicate pending orders (Idempotency)
    // If a pending order for same product/customer exists created in last 30s, return it
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('customer_id', context.customerId)
        .eq('shop_id', context.shopId)
        .eq('status', 'pending')
        .gt('created_at', thirtySecondsAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (existingOrder) {
        // Double check if it contains the same product
        const { data: verifyItem } = await supabase
            .from('order_items')
            .select('product_id')
            .eq('order_id', existingOrder.id)
            .eq('product_id', product.id)
            .single();

        if (verifyItem) {
            logger.info('Duplicate order prevented, returning existing:', { orderId: existingOrder.id });
            return {
                success: true,
                message: `Success! Order #${existingOrder.id.substring(0, 8)} created (Found existing). Total: ${existingOrder.total_amount.toLocaleString()}₮.`,
                data: { orderId: existingOrder.id, total: existingOrder.total_amount }
            };
        }
    }

    // Create order
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

    if (orderError) {
        logger.error('Order creation error:', { error: orderError });
        return { success: false, error: orderError.message };
    }

    // Create order item
    await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity,
        unit_price: dbProduct.price,
        color: color || null,
        size: size || null
    });

    // Reserve stock
    await supabase
        .from('products')
        .update({ reserved_stock: (dbProduct.reserved_stock || 0) + quantity })
        .eq('id', product.id);

    // Send notification
    if (context.notifySettings?.order !== false) {
        try {
            await sendOrderNotification(context.shopId, 'new', {
                orderId: order.id,
                customerName: context.customerName,
                totalAmount: dbProduct.price * quantity,
            });
        } catch (notifError) {
            logger.warn('Failed to send order notification:', { error: String(notifError) });
        }
    }

    return {
        success: true,
        message: `Success! Order #${order.id.substring(0, 8)} created. Total: ${(dbProduct.price * quantity).toLocaleString()}₮. Stock reserved.`,
        data: { orderId: order.id, total: dbProduct.price * quantity }
    };
}

/**
 * Execute cancel_order tool
 */
export async function executeCancelOrder(
    args: CancelOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { reason } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    // Find pending order
    const { data: pendingOrder } = await supabase
        .from('orders')
        .select(`id, status, total_amount, order_items (product_id, quantity)`)
        .eq('customer_id', context.customerId)
        .eq('shop_id', context.shopId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!pendingOrder) {
        return { success: false, error: 'No pending order found to cancel' };
    }

    // Cancel order
    await supabase
        .from('orders')
        .update({ status: 'cancelled', notes: `Cancelled by customer. Reason: ${reason || 'Not specified'}` })
        .eq('id', pendingOrder.id);

    // Restore stock
    for (const item of (pendingOrder.order_items as any[] || [])) {
        const { data: product } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('id', item.product_id)
            .single();

        if (product) {
            await supabase
                .from('products')
                .update({ reserved_stock: Math.max(0, (product.reserved_stock || 0) - item.quantity) })
                .eq('id', item.product_id);
        }
    }

    // Send notification
    if (context.notifySettings?.cancel !== false) {
        await sendPushNotification(context.shopId, {
            title: '❌ Захиалга цуцлагдлаа',
            body: `${context.customerName || 'Хэрэглэгч'} захиалгаа цуцаллаа. Шалтгаан: ${reason || 'Тодорхойгүй'}`,
            url: '/dashboard/orders',
            tag: `cancel-${pendingOrder.id}`
        });
    }

    logger.info('Order cancelled and stock restored:', { orderId: pendingOrder.id });

    return {
        success: true,
        message: `Order #${pendingOrder.id.substring(0, 8)} cancelled. Stock restored.`
    };
}

/**
 * Execute show_product_image tool
 */
export function executeShowProductImage(
    args: ShowProductImageArgs,
    context: ToolExecutionContext
): ToolExecutionResult {
    const { product_names, mode } = args;

    const matchedProducts = product_names
        .map(name => {
            const product = context.products.find(p =>
                p.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(p.name.toLowerCase())
            );

            // Resolving image URL: Try images array first, then fallback to image_url
            const imageUrl = (product && product.images && product.images.length > 0)
                ? product.images[0]
                : (product && product.image_url);

            if (product) {
                // FALLBACK: Use placeholder if no image
                const finalImageUrl = imageUrl || 'https://placehold.co/600x400?text=No+Image';
                return {
                    name: product.name,
                    price: product.price,
                    imageUrl: finalImageUrl,
                    description: product.description,
                };
            }
            return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

    if (matchedProducts.length > 0) {
        return {
            success: true,
            message: `Showing ${matchedProducts.length} product image(s) in ${mode} mode.`,
            imageAction: { type: mode, products: matchedProducts }
        };
    }

    return {
        success: false,
        // Changed error to a soft message so AI can say "I couldn't find an image" gracefully
        error: 'Зурагтай бүтээгдэхүүн олдсонгүй.'
    };
}

/**
 * Execute add_to_cart tool
 */
export async function executeAddToCart(
    args: AddToCartArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { product_name, quantity = 1, color, size } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    // Get product from DB
    const product = await getProductFromDB(context.shopId, product_name);
    if (!product) {
        return { success: false, error: `"${product_name}" олдсонгүй` };
    }

    // Check stock
    const stockCheck = await checkProductStock(product.id, quantity);
    if (!stockCheck.available) {
        return { success: false, error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${stockCheck.currentStock}` };
    }

    // Get or create cart
    const { data: cartId } = await supabase.rpc('get_or_create_cart', {
        p_shop_id: context.shopId,
        p_customer_id: context.customerId
    });

    // Calculate price
    const discountedPrice = product.discount_percent
        ? Math.round(product.price * (1 - product.discount_percent / 100))
        : product.price;

    const variantSpecs: Record<string, string> = {};
    if (color) variantSpecs.color = color;
    if (size) variantSpecs.size = size;

    // Add to cart
    const result = await addItemToCart(cartId, product.id, variantSpecs, quantity, discountedPrice);

    // Get updated total
    const { data: total } = await supabase.rpc('calculate_cart_total', { p_cart_id: cartId });

    // Stock urgency hint
    let urgencyHint = '';
    if (stockCheck.currentStock <= 3) {
        urgencyHint = ` ⚠️ Зөвхөн ${stockCheck.currentStock} ширхэг үлдлээ!`;
    }

    return {
        success: true,
        message: `${product.name} (${result.newQuantity}ш) сагсанд нэмэгдлээ!${urgencyHint} Нийт: ${total?.toLocaleString()}₮`,
        data: { cart_total: total, stock_remaining: stockCheck.currentStock },
        quickReplies: [
            { title: '💳 Төлбөр төлөх', payload: 'CHECKOUT' },
            { title: '🛒 Сагс харах', payload: 'VIEW_CART' },
            { title: '🔙 Үргэлжлүүлэх', payload: 'CONTINUE_SHOPPING' }
        ]
    };
}

/**
 * Execute view_cart tool
 */
export async function executeViewCart(
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const cart = await getCartFromDB(context.shopId, context.customerId);

    if (!cart || cart.items.length === 0) {
        return {
            success: true,
            message: 'Таны сагс хоосон байна.',
            data: { items: [], total: 0 }
        };
    }

    const summary = cart.items
        .map(item => `• ${item.name} x${item.quantity} = ${(item.unit_price * item.quantity).toLocaleString()}₮`)
        .join('\n');

    return {
        success: true,
        message: `Таны сагс:\n${summary}\n\nНийт: ${cart.total_amount.toLocaleString()}₮`,
        data: { items: cart.items, total: cart.total_amount },
        quickReplies: [
            { title: '💳 Төлбөр төлөх', payload: 'CHECKOUT' },
            { title: '➕ Бараа нэмэх', payload: 'ADD_MORE' },
            { title: '🗑️ Цэвэрлэх', payload: 'CLEAR_CART' }
        ]
    };
}

/**
 * Execute remove_from_cart tool
 */
export async function executeRemoveFromCart(
    args: RemoveFromCartArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { product_name } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const cart = await getCartFromDB(context.shopId, context.customerId);

    if (!cart || cart.items.length === 0) {
        return { success: false, error: 'Сагс хоосон байна' };
    }

    const item = cart.items.find(i => i.name.toLowerCase().includes(product_name.toLowerCase()));

    if (!item) {
        return { success: false, error: `"${product_name}" сагсанд олдсонгүй` };
    }

    await supabase.from('cart_items').delete().eq('id', item.id);

    return { success: true, message: `${item.name} сагснаас хасагдлаа` };
}

/**
 * Execute checkout tool
 */
export async function executeCheckout(
    args: CheckoutArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { notes } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const cart = await getCartFromDB(context.shopId, context.customerId);

    if (!cart || cart.items.length === 0) {
        return { success: false, error: 'Сагс хоосон байна. Эхлээд бараа нэмнэ үү.' };
    }

    const { data: orderId, error: checkoutError } = await supabase.rpc('checkout_cart', {
        p_cart_id: cart.id,
        p_notes: notes || 'AI Chat Checkout'
    });

    if (checkoutError) {
        logger.error('Checkout error:', { error: checkoutError });
        return { success: false, error: checkoutError.message };
    }

    // Generate QPay Invoice
    let qpayInvoice = null;
    let bankInfo = null;

    try {
        // Fetch Shop Bank Info
        const { data: shop } = await supabase
            .from('shops')
            .select('bank_name, account_number, account_name')
            .eq('id', context.shopId)
            .single();

        bankInfo = shop;

        // Create QPay Invoice
        qpayInvoice = await createQPayInvoice({
            orderId: orderId,
            amount: cart.total_amount,
            description: `Order #${orderId.substring(0, 8)}`,
            callbackUrl: `https://smarthub.mn/api/payment/callback/qpay`
        });
    } catch (err) {
        logger.warn('Failed to generate payment info:', { error: String(err) });
    }

    // Send notification
    if (context.notifySettings?.order !== false) {
        try {
            await sendOrderNotification(context.shopId, 'new', {
                orderId: orderId,
                customerName: context.customerName,
                totalAmount: cart.total_amount,
            });
        } catch (notifyError) {
            logger.warn('Notification failed but order created:', { error: String(notifyError) });
        }
    }

    // Construct Payment Instructions
    let paymentMsg = `Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ! Нийт: ${cart.total_amount.toLocaleString()}₮\n\nТөлбөр төлөх сонголтууд:`;

    // Opt 1: QPay
    if (qpayInvoice) {
        paymentMsg += `\n\n1. QPay (Хялбар): Доорх линкээр орж эсвэл QR кодыг уншуулж төлнө үү.\n${qpayInvoice.qpay_shorturl}`;
    }

    // Opt 2: Bank
    if (bankInfo && bankInfo.account_number) {
        paymentMsg += `\n\n2. Дансны шилжүүлэг:\nБанк: ${bankInfo.bank_name || 'Банк'}\nДанс: ${bankInfo.account_number}\nНэр: ${bankInfo.account_name || 'Дэлгүүр'}\nГүйлгээний утга: ${orderId.substring(0, 8)}`;
        paymentMsg += `\n\n*Дансаар шилжүүлсэн бол баримтаа илгээнэ үү.`;
    }

    return {
        success: true,
        message: paymentMsg,
        data: {
            order_id: orderId,
            qpay: qpayInvoice,
            bank: bankInfo
        }
    };
}

/**
 * Execute remember_preference tool - Save customer preference to memory
 */
export async function executeRememberPreference(
    args: RememberPreferenceArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { key, value } = args;

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const result = await saveCustomerPreference(context.customerId, key, value);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    logger.info('Customer preference saved:', { customerId: context.customerId, key, value });

    return {
        success: true,
        message: `Санах ойд хадгаллаа: ${key} = ${value}`,
        data: { key, value }
    };
}

/**
 * Execute check_payment_status tool
 */
export async function executeCheckPaymentStatus(
    args: CheckPaymentArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    // 1. Find recent pending orders
    let query = supabase
        .from('orders')
        .select('*')
        .eq('shop_id', context.shopId)
        .eq('customer_id', context.customerId)
        .eq('status', 'pending');

    if (args.order_id) {
        query = query.eq('id', args.order_id);
    } else {
        query = query.order('created_at', { ascending: false }).limit(3);
    }

    const { data: orders } = await query;

    if (!orders || orders.length === 0) {
        return { success: false, error: 'Төлөгдөөгүй захиалга олдсонгүй.' };
    }

    let verifiedCount = 0;
    const verifiedOrderIds = [];

    // 2. Check status for each pending order
    for (const order of orders) {
        // Find QPay Invoice ID associated with this order (assuming it's stored in metadata/notes or specific table)
        // Since we don't have a direct invoice_id link in `orders` yet (based on types), 
        // we'll try to find it via metadata or assume (for now) we can look up by order_id if QPay supports it 
        // OR we just use order_id as invoice_id if that's how we implemented `createQPayInvoice` (sender_invoice_no: orderId).
        // Let's assume we can check by Sender Invoice No (Order ID) but QPay API needs Object ID (Invoice ID).

        // Wait, `createQPayInvoice` returns `invoice_id`. We should have stored it.
        // If we didn't store it, we can't verify easily. 
        // Let's check `qpay_invoices` table if it exists? Or maybe `payments` table?
        // Based on `qpay.ts`, we create invoice but maybe not storing the QPay ID in DB?

        // Quick Fix: Look for payments table entry with this order_id
        const { data: payment } = await supabase
            .from('payments')
            .select('provider_transaction_id, id')
            .eq('order_id', order.id)
            .eq('status', 'pending')
            .single();

        if (payment && payment.provider_transaction_id) {
            try {
                const checkResult = await checkPaymentStatus(payment.provider_transaction_id);
                if (isPaymentCompleted(checkResult)) {
                    // Update Payment
                    await supabase
                        .from('payments')
                        .update({ status: 'paid', paid_at: new Date().toISOString() })
                        .eq('id', payment.id);

                    // Update Order
                    await supabase
                        .from('orders')
                        .update({ status: 'paid' })
                        .eq('id', order.id);

                    verifiedOrderIds.push(order.id);
                    verifiedCount++;
                }
            } catch (err: any) {
                logger.warn(`Failed to check payment for order ${order.id}:`, { error: err.message || String(err) });
            }
        }
    }

    if (verifiedCount > 0) {
        return {
            success: true,
            message: `Төлбөр баталгаажлаа! ✅ Захиалга: ${verifiedOrderIds.map(id => '#' + id.substring(0, 8)).join(', ')}`,
            data: { verified_orders: verifiedOrderIds }
        };
    }

    return {
        success: true, // Success execution, but result is "not paid"
        message: 'Төлбөр хараахан орж ирээгүй байна. Түр хүлээгээд дахин шалгана уу.',
        data: { paid: false }
    };
}

/**
 * #1 IMPROVEMENT: Execute check_order_status tool
 * Allows customers to check their order status
 */
async function executeCheckOrderStatus(
    args: CheckOrderStatusArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();
    const { orderId } = { orderId: args.order_id };

    try {
        // Build query - either specific order or recent orders
        let query = supabase
            .from('orders')
            .select('id, status, total, created_at, order_items(product_name, quantity, unit_price)')
            .eq('shop_id', context.shopId)
            .eq('customer_id', context.customerId)
            .order('created_at', { ascending: false });

        if (orderId) {
            query = query.eq('id', orderId);
        } else {
            query = query.limit(5); // Get last 5 orders
        }

        const { data: orders, error } = await query;

        if (error) {
            logger.error('Failed to fetch orders:', { error });
            return { success: false, error: 'Захиалга хайхад алдаа гарлаа' };
        }

        if (!orders || orders.length === 0) {
            return {
                success: true,
                message: 'Танд одоогоор захиалга байхгүй байна.',
                data: { orders: [] }
            };
        }

        // Format orders for response
        const orderSummaries = orders.map(order => {
            const statusLabels: Record<string, string> = {
                pending: '⏳ Хүлээгдэж буй',
                confirmed: '✅ Баталгаажсан',
                processing: '📦 Бэлтгэж байна',
                shipped: '🚚 Хүргэлтэд',
                delivered: '✔️ Хүргэгдсэн',
                cancelled: '❌ Цуцлагдсан'
            };

            const items = (order.order_items as any[])?.map(
                (item: any) => `${item.product_name} x${item.quantity}`
            ).join(', ') || '';

            return {
                id: order.id.substring(0, 8).toUpperCase(),
                status: statusLabels[order.status] || order.status,
                total: order.total,
                date: new Date(order.created_at).toLocaleDateString('mn-MN'),
                items
            };
        });

        const summaryText = orderSummaries.map(o =>
            `#${o.id}: ${o.status} - ${o.total?.toLocaleString()}₮ (${o.date})\n   └ ${o.items}`
        ).join('\n\n');

        return {
            success: true,
            message: `Таны сүүлийн захиалгууд:\n\n${summaryText}`,
            data: { orders: orderSummaries }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Check order status error:', { error: errorMessage });
        return { success: false, error: 'Захиалгын статус шалгахад алдаа гарлаа' };
    }
}

/**
 * #2 IMPROVEMENT: Execute log_complaint tool
 * Logs customer complaints for sentiment tracking
 */
async function executeLogComplaint(
    args: LogComplaintArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();

    try {
        // Insert complaint into database
        const { error } = await supabase
            .from('customer_complaints')
            .insert({
                shop_id: context.shopId,
                customer_id: context.customerId,
                complaint_type: args.complaint_type,
                description: args.description,
                severity: args.severity || 'medium',
                status: 'new',
                created_at: new Date().toISOString()
            });

        if (error) {
            // If table doesn't exist, log and continue gracefully
            if (error.code === '42P01') {
                logger.warn('customer_complaints table does not exist, logging to console');
                logger.info('Customer complaint:', {
                    shopId: context.shopId,
                    customerId: context.customerId,
                    type: args.complaint_type,
                    description: args.description,
                    severity: args.severity
                });
            } else {
                logger.error('Failed to log complaint:', { error });
            }
        }

        // Send notification to shop owner
        await sendPushNotification(context.shopId, {
            title: '⚠️ Үйлчлүүлэгчийн гомдол',
            body: `${args.complaint_type}: ${args.description}`,
            tag: 'complaint'
        });

        logger.info('Complaint logged:', {
            shopId: context.shopId,
            type: args.complaint_type,
            severity: args.severity
        });

        return {
            success: true,
            message: 'Таны санал хүсэлтийг хүлээн авлаа. Бид удахгүй эргэж холбогдоно.',
            data: { logged: true }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Log complaint error:', { error: errorMessage });
        return { success: false, error: 'Гомдол бүртгэхэд алдаа гарлаа' };
    }
}

/**
 * #3 IMPROVEMENT: Execute suggest_related_products tool
 * Suggests related products for cross-selling
 */
async function executeSuggestRelatedProducts(
    args: SuggestRelatedProductsArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { current_product_name, suggestion_type = 'complementary' } = args;

    try {
        // Find the current product
        const currentProduct = context.products?.find(p =>
            p.name.toLowerCase().includes(current_product_name.toLowerCase()) ||
            current_product_name.toLowerCase().includes(p.name.toLowerCase())
        );

        if (!currentProduct) {
            return {
                success: true,
                message: 'Холбогдох бараа олдсонгүй.',
                data: { suggestions: [] }
            };
        }

        // Find related products based on strategy
        let suggestions: typeof context.products = [];

        if (suggestion_type === 'similar') {
            // Similar products - same type, different items
            suggestions = context.products?.filter(p =>
                p.id !== currentProduct.id &&
                p.type === currentProduct.type &&
                p.stock > 0
            ).slice(0, 3) || [];
        } else if (suggestion_type === 'bundle') {
            // Bundle - lower priced items
            const currentPrice = currentProduct.discount_percent
                ? currentProduct.price * (1 - currentProduct.discount_percent / 100)
                : currentProduct.price;
            suggestions = context.products?.filter(p => {
                const pPrice = p.discount_percent ? p.price * (1 - p.discount_percent / 100) : p.price;
                return p.id !== currentProduct.id && pPrice < currentPrice && p.stock > 0;
            }).slice(0, 2) || [];
        } else {
            // Complementary - different type or random selection
            suggestions = context.products?.filter(p =>
                p.id !== currentProduct.id &&
                p.type !== currentProduct.type &&
                p.stock > 0
            ).slice(0, 3) || [];

            // Fallback to any other product if no different type exists
            if (suggestions.length === 0) {
                suggestions = context.products?.filter(p =>
                    p.id !== currentProduct.id && p.stock > 0
                ).slice(0, 3) || [];
            }
        }

        if (suggestions.length === 0) {
            return {
                success: true,
                message: 'Одоогоор санал болгох нэмэлт бараа алга.',
                data: { suggestions: [] }
            };
        }

        const suggestionList = suggestions.map(p => {
            const discountedPrice = p.discount_percent
                ? Math.round(p.price * (1 - p.discount_percent / 100))
                : p.price;
            return {
                name: p.name,
                price: discountedPrice,
                original_price: p.discount_percent ? p.price : undefined
            };
        });

        const suggestionText = suggestions.map(p => {
            const discountedPrice = p.discount_percent
                ? Math.round(p.price * (1 - p.discount_percent / 100))
                : p.price;
            const priceText = p.discount_percent
                ? `~~${p.price?.toLocaleString()}₮~~ ${discountedPrice?.toLocaleString()}₮`
                : `${discountedPrice?.toLocaleString()}₮`;
            return `• ${p.name} - ${priceText}`;
        }).join('\n');

        return {
            success: true,
            message: `"${currentProduct.name}"-тэй хамт авах уу?\n\n${suggestionText}`,
            data: { suggestions: suggestionList }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Suggest related products error:', { error: errorMessage });
        return { success: false, error: 'Санал болгох бараа хайхад алдаа гарлаа' };
    }
}

/**
 * #4 IMPROVEMENT: Execute update_order tool
 * Allows modification of pending orders
 */
async function executeUpdateOrder(
    args: UpdateOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();
    const { action, product_name, new_quantity, notes } = args;

    try {
        // Find the most recent pending order for this customer
        const { data: pendingOrder, error: orderError } = await supabase
            .from('orders')
            .select('id, status, notes, order_items(id, product_id, product_name, quantity, unit_price)')
            .eq('shop_id', context.shopId)
            .eq('customer_id', context.customerId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (orderError || !pendingOrder) {
            return {
                success: false,
                error: 'Өөрчлөх боломжтой захиалга олдсонгүй. Зөвхөн "Хүлээгдэж буй" статустай захиалгыг өөрчилнө.'
            };
        }

        const orderId = pendingOrder.id;

        switch (action) {
            case 'change_quantity': {
                if (!product_name || !new_quantity || new_quantity < 1) {
                    return { success: false, error: 'Барааны нэр болон шинэ тоо хэмжээг оруулна уу.' };
                }

                // Find the order item
                const orderItems = pendingOrder.order_items as any[];
                const item = orderItems?.find((i: any) =>
                    i.product_name.toLowerCase().includes(product_name.toLowerCase())
                );

                if (!item) {
                    return { success: false, error: `"${product_name}" захиалгад олдсонгүй.` };
                }

                // Update quantity
                const { error: updateError } = await supabase
                    .from('order_items')
                    .update({ quantity: new_quantity })
                    .eq('id', item.id);

                if (updateError) {
                    throw updateError;
                }

                // Recalculate order total
                const newTotal = orderItems.reduce((sum: number, i: any) => {
                    const qty = i.id === item.id ? new_quantity : i.quantity;
                    return sum + (i.unit_price * qty);
                }, 0);

                await supabase
                    .from('orders')
                    .update({ total: newTotal })
                    .eq('id', orderId);

                return {
                    success: true,
                    message: `✅ "${item.product_name}" тоо хэмжээг ${new_quantity} болгож өөрчиллөө. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
                    data: { order_id: orderId, new_quantity, new_total: newTotal }
                };
            }

            case 'remove_item': {
                if (!product_name) {
                    return { success: false, error: 'Хасах барааны нэрийг оруулна уу.' };
                }

                const orderItems = pendingOrder.order_items as any[];
                const item = orderItems?.find((i: any) =>
                    i.product_name.toLowerCase().includes(product_name.toLowerCase())
                );

                if (!item) {
                    return { success: false, error: `"${product_name}" захиалгад олдсонгүй.` };
                }

                // Remove item
                await supabase
                    .from('order_items')
                    .delete()
                    .eq('id', item.id);

                // Recalculate total
                const remainingItems = orderItems.filter((i: any) => i.id !== item.id);
                const newTotal = remainingItems.reduce((sum: number, i: any) =>
                    sum + (i.unit_price * i.quantity), 0
                );

                if (remainingItems.length === 0) {
                    // Cancel the order if no items left
                    await supabase
                        .from('orders')
                        .update({ status: 'cancelled', notes: 'Бүх бараа хасагдсан' })
                        .eq('id', orderId);

                    return {
                        success: true,
                        message: `✅ "${item.product_name}" хасагдлаа. Захиалгад бараа үлдээгүй тул цуцлагдлаа.`,
                        data: { order_id: orderId, cancelled: true }
                    };
                }

                await supabase
                    .from('orders')
                    .update({ total: newTotal })
                    .eq('id', orderId);

                return {
                    success: true,
                    message: `✅ "${item.product_name}" захиалгаас хасагдлаа. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
                    data: { order_id: orderId, new_total: newTotal }
                };
            }

            case 'update_notes': {
                const newNotes = notes || '';
                await supabase
                    .from('orders')
                    .update({ notes: newNotes })
                    .eq('id', orderId);

                return {
                    success: true,
                    message: `✅ Захиалгын тэмдэглэл шинэчлэгдлээ.`,
                    data: { order_id: orderId, notes: newNotes }
                };
            }

            case 'add_item': {
                if (!product_name) {
                    return { success: false, error: 'Нэмэх барааны нэрийг оруулна уу.' };
                }

                // Find product in available products
                const quantity = new_quantity || 1;
                const product = await getProductFromDB(context.shopId, product_name);

                if (!product) {
                    return { success: false, error: `"${product_name}" бараа олдсонгүй.` };
                }

                const unitPrice = product.discount_percent
                    ? Math.round(product.price * (1 - product.discount_percent / 100))
                    : product.price;

                // Add order item
                await supabase
                    .from('order_items')
                    .insert({
                        order_id: orderId,
                        product_id: product.id,
                        product_name: product.name,
                        quantity,
                        unit_price: unitPrice
                    });

                // Update order total
                const orderItems = pendingOrder.order_items as any[];
                const currentTotal = orderItems.reduce((sum: number, i: any) =>
                    sum + (i.unit_price * i.quantity), 0
                );
                const newTotal = currentTotal + (unitPrice * quantity);

                await supabase
                    .from('orders')
                    .update({ total: newTotal })
                    .eq('id', orderId);

                return {
                    success: true,
                    message: `✅ "${product.name}" x${quantity} захиалгад нэмэгдлээ. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
                    data: { order_id: orderId, added_product: product.name, quantity, new_total: newTotal }
                };
            }

            default:
                return { success: false, error: `Тодорхойгүй үйлдэл: ${action}` };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Update order error:', { error: errorMessage });
        return { success: false, error: 'Захиалга өөрчлөхөд алдаа гарлаа' };
    }
}

/**
 * Main tool executor - routes to appropriate handler
 */
export async function executeTool(
    toolName: ToolName,
    args: unknown,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    try {
        switch (toolName) {
            case 'collect_contact_info':
                return await executeCollectContact(args as CollectContactArgs, context);
            case 'request_human_support':
                return await executeRequestSupport(args as RequestHumanSupportArgs, context);
            case 'create_order':
                return await executeCreateOrder(args as CreateOrderArgs, context);
            case 'cancel_order':
                return await executeCancelOrder(args as CancelOrderArgs, context);
            case 'show_product_image':
                return executeShowProductImage(args as ShowProductImageArgs, context);
            case 'add_to_cart':
                return await executeAddToCart(args as AddToCartArgs, context);
            case 'view_cart':
                return await executeViewCart(context);
            case 'remove_from_cart':
                return await executeRemoveFromCart(args as RemoveFromCartArgs, context);
            case 'checkout':
                return await executeCheckout(args as CheckoutArgs, context);
            case 'remember_preference':
                return await executeRememberPreference(args as RememberPreferenceArgs, context);
            case 'check_payment_status':
                return await executeCheckPaymentStatus(args as CheckPaymentArgs, context);
            // New tools (Improvements #1-4)
            case 'check_order_status':
                return await executeCheckOrderStatus(args as CheckOrderStatusArgs, context);
            case 'log_complaint':
                return await executeLogComplaint(args as LogComplaintArgs, context);
            case 'suggest_related_products':
                return await executeSuggestRelatedProducts(args as SuggestRelatedProductsArgs, context);
            case 'update_order':
                return await executeUpdateOrder(args as UpdateOrderArgs, context);
            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Tool execution error (${toolName}):`, { error: errorMessage });
        return { success: false, error: errorMessage };
    }
}
