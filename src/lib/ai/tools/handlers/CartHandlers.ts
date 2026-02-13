/**
 * Cart Tool Handlers
 * Handles: add_to_cart, view_cart, remove_from_cart
 */

import { supabaseAdmin } from '@/lib/supabase';
import { checkProductStock, getProductFromDB, addItemToCart, getCartFromDB } from '../../helpers/stockHelpers';
import type {
    AddToCartArgs,
    RemoveFromCartArgs,
} from '../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../services/ToolExecutor';

export async function executeAddToCart(
    args: AddToCartArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { product_name, quantity = 1, color, size } = args;
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const product = await getProductFromDB(context.shopId, product_name);
    if (!product) {
        return { success: false, error: `"${product_name}" олдсонгүй` };
    }

    const stockCheck = await checkProductStock(product.id, quantity);
    if (!stockCheck.available) {
        return { success: false, error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${stockCheck.currentStock}` };
    }

    const { data: cartId } = await supabase.rpc('get_or_create_cart', {
        p_shop_id: context.shopId,
        p_customer_id: context.customerId
    });

    const discountedPrice = product.discount_percent
        ? Math.round(product.price * (1 - product.discount_percent / 100))
        : product.price;

    const variantSpecs: Record<string, string> = {};
    if (color) variantSpecs.color = color;
    if (size) variantSpecs.size = size;

    const result = await addItemToCart(cartId, product.id, variantSpecs, quantity, discountedPrice);
    const { data: total } = await supabase.rpc('calculate_cart_total', { p_cart_id: cartId });

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
