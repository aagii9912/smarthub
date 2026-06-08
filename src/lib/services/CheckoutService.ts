/**
 * CheckoutService — shared core for the customer-facing checkout-review link.
 *
 * `calculateCartDelivery` and `performCheckout` mirror the logic in the AI
 * checkout tool (`src/lib/ai/tools/handlers/order/checkout.ts`) but return
 * structured data instead of chat messages, so the `/checkout/[token]` review
 * page (live total preview + confirm) and any other caller can reuse them.
 *
 * NOTE: the AI tool (`executeCheckout`) is intentionally left untouched for now
 * to avoid changing the live revenue path without E2E coverage. Unifying it to
 * call `performCheckout` is a recommended follow-up.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendOrderNotification } from '@/lib/notifications';
import { getCartFromDB } from '@/lib/ai/helpers/stockHelpers';
import { createShopOrderInvoice } from '@/lib/payment/qpay';
import { resolveDeliveryFee, type DeliveryPolicy } from '@/lib/utils/delivery';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

export type CheckoutPaymentType = 'cod' | 'qpay' | 'bank';

export interface DeliveryCalc {
    totalDeliveryFee: number;
    deliveryMethod: 'delivery' | 'pickup';
    hasDeliveryItems: boolean;
    hasPickupOnly: boolean;
}

/**
 * Compute delivery fee + method for a set of cart items.
 *
 * 1. Accumulate per-product fees (delivery_type = 'paid' adds delivery_fee;
 *    'pickup_only' flags pickup; 'included' counts as a deliverable item).
 * 2. If the shop configured a delivery_policy override (UB/province fee or a
 *    free-delivery threshold), that takes precedence via `resolveDeliveryFee`.
 *
 * Used by the review summary, item mutations (live total), and `performCheckout`
 * so every surface agrees on the fee.
 */
export async function calculateCartDelivery(
    shopId: string,
    items: Array<{ product_id: string; quantity: number }>,
    cartSubtotal: number,
    customerAddress: string | null,
): Promise<DeliveryCalc> {
    const supabase = supabaseAdmin();

    let totalDeliveryFee = 0;
    let hasDeliveryItems = false;
    let hasPickupOnly = false;

    const productIds = [...new Set(items.map((i) => i.product_id))];
    if (productIds.length > 0) {
        const { data: products } = await supabase
            .from('products')
            .select('id, delivery_type, delivery_fee')
            .in('id', productIds);

        const byId = new Map((products ?? []).map((p) => [p.id, p]));
        for (const item of items) {
            const product = byId.get(item.product_id);
            if (!product) continue;
            if (product.delivery_type === 'paid' && product.delivery_fee) {
                totalDeliveryFee += Number(product.delivery_fee);
                hasDeliveryItems = true;
            } else if (product.delivery_type === 'pickup_only') {
                hasPickupOnly = true;
            } else if (product.delivery_type === 'included') {
                hasDeliveryItems = true;
            }
        }
    }

    const deliveryMethod: 'delivery' | 'pickup' =
        hasPickupOnly && !hasDeliveryItems ? 'pickup' : 'delivery';

    // Shop-level policy override (centralised UB vs province pricing / free threshold)
    if (hasDeliveryItems) {
        const { data: shop } = await supabase
            .from('shops')
            .select('delivery_policy')
            .eq('id', shopId)
            .single();
        const policy = (shop?.delivery_policy ?? null) as DeliveryPolicy | null;
        const policyHasOverride =
            policy != null &&
            ((policy.ub_delivery_fee ?? 0) > 0 ||
                (policy.province_delivery_fee ?? 0) > 0 ||
                policy.free_delivery_threshold != null);
        if (policyHasOverride) {
            const resolved = resolveDeliveryFee(policy, customerAddress, cartSubtotal);
            totalDeliveryFee = resolved.fee;
            logger.info('checkout: applied shop delivery policy', {
                region: resolved.region,
                fee: resolved.fee,
                free: resolved.free,
            });
        }
    }

    return { totalDeliveryFee, deliveryMethod, hasDeliveryItems, hasPickupOnly };
}

export interface PerformCheckoutParams {
    shopId: string;
    customerId: string;
    /** Requested method; falls back to the shop's first enabled method. */
    paymentType?: CheckoutPaymentType;
    notes?: string;
    customerName?: string | null;
    /** Send the shop owner a "new order" push (default true). */
    notifyOrder?: boolean;
}

