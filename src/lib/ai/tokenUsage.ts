/**
 * Per-feature token usage persistence.
 *
 * Every AI call site (chat, AI memo, vision, system prompt gen, product parse, etc.)
 * MUST call this to record what consumed tokens. Without the feature dimension,
 * shop owners can't tell why their quota is depleting.
 *
 * Non-blocking: never throws — billing persistence must not fail the user request.
 */

import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';
import type { TokenFeature } from './tokenFeatures';

export interface TokenUsageMeta {
    /** Model identifier (e.g. 'gemini-3.1-flash-lite-preview'). Reserved for future per-model breakdowns. */
    model?: string;
    /** Optional request id for log correlation. */
    requestId?: string;
}

/**
 * Persist token usage to the per-feature daily aggregate + shop-level total (atomic increment).
 */
export async function persistTokenUsage(
    shopId: string,
    tokensUsed: number,
    feature: TokenFeature,
    meta?: TokenUsageMeta
): Promise<void> {
    if (!shopId || !tokensUsed || tokensUsed <= 0) return;

    try {
        const supabase = supabaseAdmin();
        const { error } = await supabase.rpc('increment_shop_token_usage', {
            p_shop_id: shopId,
            p_tokens: tokensUsed,
            p_feature: feature,
        });

        if (error) {
            // Migration 20260428_token_feature_breakdown may not be deployed yet —
            // fall back to the 2-arg signature (pre-feature column) so we still
            // increment the shop-level total.
            const { error: legacyError } = await supabase.rpc('increment_shop_token_usage', {
                p_shop_id: shopId,
                p_tokens: tokensUsed,
            });

            if (legacyError) {
                logger.error('Token usage RPC failed (both signatures):', {
                    shopId,
                    feature,
                    tokensUsed,
                    error: error.message,
                    legacyError: legacyError.message,
                });
                return;
            }

            logger.warn('Per-feature RPC unavailable, used legacy 2-arg fallback', {
                shopId,
                feature,
                tokensUsed,
            });
            return;
        }

        logger.debug('Token usage persisted', { shopId, tokensUsed, feature, model: meta?.model });
    } catch (err) {
        // Never propagate — billing must not block the AI response
        logger.error('Failed to persist token usage:', {
            error: err instanceof Error ? err.message : String(err),
            shopId,
            tokensUsed,
            feature,
        });
    }
}
