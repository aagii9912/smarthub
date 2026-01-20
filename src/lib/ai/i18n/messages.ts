/**
 * AI i18n Messages - Standardized error messages and responses
 * Supports Mongolian (mn), English (en), and Russian (ru)
 */

export type SupportedLanguage = 'mn' | 'en' | 'ru';

/**
 * Message keys for AI system
 */
export type MessageKey =
    // Errors
    | 'error.no_customer_context'
    | 'error.no_shop_context'
    | 'error.product_not_found'
    | 'error.insufficient_stock'
    | 'error.cart_empty'
    | 'error.order_not_found'
    | 'error.checkout_failed'
    | 'error.payment_failed'
    | 'error.system_error'
    | 'error.validation_failed'
    // Success messages
    | 'success.contact_saved'
    | 'success.order_created'
    | 'success.order_cancelled'
    | 'success.cart_updated'
    | 'success.item_added'
    | 'success.item_removed'
    | 'success.checkout_complete'
    | 'success.preference_saved'
    | 'success.support_requested'
    // Cart messages
    | 'cart.empty'
    | 'cart.low_stock_warning'
    | 'cart.free_shipping_achieved'
    | 'cart.free_shipping_remaining'
    // Sales messages
    | 'sales.discount_available'
    | 'sales.limited_stock'
    | 'sales.upsell_suggestion'
    | 'sales.hesitation_detected';

/**
 * Message translations
 */
const messages: Record<SupportedLanguage, Record<MessageKey, string>> = {
    mn: {
        // Errors
        'error.no_customer_context': 'Хэрэглэгчийн мэдээлэл олдсонгүй',
        'error.no_shop_context': 'Дэлгүүрийн мэдээлэл олдсонгүй',
        'error.product_not_found': '"{product}" бүтээгдэхүүн олдсонгүй',
        'error.insufficient_stock': 'Үлдэгдэл хүрэлцэхгүй байна. Боломжит: {available} ширхэг',
        'error.cart_empty': 'Сагс хоосон байна',
        'error.order_not_found': 'Захиалга олдсонгүй',
        'error.checkout_failed': 'Захиалга үүсгэхэд алдаа гарлаа',
        'error.payment_failed': 'Төлбөр боловсруулахад алдаа гарлаа',
        'error.system_error': 'Системийн алдаа гарлаа. Дахин оролдоно уу.',
        'error.validation_failed': 'Буруу мэдээлэл оруулсан байна',
        // Success
        'success.contact_saved': 'Холбоо барих мэдээлэл хадгалагдлаа',
        'success.order_created': 'Захиалга #{orderId} амжилттай үүслээ! Нийт: {total}₮',
        'success.order_cancelled': 'Захиалга #{orderId} цуцлагдлаа',
        'success.cart_updated': 'Сагс шинэчлэгдлээ',
        'success.item_added': '{product} ({quantity}ш) сагсанд нэмэгдлээ! Нийт: {total}₮',
        'success.item_removed': '{product} сагснаас хасагдлаа',
        'success.checkout_complete': 'Захиалга амжилттай үүслээ!',
        'success.preference_saved': 'Санах ойд хадгаллаа: {key} = {value}',
        'success.support_requested': 'Холбогдох хүсэлт илгээгдлээ. Удахгүй холбогдоно.',
        // Cart
        'cart.empty': 'Таны сагс хоосон байна',
        'cart.low_stock_warning': '⚠️ Зөвхөн {stock} ширхэг үлдлээ!',
        'cart.free_shipping_achieved': '✅ Хүргэлт үнэгүй болох нөхцөл хангасан',
        'cart.free_shipping_remaining': 'ℹ️ {amount}₮ нэмбэл хүргэлт үнэгүй',
        // Sales
        'sales.discount_available': '🔥 Хямдрал! {original}₮ биш {discounted}₮ (-{percent}%)',
        'sales.limited_stock': '⏰ Зөвхөн {stock} ширхэг үлдлээ! Яарах хэрэгтэй.',
        'sales.upsell_suggestion': 'Энэ бараатай тохирох {product} бий, нэмэх үү?',
        'sales.hesitation_detected': 'Ямар зүйл эргэлзүүлж байна вэ? 🤔'
    },
    en: {
        // Errors
        'error.no_customer_context': 'Customer information not found',
        'error.no_shop_context': 'Shop information not found',
        'error.product_not_found': 'Product "{product}" not found',
        'error.insufficient_stock': 'Insufficient stock. Available: {available} items',
        'error.cart_empty': 'Your cart is empty',
        'error.order_not_found': 'Order not found',
        'error.checkout_failed': 'Failed to create order',
        'error.payment_failed': 'Failed to process payment',
        'error.system_error': 'System error occurred. Please try again.',
        'error.validation_failed': 'Invalid input provided',
        // Success
        'success.contact_saved': 'Contact information saved',
        'success.order_created': 'Order #{orderId} created successfully! Total: {total}₮',
        'success.order_cancelled': 'Order #{orderId} has been cancelled',
        'success.cart_updated': 'Cart updated',
        'success.item_added': '{product} ({quantity}pcs) added to cart! Total: {total}₮',
        'success.item_removed': '{product} removed from cart',
        'success.checkout_complete': 'Order created successfully!',
        'success.preference_saved': 'Remembered: {key} = {value}',
        'success.support_requested': 'Support request sent. We will contact you shortly.',
        // Cart
        'cart.empty': 'Your cart is empty',
        'cart.low_stock_warning': '⚠️ Only {stock} left in stock!',
        'cart.free_shipping_achieved': '✅ Free shipping unlocked!',
        'cart.free_shipping_remaining': 'ℹ️ Add {amount}₮ more for free shipping',
        // Sales
        'sales.discount_available': '🔥 Sale! Was {original}₮, now {discounted}₮ (-{percent}%)',
        'sales.limited_stock': '⏰ Only {stock} left! Act fast.',
        'sales.upsell_suggestion': 'This goes great with {product}, add it?',
        'sales.hesitation_detected': 'What concerns do you have? 🤔'
    },
    ru: {
        // Errors
        'error.no_customer_context': 'Информация о клиенте не найдена',
        'error.no_shop_context': 'Информация о магазине не найдена',
        'error.product_not_found': 'Товар "{product}" не найден',
        'error.insufficient_stock': 'Недостаточно на складе. Доступно: {available} шт.',
        'error.cart_empty': 'Ваша корзина пуста',
        'error.order_not_found': 'Заказ не найден',
        'error.checkout_failed': 'Не удалось создать заказ',
        'error.payment_failed': 'Ошибка обработки платежа',
        'error.system_error': 'Системная ошибка. Попробуйте снова.',
        'error.validation_failed': 'Неверные данные',
        // Success
        'success.contact_saved': 'Контактная информация сохранена',
        'success.order_created': 'Заказ #{orderId} успешно создан! Итого: {total}₮',
        'success.order_cancelled': 'Заказ #{orderId} отменён',
        'success.cart_updated': 'Корзина обновлена',
        'success.item_added': '{product} ({quantity}шт.) добавлен в корзину! Итого: {total}₮',
        'success.item_removed': '{product} удалён из корзины',
        'success.checkout_complete': 'Заказ успешно создан!',
        'success.preference_saved': 'Запомнил: {key} = {value}',
        'success.support_requested': 'Запрос отправлен. Мы скоро свяжемся с вами.',
        // Cart
        'cart.empty': 'Ваша корзина пуста',
        'cart.low_stock_warning': '⚠️ Осталось только {stock} шт.!',
        'cart.free_shipping_achieved': '✅ Бесплатная доставка!',
        'cart.free_shipping_remaining': 'ℹ️ Добавьте ещё на {amount}₮ для бесплатной доставки',
        // Sales
        'sales.discount_available': '🔥 Скидка! Было {original}₮, теперь {discounted}₮ (-{percent}%)',
        'sales.limited_stock': '⏰ Осталось только {stock} шт.! Спешите.',
        'sales.upsell_suggestion': 'К этому товару отлично подойдёт {product}, добавить?',
        'sales.hesitation_detected': 'Что вас смущает? 🤔'
    }
};