export interface CheckoutShopInfo {
    name: string | null;
    address: string | null;
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
}

export interface PerformCheckoutResult {
    success: boolean;
    error?: string;

    /** Delivery items present but the customer is missing phone/address. */
    awaitingDeliveryInfo?: boolean;
    cartId?: string;
    itemCount?: number;
    missingPhone?: boolean;
    missingAddress?: boolean;

    /** Which message branch the caller should render. */
    messageFlow?: 'cod' | 'qpay' | 'bank';
    orderId?: string;
    paymentId?: string | null;
    paymentLink?: string | null;
    qpay?: boolean;
    paymentMethod?: 'cod' | 'qpay' | 'bank_transfer';
    cartAmount?: number;
    deliveryFee?: number;
    deliveryMethod?: 'delivery' | 'pickup';
    totalWithDelivery?: number;
    shop?: CheckoutShopInfo | null;
}

/**
 * Convert the customer's active cart into an order + payment record.
 * Returns structured data; the caller formats any user-facing message.
 */
export async function performCheckout(
    params: PerformCheckoutParams,
): Promise<PerformCheckoutResult> {
    const {
        shopId,
        customerId,
        notes,
        customerName,
        paymentType = 'cod',
        notifyOrder = true,
    } = params;
    const supabase = supabaseAdmin();

    const cart = await getCartFromDB(shopId, customerId);
    if (!cart || cart.items.length === 0) {
        return { success: false, error: 'Сагс хоосон байна. Эхлээд бараа нэмнэ үү.' };
    }

    // Customer contact info (needed for delivery items + policy classification)
    const { data: customer } = await supabase
        .from('customers')
        .select('phone, address')
        .eq('id', customerId)
        .single();

    const delivery = await calculateCartDelivery(
        shopId,
        cart.items,
        cart.total_amount,
        customer?.address ?? null,
    );
    const { totalDeliveryFee, deliveryMethod, hasDeliveryItems } = delivery;

    // Block checkout until delivery contact info exists
    if (hasDeliveryItems && (!customer?.phone || !customer?.address)) {
        return {
            success: true,
            awaitingDeliveryInfo: true,
            cartId: cart.id,
            itemCount: cart.items.length,
            cartAmount: cart.total_amount,
            deliveryFee: totalDeliveryFee,
            missingPhone: !customer?.phone,
            missingAddress: !customer?.address,
        };
    }

    // Atomically create order + order_items, reserve stock, close cart
    const { data: orderId, error: checkoutError } = await supabase.rpc('checkout_cart', {
        p_cart_id: cart.id,
        p_notes: notes || 'Checkout',
    });
    if (checkoutError || !orderId) {
        logger.error('Checkout error:', { error: checkoutError });
        return { success: false, error: checkoutError?.message || 'Захиалга үүсгэхэд алдаа гарлаа' };
    }

    await supabase
        .from('orders')
        .update({
            delivery_method: deliveryMethod,
            delivery_fee: totalDeliveryFee,
            customer_phone: hasDeliveryItems ? customer?.phone || null : null,
            delivery_address: hasDeliveryItems ? customer?.address || null : null,
        })
        .eq('id', orderId);

    // Shop payment config
    const { data: shop } = await supabase
        .from('shops')
        .select(
            'name, bank_name, account_number, account_name, qpay_merchant_id, qpay_bank_code, qpay_account_number, qpay_account_name, qpay_status, address, accepted_payment_methods',
        )
        .eq('id', shopId)
        .single();

    const acceptedMethods = (shop?.accepted_payment_methods ?? {
        cod: true,
        qpay: true,
        bank_transfer: true,
    }) as Record<string, boolean>;

    const isMethodEnabled = (t: CheckoutPaymentType) => {
        if (t === 'cod') return acceptedMethods.cod !== false;
        if (t === 'qpay') return acceptedMethods.qpay !== false;
        if (t === 'bank') return acceptedMethods.bank_transfer !== false;
        return false;
    };

    let resolvedPaymentType: CheckoutPaymentType = paymentType;
    if (!isMethodEnabled(resolvedPaymentType)) {
        if (isMethodEnabled('cod')) resolvedPaymentType = 'cod';
        else if (isMethodEnabled('qpay')) resolvedPaymentType = 'qpay';
        else if (isMethodEnabled('bank')) resolvedPaymentType = 'bank';
        else {
            return {
                success: false,
                error: 'Дэлгүүрийн зүгээс ямар ч төлбөрийн хэлбэр идэвхжүүлээгүй байна. Дэлгүүрийн эзэнтэй холбогдоно уу.',
            };
        }
        logger.info('payment_type fell back due to shop settings:', {
            requested: paymentType,
            resolved: resolvedPaymentType,
        });
    }

    const totalWithDelivery = cart.total_amount + totalDeliveryFee;
    const shopInfo: CheckoutShopInfo = {
        name: shop?.name ?? null,
        address: shop?.address ?? null,
        bank_name: shop?.bank_name ?? null,
        account_number: shop?.account_number ?? null,
        account_name: shop?.account_name ?? null,
    };

    const baseResult: PerformCheckoutResult = {
        success: true,
        orderId,
        cartAmount: cart.total_amount,
        deliveryFee: totalDeliveryFee,
        deliveryMethod,
        totalWithDelivery,
        shop: shopInfo,
    };

    // ── Cash on Delivery: no QPay invoice; trigger marks paid on delivery ──
    if (resolvedPaymentType === 'cod') {
        await supabase
            .from('orders')
            .update({ payment_method: 'cod', payment_status: 'pending', total_amount: totalWithDelivery })
            .eq('id', orderId);

        const { data: payment } = await supabase
            .from('payments')
            .insert({
                order_id: orderId,
                shop_id: shopId,
                payment_type: 'order',
                payment_method: 'cod',
                amount: totalWithDelivery,
                status: 'pending',
                metadata: { source: 'checkout', delivery_fee: totalDeliveryFee, delivery_method: deliveryMethod },
            })
            .select('id')
            .single();

        if (notifyOrder) {
            try {
                await sendOrderNotification(shopId, 'new', {
                    orderId,
                    customerName: customerName ?? undefined,
                    totalAmount: totalWithDelivery,
                });
            } catch (e) {
                logger.warn('Notification failed but COD order created:', { error: String(e) });
            }
        }

        return {
            ...baseResult,
            messageFlow: 'cod',
            paymentId: payment?.id ?? null,
            paymentLink: null,
            qpay: false,
            paymentMethod: 'cod',
        };
    }

    // ── QPay invoice (shop's own merchant) ──
    let paymentId: string | null = null;
    let paymentLink: string | null = null;
    let qpaySuccess = false;

    if (resolvedPaymentType === 'qpay' && shop?.qpay_merchant_id && shop.qpay_status === 'active') {
        try {
            const qpayInvoice = await createShopOrderInvoice({
                shopMerchantId: shop.qpay_merchant_id,
                shopBankCode: shop.qpay_bank_code!,
                shopAccountNumber: shop.qpay_account_number!,
                shopAccountName: shop.qpay_account_name!,
                orderId,
                amount: totalWithDelivery,
                shopName: shop.name || 'Shop',
                callbackUrl: `${SITE_URL}/api/payment/webhook?type=order&order=${orderId}`,
            });

            if (qpayInvoice) {
                const { data: payment } = await supabase
                    .from('payments')
                    .insert({
                        order_id: orderId,
                        shop_id: shopId,
                        payment_type: 'order',
                        payment_method: 'qpay',
                        amount: totalWithDelivery,
                        status: 'pending',
                        qpay_invoice_id: qpayInvoice.invoice_id,
                        qpay_qr_text: qpayInvoice.qr_text,
                        qpay_qr_image: qpayInvoice.qr_image,
                        metadata: {
                            urls: qpayInvoice.urls,
                            source: 'checkout',
                            shop_merchant_id: shop.qpay_merchant_id,
                            delivery_fee: totalDeliveryFee,
                            delivery_method: deliveryMethod,
                        },
                        expires_at: qpayInvoice.expiry_date || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    })
                    .select('id')
                    .single();

                if (payment) {
                    paymentId = payment.id;
                    paymentLink = `${SITE_URL}/pay/${payment.id}`;
                    qpaySuccess = true;
                    await supabase
                        .from('orders')
                        .update({ payment_method: 'qpay', total_amount: totalWithDelivery })
                        .eq('id', orderId);
                }
            }
        } catch (err) {
            logger.warn('QPay invoice creation failed:', { error: String(err) });
        }
    }

    // ── Fallback: bank transfer (or COD if no bank account) ──
    if (!qpaySuccess) {
        const fallbackMethod = shop?.account_number ? 'bank_transfer' : 'cod';
        const { data: payment } = await supabase
            .from('payments')
            .insert({
                order_id: orderId,
                shop_id: shopId,
                payment_type: 'order',
                payment_method: fallbackMethod,
                amount: totalWithDelivery,
                status: 'pending',
            })
            .select('id')
            .single();
        if (payment) paymentId = payment.id;

        await supabase
            .from('orders')
            .update({ payment_method: fallbackMethod, payment_status: 'pending', total_amount: totalWithDelivery })
            .eq('id', orderId);
    }

    if (notifyOrder) {
        try {
            await sendOrderNotification(shopId, 'new', {
                orderId,
                customerName: customerName ?? undefined,
                totalAmount: totalWithDelivery,
            });
        } catch (e) {
            logger.warn('Notification failed but order created:', { error: String(e) });
        }
    }

    return {
        ...baseResult,
        messageFlow: qpaySuccess && paymentLink ? 'qpay' : 'bank',
        paymentId,
        paymentLink,
        qpay: qpaySuccess,
        paymentMethod: qpaySuccess ? 'qpay' : shop?.account_number ? 'bank_transfer' : 'cod',
    };
}

