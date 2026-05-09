import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { getProductFromDB } from '../../../helpers/stockHelpers';
import type { UpdateOrderArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';
import { pickOne, type OrderItemRow } from '@/types/supabase-helpers';

const productName = (item: OrderItemRow): string =>
    pickOne(item.products)?.name ?? '';

export async function executeUpdateOrder(
    args: UpdateOrderArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();
    const { action, product_name, new_quantity, notes } = args;

    try {
        const { data: pendingOrder, error: orderError } = await supabase
            .from('orders')
            .select('id, status, notes, order_items(id, product_id, quantity, unit_price, products(name))')
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

                const orderItems = (pendingOrder.order_items ?? []) as OrderItemRow[];
                const item = orderItems.find((i) =>
                    productName(i).toLowerCase().includes(product_name.toLowerCase())
                );

                if (!item) {
                    return { success: false, error: `"${product_name}" захиалгад олдсонгүй.` };
                }

                // Adjust the product's reserved_stock to reflect the new
                // quantity. Without this the eventual atomic stock deduction
                // would either overshoot (and "borrow" from another customer)
                // or undershoot (and leave a phantom reservation behind).
                const delta = new_quantity - item.quantity;
                if (delta !== 0) {
                    const { data: ok, error: reserveError } = await supabase.rpc(
                        'reserve_stock',
                        { p_product_id: item.product_id, p_quantity: delta },
                    );
                    if (reserveError || (delta > 0 && !ok)) {
                        logger.warn('change_quantity: reservation adjust failed', {
                            error: reserveError,
                            delta,
                        });
                        return { success: false, error: 'Үлдэгдэл хүрэлцэхгүй байна.' };
                    }
                }

                const { error: updateError } = await supabase
                    .from('order_items')
                    .update({ quantity: new_quantity })
                    .eq('id', item.id);

                if (updateError) {
                    // Roll back the reservation delta if updating the row failed
                    if (delta !== 0) {
                        await supabase.rpc('reserve_stock', {
                            p_product_id: item.product_id,
                            p_quantity: -delta,
                        });
                    }
                    throw updateError;
                }

                const newTotal = orderItems.reduce((sum, i) => {
                    const qty = i.id === item.id ? new_quantity : i.quantity;
                    return sum + (i.unit_price * qty);
                }, 0);

                const { error: totalError } = await supabase
                    .from('orders')
                    .update({ total_amount: newTotal })
                    .eq('id', orderId);
                if (totalError) throw totalError;

                return {
                    success: true,
                    message: `✅ "${productName(item) || 'Бараа'}" тоо хэмжээг ${new_quantity} болгож өөрчиллөө. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
                    data: { order_id: orderId, new_quantity, new_total: newTotal }
                };
            }

            case 'remove_item': {
                if (!product_name) {
                    return { success: false, error: 'Хасах барааны нэрийг оруулна уу.' };
                }

                const orderItems = (pendingOrder.order_items ?? []) as OrderItemRow[];
                const item = orderItems.find((i) =>
                    productName(i).toLowerCase().includes(product_name.toLowerCase())
                );

                if (!item) {
                    return { success: false, error: `"${product_name}" захиалгад олдсонгүй.` };
                }

                // Release the reservation that this item was holding. Without
                // this, products.reserved_stock keeps blocking future orders
                // even though no one is buying the item anymore.
                await supabase.rpc('reserve_stock', {
                    p_product_id: item.product_id,
                    p_quantity: -item.quantity,
                });

                await supabase.from('order_items').delete().eq('id', item.id);

                const remainingItems = orderItems.filter((i) => i.id !== item.id);
                const newTotal = remainingItems.reduce(
                    (sum, i) => sum + i.unit_price * i.quantity,
                    0
                );

                if (remainingItems.length === 0) {
                    await supabase
                        .from('orders')
                        .update({ status: 'cancelled', notes: 'Бүх бараа хасагдсан' })
                        .eq('id', orderId);

                    return {
                        success: true,
                        message: `✅ "${productName(item) || 'Бараа'}" хасагдлаа. Захиалгад бараа үлдээгүй тул цуцлагдлаа.`,
                        data: { order_id: orderId, cancelled: true }
                    };
                }

                const { error: totalError } = await supabase
                    .from('orders')
                    .update({ total_amount: newTotal })
                    .eq('id', orderId);
                if (totalError) throw totalError;

                return {
                    success: true,
                    message: `✅ "${productName(item) || 'Бараа'}" захиалгаас хасагдлаа. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
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

                // Reserve stock atomically before inserting the order_item so
                // that the eventual stock deduction (atomic_claim_stock_deduction)
                // doesn't "borrow" from other customers' reservations.
                const { data: reserved, error: reserveError } = await supabase.rpc(
                    'reserve_stock',
                    { p_product_id: product.id, p_quantity: quantity },
                );
                if (reserveError || !reserved) {
                    logger.warn('add_item: stock reservation failed', { error: reserveError });
                    return { success: false, error: 'Үлдэгдэл хүрэлцэхгүй байна. Дахин оролдоно уу.' };
                }

                const unitPrice = product.discount_percent
                    ? Math.round(product.price * (1 - product.discount_percent / 100))
                    : product.price;

                const { error: itemError } = await supabase.from('order_items').insert({
                    order_id: orderId,
                    product_id: product.id,
                    quantity,
                    unit_price: unitPrice
                });

                if (itemError) {
                    // Roll back the reservation if the insert failed
                    await supabase.rpc('reserve_stock', {
                        p_product_id: product.id,
                        p_quantity: -quantity,
                    });
                    logger.error('add_item: order_item insert failed, reservation released', {
                        error: itemError.message,
                    });
                    return { success: false, error: 'Захиалгад нэмэхэд алдаа гарлаа. Дахин оролдоно уу.' };
                }

                const orderItems = (pendingOrder.order_items ?? []) as OrderItemRow[];
                const currentTotal = orderItems.reduce(
                    (sum, i) => sum + i.unit_price * i.quantity,
                    0
                );
                const newTotal = currentTotal + (unitPrice * quantity);

                const { error: totalError } = await supabase
                    .from('orders')
                    .update({ total_amount: newTotal })
                    .eq('id', orderId);
                if (totalError) throw totalError;

                return {
                    success: true,
                    message: `✅ "${product.name}" x${quantity} захиалгад нэмэгдлээ. Шинэ нийт дүн: ${newTotal.toLocaleString()}₮`,
                    data: { order_id: orderId, added_product: product.name, quantity, new_total: newTotal }
                };
            }

            default:
                return { success: false, error: `Тодорхойгүй үйлдэл: ${action}` };
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Update order error:', { error: errorMessage });
        return { success: false, error: 'Захиалга өөрчлөхөд алдаа гарлаа' };
    }
}
