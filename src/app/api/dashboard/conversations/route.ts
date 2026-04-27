import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

interface ChatRecord {
    id: string;
    customer_id: string;
    message: string | null;
    response: string | null;
    created_at: string;
}

interface CustomerRecord {
    id: string;
    name: string | null;
    facebook_id: string | null;
    instagram_id: string | null;
    is_vip: boolean | null;
    ai_paused_until: string | null;
    ai_summary: string | null;
    ai_summary_updated_at: string | null;
    ai_summary_message_count: number | null;
}

interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

interface GroupedConversation {
    id: string;
    customer_name: string;
    customer_avatar: string | null;
    facebook_id: string | null;
    instagram_id: string | null;
    is_vip: boolean;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    ai_paused_until: string | null;
    ai_summary: string | null;
    ai_summary_updated_at: string | null;
    ai_summary_message_count: number;
    message_count: number;
    messages: ConversationMessage[];
}

export async function GET(request: NextRequest) {
    try {
        const authShop = await getAuthUserShop();

        if (!authShop) {
            return NextResponse.json({ conversations: [] });
        }

        const supabase = supabaseAdmin();
        const shopId = authShop.id;

        const { data: conversations, error: convoError } = await supabase
            .from('chat_history')
            .select('id, customer_id, message, response, created_at')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (convoError) {
            logger.error('Error fetching conversations:', { error: convoError });
            return NextResponse.json({ error: 'Failed to fetch conversations', details: convoError.message }, { status: 500 });
        }

        const customerIds = [...new Set((conversations || []).map((c: ChatRecord) => c.customer_id).filter(Boolean))];
        const { data: customers } = customerIds.length > 0
            ? await supabase
                .from('customers')
                .select('id, name, facebook_id, instagram_id, is_vip, ai_paused_until, ai_summary, ai_summary_updated_at, ai_summary_message_count')
                .in('id', customerIds)
            : { data: [] };

        const customerMap = new Map<string, CustomerRecord>(
            (customers || []).map((c: CustomerRecord) => [c.id, c])
        );

        const groupedMap = new Map<string, GroupedConversation>();

        (conversations as ChatRecord[] | null)?.forEach((chat) => {
            const customerId = chat.customer_id;
            const customer = customerMap.get(customerId);

            if (!groupedMap.has(customerId)) {
                groupedMap.set(customerId, {
                    id: customerId,
                    customer_name: customer?.name || 'Зочин',
                    customer_avatar: null,
                    facebook_id: customer?.facebook_id ?? null,
                    instagram_id: customer?.instagram_id ?? null,
                    is_vip: !!customer?.is_vip,
                    last_message: chat.message || chat.response || '',
                    last_message_at: chat.created_at,
                    unread_count: 0,
                    ai_paused_until: customer?.ai_paused_until ?? null,
                    ai_summary: customer?.ai_summary ?? null,
                    ai_summary_updated_at: customer?.ai_summary_updated_at ?? null,
                    ai_summary_message_count: customer?.ai_summary_message_count ?? 0,
                    message_count: 0,
                    messages: [],
                });
            }

            const grouped = groupedMap.get(customerId)!;
            const msgs = grouped.messages;

            if (chat.message) {
                msgs.push({
                    id: `${chat.id}-user`,
                    role: 'user',
                    content: chat.message,
                    created_at: chat.created_at,
                });
            }

            if (chat.response) {
                msgs.push({
                    id: `${chat.id}-assistant`,
                    role: 'assistant',
                    content: chat.response,
                    created_at: chat.created_at,
                });
            }

            grouped.message_count = msgs.length;
        });

        const groupedConversations = Array.from(groupedMap.values());

        return NextResponse.json({ conversations: groupedConversations });
    } catch (error: unknown) {
        logger.error('Conversations API error:', { error: error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
