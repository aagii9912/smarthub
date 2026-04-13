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

    return {
        success: true,
        message: `Saved: ${phone ? 'phone ' : ''}${address ? 'address ' : ''}${name ? 'name' : ''}`
    };
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

    return {
        success: true,
        message: 'Дэлгүүрийн эзэнд мэдэгдэл илгээлээ. Тун удахгүй холбогдоно.',
        actions: [
            {
                type: 'support_actions',
                buttons: [
                    {
                        id: 'call_phone',
                        label: '📞 Утсаар холбогдох',
                        icon: 'phone',
                        variant: 'secondary',
                        payload: 'CALL_PHONE',
                    },
                ],
            },
        ],
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
