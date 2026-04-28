import { supabaseAdmin } from '@/lib/supabase';
import type { AIProduct, AIFAQ, AIQuickReply, AISlogan, NotifySettings } from '@/types/ai';

interface ShopProductRow {
    id: string;
    name: string;
    description?: string | null;
    price?: number | null;
    stock?: number | null;
    reserved_stock?: number | null;
    type?: string | null;
    unit?: string | null;
    image_url?: string | null;
    images?: string[] | null;
    discount_percent?: number | null;
    colors?: string[] | null;
    sizes?: string[] | null;
    delivery_type?: string | null;
    delivery_fee?: number | string | null;
    is_active?: boolean | null;
}

export function mapShopProductsToAI(products: ShopProductRow[] | null | undefined): AIProduct[] {
    if (!products) return [];
    return products.map(p => {
        const aiType: AIProduct['type'] =
            p.type === 'service' ? 'service'
                : p.type === 'appointment' ? 'appointment'
                    : 'product';

        const deliveryType: AIProduct['delivery_type'] =
            p.delivery_type === 'included' || p.delivery_type === 'paid' || p.delivery_type === 'pickup_only'
                ? p.delivery_type
                : undefined;

        return {
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            price: p.price || 0,
            stock: p.stock ?? 0,
            reserved_stock: p.reserved_stock ?? 0,
            type: aiType,
            unit: p.unit || undefined,
            image_url: p.image_url || undefined,
            images: p.images || undefined,
            discount_percent: p.discount_percent ?? undefined,
            colors: p.colors && p.colors.length > 0 ? p.colors : undefined,
            sizes: p.sizes && p.sizes.length > 0 ? p.sizes : undefined,
            delivery_type: deliveryType,
            delivery_fee: p.delivery_fee ? Number(p.delivery_fee) : undefined,
            variants: undefined,
        };
    });
}

export interface ShopWithProducts {
    id: string;
    name: string;
    description?: string | null;
    ai_instructions?: string | null;
    ai_emotion?: 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful' | null;
    facebook_page_id: string;
    facebook_page_username?: string | null;
    facebook_page_access_token?: string | null;
    instagram_business_account_id?: string | null;
    instagram_access_token?: string | null;
    instagram_username?: string | null;
    products: AIProduct[];
    notify_on_order?: boolean | null;
    notify_on_contact?: boolean | null;
    notify_on_support?: boolean | null;
    notify_on_cancel?: boolean | null;
    notify_on_complaints?: boolean | null;
    is_ai_active?: boolean | null;
    subscription_plan?: string | null;
    subscription_status?: string | null;
    trial_ends_at?: string | null;
    custom_knowledge?: Record<string, unknown> | null;
    // Token billing
    token_usage_total?: number;
    token_usage_reset_at?: string | null;
}

export interface AIFeatures {
    faqs: AIFAQ[];
    quickReplies: AIQuickReply[];
    slogans: AISlogan[];
}

export async function getShopByPageId(pageId: string): Promise<ShopWithProducts | null> {
    const supabase = supabaseAdmin();

    const { data } = await supabase
        .from('shops')
        .select('*, products(*)')
        .eq('facebook_page_id', pageId)
        .eq('is_active', true)
        .eq('products.is_active', true)
        .single();

    if (!data) return null;

    return {
        id: data.id,
        name: data.name,
        description: data.description,
        ai_instructions: data.ai_instructions,
        ai_emotion: data.ai_emotion,
        facebook_page_id: data.facebook_page_id,
        facebook_page_username: data.facebook_page_username,
        facebook_page_access_token: data.facebook_page_access_token,
        products: mapShopProductsToAI(data.products),
        notify_on_order: data.notify_on_order,
        notify_on_contact: data.notify_on_contact,
        notify_on_support: data.notify_on_support,
        notify_on_cancel: data.notify_on_cancel,
        is_ai_active: data.is_ai_active,
        subscription_plan: data.subscription_plan,
        subscription_status: data.subscription_status,
        trial_ends_at: data.trial_ends_at,
        custom_knowledge: data.custom_knowledge,
        instagram_business_account_id: data.instagram_business_account_id,
        instagram_access_token: data.instagram_access_token,
        instagram_username: data.instagram_username,
        token_usage_total: data.token_usage_total || 0,
        token_usage_reset_at: data.token_usage_reset_at,
    };
}

export async function getShopByInstagramId(instagramId: string): Promise<ShopWithProducts | null> {
    const supabase = supabaseAdmin();

    const { data } = await supabase
        .from('shops')
        .select('*, products(*)')
        .eq('instagram_business_account_id', instagramId)
        .eq('is_active', true)
        .eq('products.is_active', true)
        .single();

    if (!data) return null;

    return {
        id: data.id,
        name: data.name,
        description: data.description,
        ai_instructions: data.ai_instructions,
        ai_emotion: data.ai_emotion,
        facebook_page_id: data.facebook_page_id,
        facebook_page_username: data.facebook_page_username,
        facebook_page_access_token: data.facebook_page_access_token,
        instagram_business_account_id: data.instagram_business_account_id,
        instagram_access_token: data.instagram_access_token,
        instagram_username: data.instagram_username,
        products: mapShopProductsToAI(data.products),
        notify_on_order: data.notify_on_order,
        notify_on_contact: data.notify_on_contact,
        notify_on_support: data.notify_on_support,
        notify_on_cancel: data.notify_on_cancel,
        is_ai_active: data.is_ai_active,
        subscription_plan: data.subscription_plan,
        subscription_status: data.subscription_status,
        trial_ends_at: data.trial_ends_at,
        custom_knowledge: data.custom_knowledge,
        token_usage_total: data.token_usage_total || 0,
        token_usage_reset_at: data.token_usage_reset_at,
    };
}

export async function getAIFeatures(shopId: string): Promise<AIFeatures> {
    const supabase = supabaseAdmin();

    const [faqRes, qrRes, sloganRes] = await Promise.all([
        supabase.from('shop_faqs').select('question, answer').eq('shop_id', shopId).eq('is_active', true),
        supabase.from('shop_quick_replies').select('trigger_words, response, is_exact_match').eq('shop_id', shopId).eq('is_active', true),
        supabase.from('shop_slogans').select('slogan, usage_context').eq('shop_id', shopId).eq('is_active', true)
    ]);

    return {
        faqs: (faqRes.data || []) as AIFAQ[],
        quickReplies: (qrRes.data || []) as AIQuickReply[],
        slogans: (sloganRes.data || []) as AISlogan[],
    };
}

export function buildNotifySettings(shop: ShopWithProducts): NotifySettings {
    return {
        order: shop.notify_on_order ?? true,
        contact: shop.notify_on_contact ?? true,
        support: shop.notify_on_support ?? true,
        cancel: shop.notify_on_cancel ?? true,
        complaints: shop.notify_on_complaints ?? true,
    };
}
