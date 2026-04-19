/**
 * ChatHistoryService - Handles chat history database operations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DatabaseError } from '@/types/errors';
import type { ChatMessage } from '@/types/ai';
import type { IntentType } from '@/lib/ai/intent-detector';
import { pickOne, type SupabaseRelation } from '@/types/supabase-helpers';

export interface SaveChatData {
    shopId: string;
    customerId?: string;
    message: string;
    response: string;
    intent?: IntentType;
}

export interface ChatHistoryEntry {
    id: string;
    shop_id: string;
    customer_id: string | null;
    message: string;
    response: string;
    intent: string | null;
    created_at: string;
}

export class ChatHistoryService {
    private supabase = supabaseAdmin();

    /**
     * Save a chat interaction
     */
    async save(data: SaveChatData): Promise<ChatHistoryEntry> {
        const { data: entry, error } = await this.supabase
            .from('chat_history')
            .insert({
                shop_id: data.shopId,
                customer_id: data.customerId,
                message: data.message,
                response: data.response,
                intent: data.intent,
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to save chat history', { data, error });
            throw new DatabaseError('Failed to save chat history');
        }

        return entry;
    }

    /**
     * Plan-based context limits
     */
    static readonly CONTEXT_LIMITS: Record<string, number> = {
        lite: 8,
        starter: 12,
        pro: 20,
        enterprise: 30,
    };

    /** Approximate tokens per character (Mongolian/mixed text) */
    static readonly TOKENS_PER_CHAR = 0.5;

    /**
     * Get recent chat history for a customer
     */
    async getRecent(
        shopId: string,
        customerId: string,
        limit: number = 5
    ): Promise<ChatMessage[]> {
        const { data, error } = await this.supabase
            .from('chat_history')
            .select('message, response')
            .eq('shop_id', shopId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('Failed to get chat history', { shopId, customerId, error });
            throw new DatabaseError('Failed to get chat history');
        }

        // Convert to ChatMessage array (reverse to get chronological order)
        const messages: ChatMessage[] = [];

        (data || []).reverse().forEach(h => {
            if (h.message) {
                messages.push({
                    role: 'user',
                    content: h.message,
                });
            }
            if (h.response) {
                messages.push({
                    role: 'assistant',
                    content: h.response,
                });
            }
        });

        return messages;
    }

    /**
     * Get context-optimized chat history
     * - Limits messages based on plan tier
     * - Estimates token usage
     * - Summarizes old messages if context is too large
     */
    async getContextOptimized(
        shopId: string,
        customerId: string,
        planType: string = 'starter',
        maxTokenBudget: number = 2000
    ): Promise<{ messages: ChatMessage[]; estimatedTokens: number; wasTruncated: boolean }> {
        const limit = ChatHistoryService.CONTEXT_LIMITS[planType] || 12;

        const { data, error } = await this.supabase
            .from('chat_history')
            .select('message, response, created_at')
            .eq('shop_id', shopId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('Failed to get optimized chat history', { shopId, customerId, error });
            return { messages: [], estimatedTokens: 0, wasTruncated: false };
        }

        const entries = (data || []).reverse();
        const messages: ChatMessage[] = [];
        let totalChars = 0;
        let wasTruncated = false;

        for (const h of entries) {
            const entryChars = (h.message?.length || 0) + (h.response?.length || 0);
            const entryTokens = Math.ceil(entryChars * ChatHistoryService.TOKENS_PER_CHAR);

            // Stop if we'd exceed token budget
            if (totalChars * ChatHistoryService.TOKENS_PER_CHAR + entryTokens > maxTokenBudget) {
                wasTruncated = true;
                break;
            }

            if (h.message) {
                messages.push({ role: 'user', content: h.message });
                totalChars += h.message.length;
            }
            if (h.response) {
                messages.push({ role: 'assistant', content: h.response });
                totalChars += h.response.length;
            }
        }

        const estimatedTokens = Math.ceil(totalChars * ChatHistoryService.TOKENS_PER_CHAR);

        if (wasTruncated) {
            logger.debug('Chat context truncated', {
                shopId,
                customerId,
                plan: planType,
                messagesUsed: messages.length / 2,
                totalAvailable: entries.length,
                estimatedTokens,
            });
        }

        return { messages, estimatedTokens, wasTruncated };
    }

    /**
     * Get all chat history for a shop with pagination
     */
    async getByShop(
        shopId: string,
        options?: { limit?: number; offset?: number }
    ): Promise<ChatHistoryEntry[]> {
        let query = this.supabase
            .from('chat_history')
            .select('id, shop_id, customer_id, message, response, intent, created_at')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false });

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to get chat history', { shopId, error });
            throw new DatabaseError('Failed to get chat history');
        }

        return data || [];
    }

    /**
     * Get active conversations (unique customers with recent messages)
     */
    async getActiveConversations(
        shopId: string,
        limit: number = 10
    ): Promise<Array<{
        customerId: string;
        customerName: string | null;
        lastMessage: string;
        lastResponse: string;
        lastAt: string;
    }>> {
        const { data, error } = await this.supabase
            .from('chat_history')
            .select('customer_id, message, response, created_at, customers(name)')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(50); // Get more to ensure we have unique customers

        if (error) {
            logger.error('Failed to get active conversations', { shopId, error });
            throw new DatabaseError('Failed to get active conversations');
        }

        // Group by customer and get latest
        const customerMap = new Map<string, {
            customerId: string;
            customerName: string | null;
            lastMessage: string;
            lastResponse: string;
            lastAt: string;
        }>();

        for (const entry of data || []) {
            if (!entry.customer_id || customerMap.has(entry.customer_id)) {
                continue;
            }

            // Handle Supabase join result which may be array or object
            const customerName = pickOne(entry.customers as SupabaseRelation<{ name: string | null }>)?.name ?? null;

            customerMap.set(entry.customer_id, {
                customerId: entry.customer_id,
                customerName: customerName || null,
                lastMessage: entry.message,
                lastResponse: entry.response,
                lastAt: entry.created_at,
            });

            if (customerMap.size >= limit) {
                break;
            }
        }

        return Array.from(customerMap.values());
    }
}

// Export singleton instance
export const chatHistoryService = new ChatHistoryService();
