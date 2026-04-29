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
    // Lifecycle (#8/#9/#10) — added in migration 20260428220000
    status?: 'draft' | 'active' | 'pre_order' | 'coming_soon' | 'discontinued' | null;
    available_from?: string | null;
    pre_order_eta?: string | null;
    // Per-product AI training (#2)
    ai_instructions?: string | null;
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
            // Lifecycle (#8/#9/#10).
            status: p.status ?? undefined,
            available_from: p.available_from ?? null,
            pre_order_eta: p.pre_order_eta ?? null,
            // Per-product AI training (#2)
            ai_instructions: p.ai_instructions ?? null,
        };
    });
}

export interface ShopWithProducts {
    id: string;
    user_id?: string | null;
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

function mapShopRowToShopWithProducts(data: Record<string, unknown>): ShopWithProducts {
    const get = <T>(key: string): T => data[key] as T;
    return {
        id: get<string>('id'),
        user_id: get<string | null>('user_id'),
        name: get<string>('name'),
        description: get<string | null>('description'),
        ai_instructions: get<string | null>('ai_instructions'),
        ai_emotion: get<ShopWithProducts['ai_emotion']>('ai_emotion'),
        facebook_page_id: get<string>('facebook_page_id'),
        facebook_page_username: get<string | null>('facebook_page_username'),
        facebook_page_access_token: get<string | null>('facebook_page_access_token'),
        instagram_business_account_id: get<string | null>('instagram_business_account_id'),
        instagram_access_token: get<string | null>('instagram_access_token'),
        instagram_username: get<string | null>('instagram_username'),
        products: mapShopProductsToAI(get<Parameters<typeof mapShopProductsToAI>[0]>('products')),
        notify_on_order: get<boolean | null>('notify_on_order'),
        notify_on_contact: get<boolean | null>('notify_on_contact'),
        notify_on_support: get<boolean | null>('notify_on_support'),
        notify_on_cancel: get<boolean | null>('notify_on_cancel'),
        notify_on_complaints: get<boolean | null>('notify_on_complaints'),
        is_ai_active: get<boolean | null>('is_ai_active'),
        subscription_plan: get<string | null>('subscription_plan'),
        subscription_status: get<string | null>('subscription_status'),
        trial_ends_at: get<string | null>('trial_ends_at'),
        custom_knowledge: get<Record<string, unknown> | null>('custom_knowledge'),
        token_usage_total: get<number | undefined>('token_usage_total') || 0,
        token_usage_reset_at: get<string | null>('token_usage_reset_at'),
    };
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

    return mapShopRowToShopWithProducts(data as Record<string, unknown>);
}

export async function getShopByInstagramId(instagramId: string): Promise<ShopWithProducts | null> {
    const supabase = supabaseAdmin();

    // .maybeSingle() so legacy duplicate IG rows don't crash the webhook before
    // the UNIQUE constraint migration runs. The constraint will prevent new
    // duplicates; this guard keeps existing data routable.
    const { data, error } = await supabase
        .from('shops')
        .select('*, products(*)')
        .eq('instagram_business_account_id', instagramId)
        .eq('is_active', true)
        .eq('products.is_active', true)
        .maybeSingle();

    if (error) {
        // PGRST116 = "More than one row was returned" (only thrown by .single()/maybeSingle()
        // when multiple match). Log explicitly so misrouted webhooks are debuggable.
        // We choose deterministic ordering as a fallback so traffic doesn't drop.
        if ((error as { code?: string }).code === 'PGRST116') {
            const { data: rows } = await supabase
                .from('shops')
                .select('*, products(*)')
                .eq('instagram_business_account_id', instagramId)
                .eq('is_active', true)
                .eq('products.is_active', true)
                .order('updated_at', { ascending: false })
                .limit(1);
            if (rows && rows.length > 0) {
                return mapShopRowToShopWithProducts(rows[0] as Record<string, unknown>);
            }
        }
        return null;
    }
    if (!data) return null;

    return mapShopRowToShopWithProducts(data as Record<string, unknown>);
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
    const s = shop as ShopWithProducts & {
        notify_on_payment_received?: boolean | null;
        notify_on_payment_failed?: boolean | null;
        notify_on_refund?: boolean | null;
        notify_on_new_customer?: boolean | null;
        notify_on_subscription?: boolean | null;
        notify_on_automation?: boolean | null;
        notify_on_plan_limit?: boolean | null;
        notify_on_low_stock?: boolean | null;
        notify_on_import?: boolean | null;
    };
    return {
        order: shop.notify_on_order ?? true,
        contact: shop.notify_on_contact ?? true,
        support: shop.notify_on_support ?? true,
        cancel: shop.notify_on_cancel ?? true,
        complaints: shop.notify_on_complaints ?? true,
        payment_received: s.notify_on_payment_received ?? true,
        payment_failed: s.notify_on_payment_failed ?? true,
        refund: s.notify_on_refund ?? true,
        new_customer: s.notify_on_new_customer ?? true,
        subscription: s.notify_on_subscription ?? true,
        automation: s.notify_on_automation ?? true,
        plan_limit: s.notify_on_plan_limit ?? true,
        low_stock: s.notify_on_low_stock ?? true,
        import: s.notify_on_import ?? true,
    };
}
