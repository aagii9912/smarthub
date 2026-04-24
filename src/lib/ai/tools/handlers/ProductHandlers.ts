/**
 * Product & Analytics Tool Handlers
 * Handles: show_product_image, suggest_related_products, check_payment_status, log_complaint
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { checkPaymentStatus, isPaymentCompleted } from '@/lib/payment/qpay';
import type {
    ShowProductImageArgs,
    SuggestRelatedProductsArgs,
    CheckPaymentArgs,
    LogComplaintArgs,
} from '../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../services/ToolExecutor';

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

            const imageUrl = (product && product.images && product.images.length > 0)
                ? product.images[0]
                : (product && product.image_url);

            if (product) {
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
        error: 'Зурагтай бүтээгдэхүүн олдсонгүй.'
    };
}

export async function executeSuggestRelatedProducts(
    args: SuggestRelatedProductsArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { current_product_name, suggestion_type = 'complementary' } = args;

    try {
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

        const currentPrice = currentProduct.discount_percent
            ? Math.round(currentProduct.price * (1 - currentProduct.discount_percent / 100))
            : currentProduct.price;

        // Only consider in-stock products (excluding current)
        const availableProducts = (context.products || []).filter(p =>
            p.id !== currentProduct.id && (p.stock - (p.reserved_stock || 0)) > 0
        );

        let suggestions: typeof context.products = [];

        if (suggestion_type === 'similar') {
            // Similar: same type, ±30% price range, prefer same category
            const priceMin = currentPrice * 0.7;
            const priceMax = currentPrice * 1.3;
            suggestions = availableProducts
                .filter(p => p.type === currentProduct.type)
                .map(p => {
                    const pPrice = p.discount_percent ? p.price * (1 - p.discount_percent / 100) : p.price;
                    const priceScore = (pPrice >= priceMin && pPrice <= priceMax) ? 10 : 0;
                    const stockScore = Math.min(p.stock, 10); // prefer items with good stock
                    const discountScore = p.discount_percent ? 5 : 0;
                    return { product: p, score: priceScore + stockScore + discountScore };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(s => s.product);

        } else if (suggestion_type === 'bundle') {
            // Bundle: cheaper items that complement (different type, <70% of current price)
            suggestions = availableProducts
                .filter(p => {
                    const pPrice = p.discount_percent ? p.price * (1 - p.discount_percent / 100) : p.price;
                    return pPrice < currentPrice * 0.7 && p.type !== currentProduct.type;
                })
                .sort((a, b) => {
                    // Prioritize discounted items for bundles
                    const aDiscount = a.discount_percent || 0;
                    const bDiscount = b.discount_percent || 0;
                    return bDiscount - aDiscount;
                })
                .slice(0, 2);

            // If no cross-type bundles, try same type but cheaper
            if (suggestions.length === 0) {
                suggestions = availableProducts
                    .filter(p => {
                        const pPrice = p.discount_percent ? p.price * (1 - p.discount_percent / 100) : p.price;
                        return pPrice < currentPrice * 0.7;
                    })
                    .slice(0, 2);
            }

        } else {
            // Complementary: different type, similar price range (±50%)
            const priceMin = currentPrice * 0.5;
            const priceMax = currentPrice * 1.5;
            suggestions = availableProducts
                .filter(p => p.type !== currentProduct.type)
                .map(p => {
                    const pPrice = p.discount_percent ? p.price * (1 - p.discount_percent / 100) : p.price;
                    const inRange = (pPrice >= priceMin && pPrice <= priceMax) ? 10 : 0;
                    const discountBonus = p.discount_percent ? 5 : 0;
                    return { product: p, score: inRange + discountBonus };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(s => s.product);

            // Fallback: any available product
            if (suggestions.length === 0) {
                suggestions = availableProducts.slice(0, 3);
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
                original_price: p.discount_percent ? p.price : undefined,
                available: p.stock - (p.reserved_stock || 0),
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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Suggest related products error:', { error: errorMessage });
        return { success: false, error: 'Санал болгох бараа хайхад алдаа гарлаа' };
    }
}

export async function executeCheckPaymentStatus(
    args: CheckPaymentArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    let query = supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
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
    const verifiedOrderIds: string[] = [];
    let qpayErrors = 0;

    for (const order of orders) {
        const { data: payment } = await supabase
            .from('payments')
            .select('qpay_invoice_id, id')
            .eq('order_id', order.id)
            .eq('status', 'pending')
            .single();

        if (payment && payment.qpay_invoice_id) {
            try {
                const checkResult = await checkPaymentStatus(payment.qpay_invoice_id);
                if (isPaymentCompleted(checkResult)) {
                    await supabase
                        .from('payments')
                        .update({
                            status: 'paid',
                            paid_at: new Date().toISOString(),
                            qpay_transaction_id: checkResult.rows?.[0]?.payment_id || null,
                        })
                        .eq('id', payment.id);

                    // Update order status directly
                    await supabase
                        .from('orders')
                        .update({
                            status: 'confirmed',
                            payment_status: 'paid',
                            payment_method: 'qpay',
                            paid_at: new Date().toISOString(),
                        })
                        .eq('id', order.id);

                    // Stock deduction is handled by deductStockForOrder in the webhook handler
                    // Do NOT duplicate stock deduction here to avoid double-counting
                    try {
                        const { deductStockForOrder } = await import('@/lib/services/StockService');
                        await deductStockForOrder(order.id);
                    } catch (stockErr) {
                        logger.warn(`Stock deduction failed for order ${order.id}, may already be handled:`, { error: String(stockErr) });
                    }

                    verifiedOrderIds.push(order.id);
                    verifiedCount++;
                }
            } catch (err: unknown) {
                logger.warn(`QPay check failed for order ${order.id}:`, { error: (err instanceof Error ? err.message : String(err)) });
                qpayErrors++;
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

    if (qpayErrors > 0) {
        return {
            success: true,
            message: 'QPay-аас төлбөр шалгаж чадсангүй. Түр хүлээгээд дахин оролдоно уу.',
            data: { paid: false, qpay_error: true }
        };
    }

    return {
        success: true,
        message: 'Төлбөр хараахан орж ирээгүй байна. Түр хүлээгээд дахин шалгана уу.',
        data: { paid: false }
    };
}

export async function executeLogComplaint(
    args: LogComplaintArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const supabase = supabaseAdmin();

    try {
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

        // Severity-based notification
        const severityIcon: Record<string, string> = {
            low: '🟡',
            medium: '🟠',
            high: '🔴',
            critical: '🚨',
        };
        const icon = severityIcon[args.severity || 'medium'] || '⚠️';
        const customerLabel = context.customerName ? ` (${context.customerName})` : '';

        if (context.notifySettings?.complaints !== false) {
            await sendPushNotification(context.shopId, {
                title: `${icon} Үйлчлүүлэгчийн гомдол${customerLabel}`,
                body: `${args.complaint_type}: ${args.description}`,
                url: '/dashboard/complaints',
                tag: `complaint-${context.customerId || 'anon'}`,
                actions: [
                    { action: 'view', title: 'Харах' },
                ],
            });
        }

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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Log complaint error:', { error: errorMessage });
        return { success: false, error: 'Гомдол бүртгэхэд алдаа гарлаа' };
    }
}
