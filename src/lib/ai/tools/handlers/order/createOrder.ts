import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendOrderNotification } from '@/lib/notifications';
import type { CreateOrderArgs } from '../../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../../services/ToolExecutor';

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
        .select('stock, reserved_stock, price, id, status, pre_order_eta, type')
        .eq('id', product.id)
        .single();

    if (!dbProduct) {
        return { success: false, error: 'Бүтээгдэхүүний мэдээлэл олдсонгүй.' };
    }

    const dbStatus = (dbProduct as unknown as { status?: string }).status;
    const dbPreOrderEta = (dbProduct as unknown as { pre_order_eta?: string }).pre_order_eta;
    const dbType = (dbProduct as unknown as { type?: string }).type;

    // #9/#10: surface helpful messages for non-active statuses.
    if (dbStatus === 'discontinued') {
        return { success: false, error: `"${product.name}" нь зогссон бараа байна.` };
    }
    if (dbStatus === 'coming_soon') {
        return {
            success: false,
            error: `"${product.name}" удахгүй ирнэ. Одоогоор захиалга авах боломжгүй.`,
        };
    }

    const rawStock = dbProduct.stock;
    const isService = dbType === 'service' || dbType === 'appointment';
    const hasExplicitCap = typeof rawStock === 'number' && rawStock > 0;
    const availableStock = (rawStock ?? 0) - (dbProduct.reserved_stock || 0);
    const isPreOrder = dbStatus === 'pre_order';
    // Services/appointments without an explicit booking cap have no stock to
    // check — every request is honoured (the AI is just logging an order).
    const serviceUnlimited = isService && !hasExplicitCap;

    // #8: pre_order products don't need stock — we record the order anyway.
    // Services without a cap also bypass the stock check.
    if (!isPreOrder && !serviceUnlimited && availableStock < quantity) {
        return { success: false, error: `Үлдэгдэл хүрэлцэхгүй. Боломжит: ${availableStock}` };
    }

    if (!context.shopId || !context.customerId) {
        return { success: false, error: 'Missing shop or customer ID context.' };
    }

    // Idempotency: only suppress an order when it looks like an accidental
    // double-click — i.e. an EXACT match (product + quantity + variant)
    // submitted within the last 5 seconds. A wider window or a partial match
    // (just product_id) is dangerous: a customer changing the quantity or
    // ordering a different variant of the same product would otherwise be
    // shown the previous order's total instead of getting a fresh one.
    //
    // Variant info lives in `order_items.variant_specs` JSONB, NOT in
    // standalone `color` / `size` columns (those don't exist).
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    const { data: recentDuplicates } = await supabase
        .from('orders')
        .select('id, total_amount, order_items(product_id, quantity, variant_specs)')
        .eq('customer_id', context.customerId)
        .eq('shop_id', context.shopId)
        .eq('status', 'pending')
        .gt('created_at', fiveSecondsAgo)
        .order('created_at', { ascending: false })
        .limit(3);

    type DupItem = {
        product_id: string;
        quantity: number;
        variant_specs: Record<string, string> | null;
    };
    type DupOrder = { id: string; total_amount: number; order_items: DupItem[] };

    const normVariant = (v: Record<string, string> | null | undefined) => {
        const c = v?.color ?? null;
        const s = v?.size ?? null;
        return `${c ?? ''}::${s ?? ''}`;
    };
    const wantedVariant = normVariant({ color: color ?? '', size: size ?? '' });

    const exactDuplicate = (recentDuplicates as DupOrder[] | null)?.find((o) => {
        if (!o.order_items || o.order_items.length !== 1) return false;
        const it = o.order_items[0];
        return (
            it.product_id === product.id &&
            Number(it.quantity) === Number(quantity) &&
            normVariant(it.variant_specs) === wantedVariant
        );
    });

    if (exactDuplicate) {
        logger.info('Exact duplicate order suppressed (≤5s window):', { orderId: exactDuplicate.id });
        return {
            success: true,
            message: `Success! Order #${exactDuplicate.id.substring(0, 8)} created (Found existing). Total: ${exactDuplicate.total_amount.toLocaleString()}₮.`,
            data: { orderId: exactDuplicate.id, total: exactDuplicate.total_amount }
        };
    }

    // Atomic stock reservation (prevents race conditions via SELECT ... FOR UPDATE).
    // Skip for pre_order (#8) — there's no stock to reserve. Skip for
    // services/appointments without an explicit booking cap — they don't
    // track inventory.
    if (!isPreOrder && !serviceUnlimited) {
        const { data: reserved, error: reserveError } = await supabase.rpc('reserve_stock', {
            p_product_id: product.id,
            p_quantity: quantity,
        });

        if (reserveError || !reserved) {
            logger.warn('Stock reservation failed:', { error: reserveError, reserved });
            return { success: false, error: `Үлдэгдэл хүрэлцэхгүй байна. Дахин оролдоно уу.` };
        }
    }

    const orderNotes = isPreOrder
        ? `AI Pre-order: ${product_name} (${color || ''} ${size || ''})${dbPreOrderEta ? ` — ETA ${new Date(dbPreOrderEta).toISOString().slice(0, 10)}` : ''}`
        : `AI Order: ${product_name} (${color || ''} ${size || ''})`;

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            shop_id: context.shopId,
            customer_id: context.customerId,
            status: isPreOrder ? 'pending' : 'pending',
            total_amount: dbProduct.price * quantity,
            notes: orderNotes,
            // Default payment method for Mongolian shops is Cash on Delivery —
            // payment is collected when the courier hands over the goods.
            payment_method: 'cod',
            payment_status: 'pending',
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    // Stock was only reserved for tangible orders — skip release for
    // pre_order and uncapped service orders.
    const stockWasReserved = !isPreOrder && !serviceUnlimited;

    if (orderError) {
        logger.error('Order creation error, releasing stock:', { error: orderError });
        if (stockWasReserved) {
            await supabase.rpc('reserve_stock', { p_product_id: product.id, p_quantity: -quantity });
        }
        return { success: false, error: orderError.message };
    }

    // Build variant_specs JSONB ({color, size}). The standalone `color` /
    // `size` columns do NOT exist on order_items — variant info is stored
    // in this JSONB. Previously the code wrote color/size as top-level
    // columns and PostgREST silently dropped them.
    const variantSpecs: Record<string, string> = {};
    if (color) variantSpecs.color = color;
    if (size) variantSpecs.size = size;

    const { error: itemError } = await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity,
        unit_price: dbProduct.price,
        variant_specs: Object.keys(variantSpecs).length > 0 ? variantSpecs : {},
    });

    if (itemError) {
        logger.error('Order item insert failed, rolling back order:', { error: itemError });
        await supabase.from('orders').delete().eq('id', order.id);
        if (stockWasReserved) {
            await supabase.rpc('reserve_stock', { p_product_id: product.id, p_quantity: -quantity });
        }
        return { success: false, error: 'Захиалгын бараа нэмэхэд алдаа гарлаа. Дахин оролдоно уу.' };
    }

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

    const successMessage = isPreOrder
        ? `Урьдчилсан захиалга #${order.id.substring(0, 8)} бүртгэгдлээ! Бараа${dbPreOrderEta ? ` ${new Date(dbPreOrderEta).toISOString().slice(0, 10)}` : ''} ирэх төлөвтэй. Нийт: ${(dbProduct.price * quantity).toLocaleString()}₮.`
        : `Success! Order #${order.id.substring(0, 8)} created. Total: ${(dbProduct.price * quantity).toLocaleString()}₮. Stock reserved.`;

    return {
        success: true,
        message: successMessage,
        data: { orderId: order.id, total: dbProduct.price * quantity, preOrder: isPreOrder },
        actions: [
            {
                type: 'confirmation',
                buttons: [
                    {
                        id: 'cod',
                        label: '📦 Хүргэлтээр авч төлөх',
                        variant: 'primary',
                        payload: 'CHECKOUT_COD',
                    },
                    {
                        id: 'checkout_now',
                        label: '💳 Шууд төлөх',
                        variant: 'secondary',
                        payload: 'CHECKOUT',
                    },
                    {
                        id: 'continue',
                        label: '🛒 Үргэлжлүүлэх',
                        variant: 'secondary',
                        payload: 'CONTINUE_SHOPPING',
                    },
                ],
                context: { order_id: order.id },
            },
        ],
    };
}
