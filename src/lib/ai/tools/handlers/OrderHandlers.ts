/**
 * Order Tool Handlers
 * Handles: create_order, cancel_order, update_order, check_order_status, checkout
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendOrderNotification, sendPushNotification } from '@/lib/notifications';
import { getProductFromDB, getCartFromDB } from '../../helpers/stockHelpers';
import { createQPayInvoice } from '@/lib/payment/qpay';
import type {
    CreateOrderArgs,
    CancelOrderArgs,
    UpdateOrderArgs,
    CheckOrderStatusArgs,
    CheckoutArgs,
} from '../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../services/ToolExecutor';

export async function executeCreateOrder(
    args: CreateOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { product_name, quantity, color, size } = args;
    const supabase = supabaseAdmin();

    const product = context.products.find(p =>
        p.name.toLowerCase().includes(product_name.toLowerCase())
    );

    if (!product) {
        return { success: false, error: `Product "${product_name}" not found.` };
    }

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

    // Idempotency: check for duplicate pending orders
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

    await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity,
        unit_price: dbProduct.price,
        color: color || null,
        size: size || null
    });

    await supabase
        .from('products')
        .update({ reserved_stock: (dbProduct.reserved_stock || 0) + quantity })
        .eq('id', product.id);

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

export async function executeCancelOrder(
    args: CancelOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { reason } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

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

    await supabase
        .from('orders')
        .update({ status: 'cancelled', notes: `Cancelled by customer. Reason: ${reason || 'Not specified'}` })
        .eq('id', pendingOrder.id);

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

export async function executeCheckOrderStatus(
    args: CheckOrderStatusArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();
    const { orderId } = { orderId: args.order_id };

    try {
        let query = supabase
            .from('orders')
            .select('id, status, total, created_at, order_items(product_name, quantity, unit_price)')
            .eq('shop_id', context.shopId)
            .eq('customer_id', context.customerId)
            .order('created_at', { ascending: false });

        if (orderId) {
            query = query.eq('id', orderId);
        } else {
            query = query.limit(5);
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

    let qpayInvoice = null;
    let bankInfo = null;

    try {
        const { data: shop } = await supabase
            .from('shops')
            .select('bank_name, account_number, account_name')
            .eq('id', context.shopId)
            .single();

        bankInfo = shop;

        qpayInvoice = await createQPayInvoice({
            orderId: orderId,
            amount: cart.total_amount,
            description: `Order #${orderId.substring(0, 8)}`,
            callbackUrl: `https://smarthub.mn/api/payment/callback/qpay`
        });
    } catch (err) {
        logger.warn('Failed to generate payment info:', { error: String(err) });
    }

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

    let paymentMsg = `Захиалга #${orderId.substring(0, 8)} амжилттай үүслээ! Нийт: ${cart.total_amount.toLocaleString()}₮\n\nТөлбөр төлөх сонголтууд:`;

    if (qpayInvoice) {
        paymentMsg += `\n\n1. QPay (Хялбар): Доорх линкээр орж эсвэл QR кодыг уншуулж төлнө үү.\n${qpayInvoice.qpay_shorturl}`;
    }

    if (bankInfo && bankInfo.account_number) {
        paymentMsg += `\n\n2. Дансны шилжүүлэг:\nБанк: ${bankInfo.bank_name || 'Банк'}\nДанс: ${bankInfo.account_number}\nНэр: ${bankInfo.account_name || 'Дэлгүүр'}\nГүйлгээний утга: ${orderId.substring(0, 8)}`;
        paymentMsg += `\n\n*Дансаар шилжүүлсэн бол баримтаа илгээнэ үү.`;
    }

    return {
        success: true,
        message: paymentMsg,
        data: { order_id: orderId, qpay: qpayInvoice, bank: bankInfo }
    };
}

export async function executeUpdateOrder(
    args: UpdateOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();
    const { action, product_name, new_quantity, notes } = args;

    try {
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

                const orderItems = pendingOrder.order_items as any[];
                const item = orderItems?.find((i: any) =>
                    i.product_name.toLowerCase().includes(product_name.toLowerCase())
                );

                if (!item) {
                    return { success: false, error: `"${product_name}" захиалгад олдсонгүй.` };
                }

                const { error: updateError } = await supabase
                    .from('order_items')
                    .update({ quantity: new_quantity })
                    .eq('id', item.id);

                if (updateError) throw updateError;

                const newTotal = orderItems.reduce((sum: number, i: any) => {
                    const qty = i.id === item.id ? new_quantity : i.quantity;
                    return sum + (i.unit_price * qty);
                }, 0);

                await supabase.from('orders').update({ total: newTotal }).eq('id', orderId);

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

                await supabase.from('order_items').delete().eq('id', item.id);

                const remainingItems = orderItems.filter((i: any) => i.id !== item.id);
                const newTotal = remainingItems.reduce((sum: number, i: any) =>
                    sum + (i.unit_price * i.quantity), 0
                );

                if (remainingItems.length === 0) {
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

                await supabase.from('orders').update({ total: newTotal }).eq('id', orderId);

                return {
                    success: true,
                    message: `✅ "${item.product_name}" захиалгаас хасагдлаа. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
                    data: { order_id: orderId, new_total: newTotal }
                };
            }

            case 'update_notes': {
                const newNotes = notes || '';
                await supabase.from('orders').update({ notes: newNotes }).eq('id', orderId);

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

                const quantity = new_quantity || 1;
                const product = await getProductFromDB(context.shopId, product_name);

                if (!product) {
                    return { success: false, error: `"${product_name}" бараа олдсонгүй.` };
                }

                const unitPrice = product.discount_percent
                    ? Math.round(product.price * (1 - product.discount_percent / 100))
                    : product.price;

                await supabase.from('order_items').insert({
                    order_id: orderId,
                    product_id: product.id,
                    product_name: product.name,
                    quantity,
                    unit_price: unitPrice
                });

                const orderItems = pendingOrder.order_items as any[];
                const currentTotal = orderItems.reduce((sum: number, i: any) =>
                    sum + (i.unit_price * i.quantity), 0
                );
                const newTotal = currentTotal + (unitPrice * quantity);

                await supabase.from('orders').update({ total: newTotal }).eq('id', orderId);

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
