/**
 * Per-feature token usage persistence.
 *
 * Tokens are accounted against a USER-level 30-day pool (one plan per user
 * shared across all their shops). The shop_id is still recorded so the
 * dashboard can break usage down per shop.
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
 * Resolve the owner user_id for a shop. Cheap one-row lookup; callers without
 * a userId in scope use this as a fallback so old call sites keep working.
 *
 * Returns null if the lookup throws (legacy mocks, unconfigured envs) — the
 * caller then falls through to the legacy shop-scoped RPC.
 */
async function resolveUserIdForShop(shopId: string): Promise<string | null> {
    try {
        const supabase = supabaseAdmin();
        const fromFn = (supabase as { from?: unknown }).from;
        if (typeof fromFn !== 'function') return null;
        const { data, error } = await supabase
            .from('shops')
            .select('user_id')
            .eq('id', shopId)
            .maybeSingle();
        if (error) return null;
        return (data?.user_id as string) || null;
    } catch {
        return null;
    }
}

/**
 * Persist token usage. Increments the user's pool counter, the per-shop
 * analytics counter, and the daily breakdown — all atomically inside the RPC.
 *
 * Accepts either (userId, shopId, …) or the legacy (shopId, …) signature; the
 * legacy form resolves userId from the shops row.
 */
export async function persistTokenUsage(
    userIdOrShopId: string,
    arg2: number | string,
    arg3: number | TokenFeature,
    arg4?: TokenFeature | TokenUsageMeta,
    arg5?: TokenUsageMeta
): Promise<void> {
    let userId: string | null;
    let shopId: string;
    let tokensUsed: number;
    let feature: TokenFeature;
    let meta: TokenUsageMeta | undefined;

    if (typeof arg2 === 'string') {
        // New signature: (userId, shopId, tokensUsed, feature, meta?)
        userId = userIdOrShopId;
        shopId = arg2;
        tokensUsed = arg3 as number;
        feature = arg4 as TokenFeature;
        meta = arg5;
    } else {
        // Legacy signature: (shopId, tokensUsed, feature, meta?) — resolve user.
        shopId = userIdOrShopId;
        tokensUsed = arg2 as number;
        feature = arg3 as TokenFeature;
        meta = arg4 as TokenUsageMeta | undefined;
        userId = null;
    }

    if (!shopId || !tokensUsed || tokensUsed <= 0) return;

    try {
        const supabase = supabaseAdmin();

        if (!userId) userId = await resolveUserIdForShop(shopId);

        // New path: user-pool RPC. Only attempted when we know who owns the shop.
        if (userId) {
            const { error } = await supabase.rpc('increment_user_token_pool', {
                p_user_id: userId,
                p_shop_id: shopId,
                p_tokens: tokensUsed,
                p_feature: feature,
            });

            if (!error) {
                logger.debug('Token usage persisted', {
                    userId,
                    shopId,
                    tokensUsed,
                    feature,
                    model: meta?.model,
                });
                return;
            }

            logger.debug('increment_user_token_pool unavailable, trying legacy shop counter', {
                userId,
                shopId,
                err: error.message,
            });
        }

        // Legacy path: per-shop counter. Two RPC variants are tried so the
        // function works on both pre- and post- token-feature-breakdown DBs.
        const { error } = await supabase.rpc('increment_shop_token_usage', {
            p_shop_id: shopId,
            p_tokens: tokensUsed,
            p_feature: feature,
        });

        if (error) {
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
