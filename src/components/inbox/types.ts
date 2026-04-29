export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export interface InboxConversation {
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
    messages: ChatMessage[];
}

export interface InboxComplaint {
    id: string;
    complaint_type: string;
    severity: string;
    status: string;
    description: string;
    created_at: string;
}

export interface InboxCustomerDetail {
    id: string;
    name: string | null;
    facebook_id: string | null;
    instagram_id: string | null;
    is_vip: boolean | null;
    total_orders: number | null;
    total_spent: number | null;
    ai_memory: Record<string, unknown> | null;
    ai_paused_until: string | null;
    ai_summary: string | null;
    ai_summary_updated_at: string | null;
    ai_summary_message_count: number | null;
    ai_summary_locale: string | null;
}

export interface ConversationDetailResponse {
    customer: InboxCustomerDetail;
    messages: ChatMessage[];
    complaints: InboxComplaint[];
    message_count: number;
    last_customer_message_at: string | null;
}

export type MessagingWindowState = 'within_24h' | 'within_7d' | 'expired';

export interface SummaryResponse {
    summary: string;
    updated_at: string;
    message_count: number;
    cached: boolean;
}

export type AiPauseMode = 'pause' | 'off';

export type Channel = 'messenger' | 'instagram' | 'unknown';

export function deriveChannel(args: {
    facebook_id: string | null;
    instagram_id: string | null;
}): Channel {
    if (args.facebook_id) return 'messenger';
    if (args.instagram_id) return 'instagram';
    return 'unknown';
}