/**
 * Get translated message with parameter substitution
 */
export function t(
    key: MessageKey,
    lang: SupportedLanguage = 'mn',
    params?: Record<string, string | number>
): string {
    let message = messages[lang]?.[key] || messages['mn'][key] || key;

    if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
            message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
        });
    }

    return message;
}

/**
 * Get all messages for a language (for prompt building)
 */
export function getMessagesForLanguage(lang: SupportedLanguage): Record<MessageKey, string> {
    return messages[lang] || messages['mn'];
}

/**
 * Detect language from text (simple heuristic)
 */
export function detectLanguage(text: string): SupportedLanguage {
    // Cyrillic characters check (Mongolian or Russian)
    const cyrillicCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
    const mongolianSpecific = (text.match(/[өүӨҮ]/g) || []).length;

    if (mongolianSpecific > 0) return 'mn';
    if (cyrillicCount > text.length * 0.3) return 'ru';
    return 'en';
}

/**
 * AI-specific message builder
 */
export class AIMessageBuilder {
    private lang: SupportedLanguage;

    constructor(lang: SupportedLanguage = 'mn') {
        this.lang = lang;
    }

    setLanguage(lang: SupportedLanguage): void {
        this.lang = lang;
    }

    error(key: MessageKey, params?: Record<string, string | number>): string {
        return t(key, this.lang, params);
    }

    success(key: MessageKey, params?: Record<string, string | number>): string {
        return t(key, this.lang, params);
    }

    // Convenience methods
    productNotFound(product: string): string {
        return this.error('error.product_not_found', { product });
    }

    insufficientStock(available: number): string {
        return this.error('error.insufficient_stock', { available });
    }

    itemAdded(product: string, quantity: number, total: number): string {
        return this.success('success.item_added', { product, quantity, total: total.toLocaleString() });
    }

    orderCreated(orderId: string, total: number): string {
        return this.success('success.order_created', { orderId, total: total.toLocaleString() });
    }

    lowStockWarning(stock: number): string {
        return t('cart.low_stock_warning', this.lang, { stock });
    }

    discountAvailable(original: number, discounted: number, percent: number): string {
        return t('sales.discount_available', this.lang, {
            original: original.toLocaleString(),
            discounted: discounted.toLocaleString(),
            percent
        });
    }
}

// Default message builder instance
export const aiMessages = new AIMessageBuilder('mn');
