/**
 * Webhook Retry Queue
 * 
 * Failed webhook processing → Redis queue → retry up to 3 times
 * Dead letter queue → persisted for manual review
 */

import { getRedisClient } from '@/lib/redis/client';
import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 45000]; // 5s, 15s, 45s (exponential backoff)

export interface WebhookPayload {
    id: string;
    source: 'facebook' | 'instagram' | 'qpay';
    payload: Record<string, unknown>;
    receivedAt: string;
    retryCount: number;
    lastError?: string;
    shopId?: string;
}

/**
 * Enqueue a failed webhook for retry
 */
export async function enqueueRetry(webhook: Omit<WebhookPayload, 'retryCount'>): Promise<void> {
    const entry: WebhookPayload = { ...webhook, retryCount: 0 };

    try {
        const redis = getRedisClient();
        const key = `webhook:retry:${entry.id}`;
        await redis.set(key, JSON.stringify(entry), { ex: 3600 }); // 1h TTL

        logger.info('Webhook enqueued for retry', { id: entry.id, source: entry.source });
    } catch (err) {
        logger.error('Failed to enqueue webhook retry', { error: String(err) });
        // Fallback: send directly to dead letter
        await sendToDeadLetter(entry, 'Redis enqueue failed');
    }
}

/**
 * Process a retry attempt.
 * Returns true if the webhook should be retried again, false if done.
 */
export async function processRetry(
    webhook: WebhookPayload,
    handler: (payload: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
    const attempt = webhook.retryCount + 1;

    try {
        await handler(webhook.payload);

        // Success - clean up
        const redis = getRedisClient();
        await redis.del(`webhook:retry:${webhook.id}`);

        logger.info('Webhook retry succeeded', {
            id: webhook.id,
            source: webhook.source,
            attempt,
        });

        return false; // Done, no more retries
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (attempt >= MAX_RETRIES) {
            // Max retries reached → dead letter
            await sendToDeadLetter(
                { ...webhook, retryCount: attempt, lastError: errorMessage },
                errorMessage
            );
            return false; // Done
        }

        // Update retry count in Redis
        try {
            const redis = getRedisClient();
            const updated: WebhookPayload = {
                ...webhook,
                retryCount: attempt,
                lastError: errorMessage,
            };
            await redis.set(`webhook:retry:${webhook.id}`, JSON.stringify(updated), { ex: 3600 });
        } catch {
            // Redis unavailable — skip
        }

        logger.warn('Webhook retry failed, will retry', {
            id: webhook.id,
            source: webhook.source,
            attempt,
            maxRetries: MAX_RETRIES,
            nextRetryMs: RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1],
            error: errorMessage,
        });

        return true; // Retry again
    }
}

/**
 * Get retry delay for a given attempt (exponential backoff)
 */
export function getRetryDelay(retryCount: number): number {
    return RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
}

/**
 * Send failed webhook to dead letter queue (Supabase)
 */
async function sendToDeadLetter(webhook: WebhookPayload, reason: string): Promise<void> {
    try {
        const supabase = supabaseAdmin();
        await supabase.from('webhook_dead_letters').insert({
            webhook_id: webhook.id,
            source: webhook.source,
            payload: webhook.payload,
            retry_count: webhook.retryCount,
            last_error: reason,
            shop_id: webhook.shopId || null,
            received_at: webhook.receivedAt,
            dead_at: new Date().toISOString(),
        });

        // Clean up Redis
        const redis = getRedisClient();
        await redis.del(`webhook:retry:${webhook.id}`);

        logger.error('Webhook moved to dead letter queue', {
            id: webhook.id,
            source: webhook.source,
            retries: webhook.retryCount,
            reason,
        });
    } catch (err) {
        logger.error('Failed to write dead letter', { error: String(err), webhookId: webhook.id });
    }
}

/**
 * Get dead letter count for dashboard display
 */
export async function getDeadLetterCount(shopId?: string): Promise<number> {
    try {
        const supabase = supabaseAdmin();
        let query = supabase
            .from('webhook_dead_letters')
            .select('id', { count: 'exact', head: true });

        if (shopId) {
            query = query.eq('shop_id', shopId);
        }

        const { count } = await query;
        return count || 0;
    } catch {
        return 0;
    }
}
