import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { headers } from 'next/headers';

interface ChatRow {
    id: string;
    message: string | null;
    response: string | null;
    intent: string | null;
    created_at: string;
}

interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

function flattenChats(rows: ChatRow[]): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    for (const row of rows) {
        if (row.message && row.message.trim()) {
            messages.push({
                id: `${row.id}-user`,
                role: 'user',
                content: row.message,
                created_at: row.created_at,
            });
        }
        if (row.response && row.response.trim()) {
            messages.push({
                id: `${row.id}-assistant`,
                role: 'assistant',
                content: row.response,
                created_at: row.created_at,
            });
        }
    }
    return messages;
}

async function resolveShopId(): Promise<string | null> {
    const authShop = await getAuthUserShop();
    if (authShop) return authShop.id;
    const headerList = await headers();
    return headerList.get('x-shop-id');
}

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ customerId: string }> }
) {
    try {
        const { customerId } = await ctx.params;

        const shopId = await resolveShopId();
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        const [customerResult, chatsResult, complaintsResult] = await Promise.all([
            supabase
                .from('customers')
                .select(
                    'id, name, facebook_id, instagram_id, is_vip, total_orders, total_spent, ai_memory, ai_paused_until, ai_summary, ai_summary_updated_at, ai_summary_message_count, ai_summary_locale'
                )
                .eq('id', customerId)
                .eq('shop_id', shopId)
                .single(),
            supabase
                .from('chat_history')
                .select('id, message, response, intent, created_at')
                .eq('customer_id', customerId)
                .eq('shop_id', shopId)
                .order('created_at', { ascending: true })
                .limit(500),
            supabase
                .from('customer_complaints')
                .select('id, complaint_type, severity, status, description, created_at')
                .eq('customer_id', customerId)
                .eq('shop_id', shopId)
                .in('status', ['new', 'in_progress'])
                .order('created_at', { ascending: false }),
        ]);

        if (customerResult.error || !customerResult.data) {
            logger.warn('Conversation detail: customer not found', {
                customerId,
                shopId,
                error: customerResult.error?.message,
            });
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const chatRows = (chatsResult.data ?? []) as ChatRow[];
        const messages = flattenChats(chatRows);

        // Most recent inbound (customer-authored) message timestamp.
        // Used by the inbox UI to show the 24h/7d Messenger-window state.
        const lastInboundAt =
            chatRows
                .filter((r) => r.message && r.message.trim())
                .reduce<string | null>((latest, r) => {
                    if (!latest || r.created_at > latest) return r.created_at;
                    return latest;
                }, null);

        return NextResponse.json({
            customer: customerResult.data,
            messages,
            complaints: complaintsResult.data ?? [],
            message_count: messages.length,
            last_customer_message_at: lastInboundAt,
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Conversation detail API error:', { error: errMsg });
        return NextResponse.json(
            { error: 'Internal server error', details: errMsg },
            { status: 500 }
        );
    }
}
