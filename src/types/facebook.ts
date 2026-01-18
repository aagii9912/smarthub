/**
 * Facebook API Types - Type definitions for Facebook Graph API
 */

// Webhook entry from Facebook
export interface WebhookEntry {
    id: string; // Page ID
    time: number;
    messaging?: MessagingEvent[];
    changes?: ChangeEvent[];
}

// Messaging event
export interface MessagingEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: MessageData;
    postback?: PostbackData;
    read?: ReadData;
    delivery?: DeliveryData;
}

// Message data
export interface MessageData {
    mid: string;
    text?: string;
    attachments?: Attachment[];
    quick_reply?: QuickReplyPayload;
    is_echo?: boolean;
}

// Attachment in message
export interface Attachment {
    type: 'image' | 'video' | 'audio' | 'file' | 'location' | 'fallback';
    payload: AttachmentPayload;
}

export interface AttachmentPayload {
    url?: string;
    coordinates?: { lat: number; long: number };
    title?: string;
}

// Quick reply payload
export interface QuickReplyPayload {
    payload: string;
}

// Postback data (button clicks)
export interface PostbackData {
    title: string;
    payload: string;
}

// Read receipt
export interface ReadData {
    watermark: number;
}

// Delivery receipt
export interface DeliveryData {
    watermark: number;
    mids?: string[];
}

// Feed change events (comments, posts)
export interface ChangeEvent {
    field: 'feed' | 'messages' | 'messaging_postbacks';
    value: FeedChangeValue;
}

export interface FeedChangeValue {
    item: 'comment' | 'post' | 'reaction';
    verb: 'add' | 'edit' | 'remove';
    post_id?: string;
    comment_id?: string;
    parent_id?: string;
    message?: string;
    from?: {
        id: string;
        name: string;
    };
    created_time?: number;
}

// Facebook user profile
export interface FacebookProfile {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    profile_pic?: string;
}

// Send API message types
export interface SendMessageRequest {
    recipient: { id: string };
    message: MessagePayload;
    messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
    tag?: string;
}

export type MessagePayload =
    | TextMessage
    | AttachmentMessage
    | TemplateMessage;

export interface TextMessage {
    text: string;
    quick_replies?: QuickReply[];
}

export interface AttachmentMessage {
    attachment: {
        type: 'image' | 'audio' | 'video' | 'file' | 'template';
        payload: {
            url?: string;
            is_reusable?: boolean;
        };
    };
}

export interface TemplateMessage {
    attachment: {
        type: 'template';
        payload: GenericTemplatePayload | ButtonTemplatePayload;
    };
}

export interface GenericTemplatePayload {
    template_type: 'generic';
    elements: GenericElement[];
}

export interface GenericElement {
    title: string;
    subtitle?: string;
    image_url?: string;
    default_action?: DefaultAction;
    buttons?: Button[];
}

export interface DefaultAction {
    type: 'web_url';
    url: string;
    webview_height_ratio?: 'compact' | 'tall' | 'full';
}

export interface Button {
    type: 'web_url' | 'postback' | 'phone_number';
    title: string;
    url?: string;
    payload?: string;
}

export interface ButtonTemplatePayload {
    template_type: 'button';
    text: string;
    buttons: Button[];
}

export interface QuickReply {
    content_type: 'text' | 'user_phone_number' | 'user_email';
    title?: string;
    payload?: string;
    image_url?: string;
}

// Sender action types
export type SenderAction = 'typing_on' | 'typing_off' | 'mark_seen';
