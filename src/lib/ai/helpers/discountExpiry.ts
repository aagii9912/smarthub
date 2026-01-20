/**
 * Discount Expiry - Time-limited offers and discount management
 * Handles discount schedules, expiry notifications, and urgency messaging
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { AIProduct } from '@/types/ai';

/**
 * Discount schedule configuration
 */
export interface DiscountSchedule {
    id: string;
    productId: string;
    discountPercent: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    createdAt: Date;
}

/**
 * Discount status
 */
export type DiscountStatus = 'scheduled' | 'active' | 'expiring_soon' | 'expired';

/**
 * Product with discount info
 */
export interface ProductWithDiscount extends AIProduct {
    discountStatus?: DiscountStatus;
    discountEndsAt?: Date;
    hoursRemaining?: number;
    originalPrice?: number;
    discountedPrice?: number;
}

/**
 * Get discount status for a product
 */
export function getDiscountStatus(
    startDate: Date | null,
    endDate: Date | null
): DiscountStatus {
    const now = new Date();

    if (!startDate || !endDate) {
        return 'expired';
    }

    if (now < startDate) {
        return 'scheduled';
    }

    if (now > endDate) {
        return 'expired';
    }

    // Check if expiring within 24 hours
    const hoursUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilExpiry <= 24) {
        return 'expiring_soon';
    }

    return 'active';
}

/**
 * Calculate hours remaining until discount expires
 */
export function getHoursRemaining(endDate: Date | null): number | null {
    if (!endDate) return null;

    const now = new Date();
    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) return 0;

    return Math.ceil(diff / (1000 * 60 * 60));
}

/**
 * Enrich products with discount information
 */
export function enrichProductsWithDiscounts(
    products: AIProduct[],
    discountSchedules: DiscountSchedule[]
): ProductWithDiscount[] {
    const scheduleMap = new Map<string, DiscountSchedule>();

    for (const schedule of discountSchedules) {
        if (schedule.isActive) {
            scheduleMap.set(schedule.productId, schedule);
        }
    }

    return products.map(product => {
        const schedule = scheduleMap.get(product.id);
        const enriched: ProductWithDiscount = { ...product };

        if (schedule) {
            const status = getDiscountStatus(schedule.startDate, schedule.endDate);

            if (status === 'active' || status === 'expiring_soon') {
                enriched.discountStatus = status;
                enriched.discountEndsAt = schedule.endDate;
                enriched.hoursRemaining = getHoursRemaining(schedule.endDate) ?? undefined;
                enriched.originalPrice = product.price;
                enriched.discount_percent = schedule.discountPercent;
                enriched.discountedPrice = Math.round(
                    product.price * (1 - schedule.discountPercent / 100)
                );
            }
        } else if (product.discount_percent && product.discount_percent > 0) {
            // Product has permanent discount
            enriched.discountStatus = 'active';
            enriched.originalPrice = product.price;
            enriched.discountedPrice = Math.round(
                product.price * (1 - product.discount_percent / 100)
            );
        }

        return enriched;
    });
}

/**
 * Generate urgency message for expiring discount
 */
export function generateUrgencyMessage(
    product: ProductWithDiscount,
    language: 'mn' | 'en' | 'ru' = 'mn'
): string | null {
    if (product.discountStatus !== 'expiring_soon' || !product.hoursRemaining) {
        return null;
    }

    const hours = product.hoursRemaining;
    const percent = product.discount_percent || 0;

    const messages = {
        mn: hours <= 1
            ? `⏰ ЯАРАЛТАЙ! ${product.name}-ийн ${percent}% хямдрал 1 цагийн дотор дуусна!`
            : hours <= 6
                ? `🔥 ${product.name}-ийн хямдрал ${hours} цагийн дараа дуусна! Яг одоо авах цаг!`
                : `⚡ ${product.name}-ийн ${percent}% хямдрал ${hours} цаг үлдлээ!`,
        en: hours <= 1
            ? `⏰ URGENT! ${percent}% off ${product.name} ends in 1 hour!`
            : hours <= 6
                ? `🔥 ${product.name} sale ends in ${hours} hours! Act now!`
                : `⚡ ${percent}% off ${product.name} - only ${hours} hours left!`,
        ru: hours <= 1
            ? `⏰ СРОЧНО! Скидка ${percent}% на ${product.name} закончится через час!`
            : hours <= 6
                ? `🔥 Скидка на ${product.name} заканчивается через ${hours} часов! Действуйте!`
                : `⚡ ${percent}% скидка на ${product.name} - осталось ${hours} часов!`
    };

    return messages[language];
}

