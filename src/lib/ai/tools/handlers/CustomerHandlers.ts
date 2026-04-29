/**
 * Customer Tool Handlers
 * Handles: collect_contact_info, request_human_support, remember_preference
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { saveCustomerPreference } from '../memory';
import type {
    CollectContactArgs,
    RequestHumanSupportArgs,
    RememberPreferenceArgs,
} from '../definitions';
import type { ToolExecutionResult, ToolExecutionContext } from '../../services/ToolExecutor';

export async function executeCollectContact(
    args: CollectContactArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { phone, address, name } = args;

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const supabase = supabaseAdmin();
    const updateData: Record<string, string> = {};

    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (name) updateData.name = name;

    if (Object.keys(updateData).length === 0) {
        return { success: true, message: 'No info to save' };
    }

    const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', context.customerId);

    if (error) {
        logger.error('Contact save error:', { error });
        return { success: false, error: error.message };
    }

    logger.info('Contact info saved to CRM:', { data: updateData });

    if (context.notifySettings?.contact !== false) {
        await sendPushNotification(context.shopId, {
            title: '📍 Хаяг мэдээлэл ирлээ',
            body: `${name || 'Хэрэглэгч'} мэдээллээ үлдээлээ: ${phone || ''} ${address || ''}`,
            url: `/dashboard/customers/${context.customerId}`,
            tag: `contact-${context.customerId}`
        });
    }

    // Build natural confirmation
    const savedParts = [];
    if (phone) savedParts.push(`📱 ${phone}`);
    if (address) savedParts.push(`📍 ${address}`);
    if (name) savedParts.push(`👤 ${name}`);

    return {
        success: true,
        // Phone is captured. AI must NOT improvise an apology or call
        // request_human_support — its next move is to register the order
        // (create_order) for the product the customer just agreed to buy.
        message: `Мэдээлэл хадгалагдлаа. Дараагийн алхам: create_order tool-ыг саяхан ярилцсан бараа дээр шууд дууд. Хэрэглэгчийн өгсөн утсыг "бизнесийн утас" мэт буруу бүү танилцуул.\n${savedParts.join('\n')}`,
        data: {
            phone: phone || null,
            address: address || null,
            // Explicit signal so the AI knows what tool to fire next.
            next_action: 'create_order',
            auto_checkout: true,
        },
    };
}

/**
 * Normalise a Mongolian-style phone number into E.164. Returns null when the
 * input doesn't look like a real phone — Meta will reject malformed
 * `phone_number` button payloads.
 */
function normalisePhoneE164(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return null;
    if (digits.startsWith('+')) {
        return /^\+\d{6,15}$/.test(digits) ? digits : null;
    }
    // Bare 8-digit Mongolian number → assume +976.
    if (/^\d{8}$/.test(digits)) return `+976${digits}`;
    // Already 11+ digits without `+` (e.g. country code typed without `+`).
    if (/^\d{10,15}$/.test(digits)) return `+${digits}`;
    return null;
}

export async function executeRequestSupport(
    args: RequestHumanSupportArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { reason } = args;
    const supabase = supabaseAdmin();

    // 1. Save support request to database for dashboard visibility
    try {
        await supabase.from('customer_complaints').insert({
            shop_id: context.shopId,
            customer_id: context.customerId || null,
            complaint_type: 'service',
            description: `[HUMAN SUPPORT REQUEST] ${reason || 'Хүн холбогдох хүсэлт'}`,
            severity: 'high',
            source: 'ai_tool',
        });
    } catch (dbError) {
        logger.warn('Failed to save support request to DB:', { error: dbError });
    }

    // 2. Send push notification to shop owner
    if (context.notifySettings?.support !== false) {
        await sendPushNotification(context.shopId, {
            title: '🔴 Хүн холбогдох хүсэлт!',
            body: `${context.customerName || 'Хэрэглэгч'}: ${reason || 'Тодорхойгүй шалтгаан'}`,
            url: `/dashboard/chat?customer=${context.customerId}`,
            tag: `support-${context.customerId}`,
            actions: [
                { action: 'view', title: 'Харах' },
                { action: 'reply', title: 'Хариулах' },
            ],
        });
    }

    // 3. Send email notification to shop owner (non-blocking)
    try {
        const { data: shop } = await supabase
            .from('shops')
            .select('user_id, name')
            .eq('id', context.shopId)
            .single();

        if (shop?.user_id) {
            // Try to get user email from auth
            const { data: { user } } = await supabase.auth.admin.getUserById(shop.user_id);
            if (user?.email) {
                // Dynamic import to avoid circular dependency
                const { sendSupportRequestEmail } = await import('@/lib/email/templates');
                await sendSupportRequestEmail({
                    to: user.email,
                    shopName: shop.name,
                    customerName: context.customerName || 'Тодорхойгүй',
                    reason: reason || 'Шалтгаан тодорхойгүй',
                    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://syncly.mn'}/dashboard/chat?customer=${context.customerId}`,
                }).catch((err: Error) => logger.warn('Support email failed:', { error: err.message }));
            }
        }
    } catch (emailError) {
        logger.warn('Failed to send support email:', { error: emailError });
    }

    logger.info('Human support request processed', {
        shopId: context.shopId,
        customerId: context.customerId,
        reason,
    });

    // 4. Optionally include a working "Залгах" button that uses Meta's
    //    native phone_number action. We need the shop's phone in E.164.
    let shopPhoneE164: string | null = null;
    try {
        const { data: shopRow } = await supabase
            .from('shops')
            .select('phone')
            .eq('id', context.shopId)
            .single();
        shopPhoneE164 = normalisePhoneE164(shopRow?.phone ?? null);
    } catch (phoneErr) {
        logger.warn('Failed to read shop phone for call button:', { error: phoneErr });
    }

    // Without a configured business phone we can't surface a Залгах button
    // and the AI tends to invent an apology that echoes the *customer's*
    // phone back as the contact number. Fail explicitly so the AI falls
    // back to creating the order itself.
    if (!shopPhoneE164) {
        return {
            success: false,
            error: 'Дэлгүүрийн утас тохируулагдаагүй. AI: request_human_support бүү дахин дууд. Харин create_order ашиглан захиалгыг шууд бүртгэ. Хэрэглэгчийн өгсөн утсыг бизнесийн холбоо барих утас гэж бүү танилцуул.',
        };
    }

    return {
        success: true,
        message: 'Дэлгүүрийн эзэнд мэдэгдэл илгээлээ. Тун удахгүй холбогдоно.',
        actions: [{
            type: 'support_actions',
            buttons: [{
                id: 'call_phone',
                label: '📞 Залгах',
                icon: 'phone',
                variant: 'secondary',
                // CALL: prefix is decoded by sendActionsAsButtons into a Meta
                // phone_number button so the customer can tap-to-call.
                payload: `CALL:${shopPhoneE164}`,
            }],
        }],
    };
}

export async function executeRememberPreference(
    args: RememberPreferenceArgs,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    const { key, value } = args;

    if (!context.customerId) {
        return { success: false, error: 'No customer context' };
    }

    const result = await saveCustomerPreference(context.customerId, key, value);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    logger.info('Customer preference saved:', { customerId: context.customerId, key, value });

    return {
        success: true,
        message: `Санах ойд хадгаллаа: ${key} = ${value}`,
        data: { key, value }
    };
}
