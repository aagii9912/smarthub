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

function stableVariantKey(specs: Record<string, string>): string {
    const keys = Object.keys(specs).sort();
    return keys.map((k) => `${k}=${specs[k]}`).join('&');
}

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

    // Stale-cart guard: if every existing cart item is older than 30 minutes
    // it almost certainly belongs to a previous chat session that was
    // abandoned. Carrying those items into a new session has been the root
    // cause of "I asked for 1 Pro plan but the order has 3" reports — the
    // cart silently merged old quantities with the new add. Clear them out
    // and start fresh.
    const STALE_CART_MS = 30 * 60 * 1000;
    const { data: existingItems } = await supabase
        .from('cart_items')
        .select('id, created_at')
        .eq('cart_id', cartId);
    if (existingItems && existingItems.length > 0) {
        const newest = Math.max(
            ...existingItems.map((it) => new Date(it.created_at as string).getTime()),
        );
        if (Date.now() - newest > STALE_CART_MS) {
            await supabase.from('cart_items').delete().eq('cart_id', cartId);
        }
    }

    const discountedPrice = product.discount_percent
        ? Math.round(product.price * (1 - product.discount_percent / 100))
        : product.price;

    const variantSpecs: Record<string, string> = {};
    if (color) variantSpecs.color = color;
    if (size) variantSpecs.size = size;

    // Dedup a Gemini-side duplicate call within the same chat reply. Without
    // this, "Цамц 2 авъя" can land in the cart as 4 if the model re-fires the
    // tool while iterating. The first call wins; the second is acknowledged
    // with the cart total but doesn't double-apply.
    const dedupKey = `${product.id}|${stableVariantKey(variantSpecs)}`;
    if (context.addToCartKeys?.has(dedupKey)) {
        const { data: dupTotal } = await supabase.rpc('calculate_cart_total', { p_cart_id: cartId });
        return {
            success: true,
            message: `${product.name} аль хэдийн сагсанд орсон. Нийт: ${dupTotal?.toLocaleString()}₮`,
            data: { cart_total: dupTotal, deduped: true },
        };
    }

    const result = await addItemToCart(cartId, product.id, variantSpecs, quantity, discountedPrice);
    context.addToCartKeys?.add(dedupKey);
    const { data: total } = await supabase.rpc('calculate_cart_total', { p_cart_id: cartId });

    let urgencyHint = '';
    // Skip the "low stock" nudge for services without a booking cap —
    // they aren't actually running out of anything.
    if (!stockCheck.unlimited && stockCheck.currentStock <= 3) {
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
        ],
        actions: [
            {
                type: 'cart_actions',
                buttons: [
                    {
                        id: 'checkout',
                        label: '💳 Төлбөр төлөх',
                        icon: 'checkout',
                        variant: 'primary',
                        payload: 'CHECKOUT',
                    },
                    {
                        id: 'view_cart',
                        label: '🛒 Сагс харах',
                        icon: 'cart',
                        variant: 'secondary',
                        payload: 'VIEW_CART',
                    },
                ],
                context: { cart_total: total },
            },
        ],
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
        ],
        actions: [
            {
                type: 'cart_actions',
                buttons: [
                    {
                        id: 'checkout',
                        label: '💳 Төлбөр төлөх',
                        icon: 'checkout',
                        variant: 'primary',
                        payload: 'CHECKOUT',
                    },
                    {
                        id: 'add_more',
                        label: '➕ Бараа нэмэх',
                        icon: 'cart',
                        variant: 'secondary',
                        payload: 'ADD_MORE',
                    },
                    {
                        id: 'clear_cart',
                        label: '🗑️ Цэвэрлэх',
                        icon: 'remove',
                        variant: 'danger',
                        payload: 'CLEAR_CART',
                    },
                ],
            },
        ],
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

    const { error: deleteError } = await supabase.from('cart_items').delete().eq('id', item.id);

    if (deleteError) {
        return { success: false, error: 'Сагснаас хасахад алдаа гарлаа. Дахин оролдоно уу.' };
    }

    return { success: true, message: `${item.name} сагснаас хасагдлаа` };
}
