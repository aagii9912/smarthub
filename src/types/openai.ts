/**
 * OpenAI Message Types
 * Proper types for OpenAI chat messages to avoid `as any` casting
 */

import type OpenAI from 'openai';

/**
 * Base message type
 */
export interface BaseMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}

/**
 * System message
 */
export interface SystemMessage extends BaseMessage {
    role: 'system';
}

/**
 * User message
 */
export interface UserMessage extends BaseMessage {
    role: 'user';
}

/**
 * Assistant message without tool calls
 */
export interface AssistantMessage extends BaseMessage {
    role: 'assistant';
}

/**
 * Tool call result message
 */
export interface ToolMessage {
    role: 'tool';
    tool_call_id: string;
    content: string;
}

/**
 * Assistant message with tool calls
 */
export interface AssistantToolCallMessage {
    role: 'assistant';
    content: string | null;
    tool_calls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
}

/**
 * Union type for all message types in chat
 */
export type ChatCompletionMessage =
    | SystemMessage
    | UserMessage
    | AssistantMessage
    | ToolMessage
    | AssistantToolCallMessage;

/**
 * Type guard for tool call message
 */
export function isToolCallMessage(
    message: ChatCompletionMessage | OpenAI.Chat.Completions.ChatCompletionMessage
): message is AssistantToolCallMessage {
    return (
        message.role === 'assistant' &&
        'tool_calls' in message &&
        Array.isArray(message.tool_calls) &&
        message.tool_calls.length > 0
    );
}

/**
 * Create a tool result message
 */
export function createToolResultMessage(
    toolCallId: string,
    result: { success?: boolean; message?: string; error?: string;[key: string]: unknown }
): ToolMessage {
    return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify(result)
    };
}

/**
 * Convert our chat message to OpenAI format
 */
export function toOpenAIMessages(
    messages: ChatCompletionMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}
