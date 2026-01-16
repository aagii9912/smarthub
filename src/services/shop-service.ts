import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export interface ShopData {
    id: string;
    name: string;
    description: string | null;
    facebook_page_id: string;
    facebook_page_access_token: string | null;
    facebook_page_username: string | null;
    ai_instructions: string | null;
    ai_emotion: 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';
    products: any[];
    notify_on_order: boolean;
    notify_on_contact: boolean;
    notify_on_support: boolean;
    notify_on_cancel: boolean;
}

export interface CustomerData {
    id: string;
    shop_id: string;
    facebook_id: string;
    name: string | null;
    phone: string | null;
    total_orders: number;
}

export async function getShopByPageId(pageId: string): Promise<ShopData | null> {
    const supabase = supabaseAdmin();
    const { data: shop } = await supabase
        .from('shops')
        .select('*, products(*)')
        .eq('facebook_page_id', pageId)
        .eq('is_active', true)
        .single();

    if (!shop) {
        logger.warn(`No active shop found for page ${pageId}`);
        return null;
    }
    return shop;
}

export async function getShopAIFeatures(shopId: string) {
    const supabase = supabaseAdmin();
    const [faqRes, qrRes, sloganRes] = await Promise.all([
        supabase.from('shop_faqs').select('question, answer').eq('shop_id', shopId).eq('is_active', true),
        supabase.from('shop_quick_replies').select('trigger_words, response, is_exact_match').eq('shop_id', shopId).eq('is_active', true),
        supabase.from('shop_slogans').select('slogan, usage_context').eq('shop_id', shopId).eq('is_active', true)
    ]);

    return {
        faqs: faqRes.data || [],
        quickReplies: qrRes.data || [],
        slogans: sloganRes.data || []
    };
}

export async function getOrCreateCustomer(
    shopId: string,
    facebookId: string,
    pageAccessToken: string
): Promise<CustomerData | null> {
    const supabase = supabaseAdmin();

    // Check existing customer
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('facebook_id', facebookId)
        .eq('shop_id', shopId)
        .single();

    if (existingCustomer) {
        let customer = existingCustomer;
         // Update name from Facebook if still null
         if (!customer.name) {
            try {
                const profileResponse = await fetch(
                    `https://graph.facebook.com/${facebookId}?fields=first_name,last_name,name&access_token=${pageAccessToken}`
                );
                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    const userName = profileData.name || profileData.first_name || null;
                    if (userName) {
                        await supabase
                            .from('customers')
                            .update({ name: userName })
                            .eq('id', customer.id);
                        customer.name = userName;
                        logger.info('Updated customer name from Facebook', { userName });
                    }
                }
            } catch (profileError) {
                // Ignore profile fetch errors
            }
        }
        return customer;
    }

    // Try to get user profile from Facebook
    let userName = null;
    try {
        const profileResponse = await fetch(
            `https://graph.facebook.com/${facebookId}?fields=first_name,last_name,name&access_token=${pageAccessToken}`
        );
        if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            userName = profileData.name || profileData.first_name || null;
            logger.info('Fetched Facebook profile', { userName, senderId: facebookId });
        }
    } catch (profileError) {
        logger.warn('Could not fetch Facebook profile', { senderId: facebookId });
    }

    const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
            shop_id: shopId,
            facebook_id: facebookId,
            name: userName,
        })
        .select()
        .single();

    return newCustomer;
}

export async function updateCustomerPhone(customerId: string, phone: string) {
    const supabase = supabaseAdmin();
    await supabase
        .from('customers')
        .update({ phone: phone })
        .eq('id', customerId);
}