/**
 * Get products with expiring discounts (for proactive selling)
 */
export function getExpiringDiscounts(
    products: ProductWithDiscount[],
    withinHours: number = 24
): ProductWithDiscount[] {
    return products.filter(p =>
        p.discountStatus === 'expiring_soon' &&
        p.hoursRemaining !== undefined &&
        p.hoursRemaining <= withinHours
    );
}

/**
 * Create discount schedule in database
 */
export async function createDiscountSchedule(
    productId: string,
    discountPercent: number,
    startDate: Date,
    endDate: Date
): Promise<string | null> {
    try {
        const supabase = supabaseAdmin();

        // Deactivate any existing schedules for this product
        await supabase
            .from('discount_schedules')
            .update({ is_active: false })
            .eq('product_id', productId);

        // Create new schedule
        const { data, error } = await supabase
            .from('discount_schedules')
            .insert({
                product_id: productId,
                discount_percent: discountPercent,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                is_active: true,
                created_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to create discount schedule:', { error });
            return null;
        }

        return data.id;
    } catch (error) {
        logger.error('Error creating discount schedule:', { error });
        return null;
    }
}

/**
 * Get active discount schedules for a shop
 */
export async function getActiveDiscountSchedules(
    shopId: string
): Promise<DiscountSchedule[]> {
    try {
        const supabase = supabaseAdmin();
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('discount_schedules')
            .select(`
                id,
                product_id,
                discount_percent,
                start_date,
                end_date,
                is_active,
                created_at,
                products!inner (shop_id)
            `)
            .eq('is_active', true)
            .eq('products.shop_id', shopId)
            .lte('start_date', now)
            .gte('end_date', now);

        if (error) {
            logger.error('Failed to fetch discount schedules:', { error });
            return [];
        }

        return (data || []).map(d => ({
            id: d.id,
            productId: d.product_id,
            discountPercent: d.discount_percent,
            startDate: new Date(d.start_date),
            endDate: new Date(d.end_date),
            isActive: d.is_active,
            createdAt: new Date(d.created_at)
        }));
    } catch (error) {
        logger.error('Error fetching discount schedules:', { error });
        return [];
    }
}

/**
 * Deactivate expired discount schedules (for cron job)
 */
export async function deactivateExpiredDiscounts(): Promise<number> {
    try {
        const supabase = supabaseAdmin();
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('discount_schedules')
            .update({ is_active: false })
            .eq('is_active', true)
            .lt('end_date', now)
            .select('id');

        if (error) {
            logger.error('Failed to deactivate expired discounts:', { error });
            return 0;
        }

        const count = data?.length || 0;
        if (count > 0) {
            logger.info(`Deactivated ${count} expired discount schedules`);
        }

        return count;
    } catch (error) {
        logger.error('Error deactivating expired discounts:', { error });
        return 0;
    }
}

/**
 * Format discount info for AI prompt
 */
export function formatDiscountForPrompt(product: ProductWithDiscount): string {
    if (!product.discount_percent || product.discount_percent <= 0) {
        return `${product.name}: ${product.price.toLocaleString()}₮`;
    }

    const discountedPrice = product.discountedPrice ||
        Math.round(product.price * (1 - product.discount_percent / 100));

    let info = `${product.name}: 🔥${discountedPrice.toLocaleString()}₮ `;
    info += `(-${product.discount_percent}% ХЯМДРАЛ! Жинхэнэ: ${product.price.toLocaleString()}₮)`;

    if (product.discountStatus === 'expiring_soon' && product.hoursRemaining) {
        info += ` ⏰ ${product.hoursRemaining}ц үлдлээ!`;
    }

    return info;
}