// ── Checkout-review link (token = cart id) ──────────────────────────────────

export interface CheckoutItemView {
    id: string;
    product_id: string;
    name: string;
    image: string | null;
    variant_specs: Record<string, string>;
    quantity: number;
    unit_price: number;
    subtotal: number;
    available_stock: number;
}

export interface CheckoutSummary {
    cartId: string;
    shopId: string;
    customerId: string;
    status: string;
    shopName: string;
    shopAddress: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    items: CheckoutItemView[];
    subtotal: number;
    deliveryFee: number;
    deliveryMethod: 'delivery' | 'pickup';
    total: number;
    hasDeliveryItems: boolean;
    /** Delivery items present but customer phone/address missing. */
    needsDeliveryInfo: boolean;
}

/**
 * Resolve a checkout-review token (the cart id) into a full summary with live
 * subtotal + delivery + total. Returns null when the cart does not exist.
 * Service-role read scoped strictly to the token's cart/shop/customer.
 */
export async function getCheckoutSummary(token: string): Promise<CheckoutSummary | null> {
    const supabase = supabaseAdmin();

    const { data: cart } = await supabase
        .from('carts')
        .select('id, shop_id, customer_id, status')
        .eq('id', token)
        .single();
    if (!cart) return null;

    const { data: itemsRaw } = await supabase
        .from('cart_items')
        .select('id, product_id, variant_specs, quantity, unit_price, products(name, image_url, stock, reserved_stock)')
        .eq('cart_id', cart.id);

    const items: CheckoutItemView[] = (itemsRaw ?? []).map((it: Record<string, unknown>) => {
        const p = (Array.isArray(it.products) ? it.products[0] : it.products) as Record<string, unknown> | null;
        const qty = Number(it.quantity);
        const price = Number(it.unit_price);
        const stock = Number(p?.stock ?? 0);
        const reserved = Number(p?.reserved_stock ?? 0);
        return {
            id: it.id as string,
            product_id: it.product_id as string,
            name: (p?.name as string) || 'Бараа',
            image: (p?.image_url as string) || null,
            variant_specs: (it.variant_specs as Record<string, string>) || {},
            quantity: qty,
            unit_price: price,
            subtotal: price * qty,
            available_stock: Math.max(0, stock - reserved),
        };
    });

    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

    const [{ data: shop }, { data: customer }] = await Promise.all([
        supabase.from('shops').select('name, address').eq('id', cart.shop_id).single(),
        supabase.from('customers').select('phone, address').eq('id', cart.customer_id).single(),
    ]);

    const delivery = await calculateCartDelivery(
        cart.shop_id,
        items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        subtotal,
        customer?.address ?? null,
    );

    return {
        cartId: cart.id,
        shopId: cart.shop_id,
        customerId: cart.customer_id,
        status: cart.status,
        shopName: shop?.name || 'Дэлгүүр',
        shopAddress: shop?.address ?? null,
        customerPhone: customer?.phone ?? null,
        customerAddress: customer?.address ?? null,
        items,
        subtotal,
        deliveryFee: delivery.totalDeliveryFee,
        deliveryMethod: delivery.deliveryMethod,
        total: subtotal + delivery.totalDeliveryFee,
        hasDeliveryItems: delivery.hasDeliveryItems,
        needsDeliveryInfo: delivery.hasDeliveryItems && (!customer?.phone || !customer?.address),
    };
}
