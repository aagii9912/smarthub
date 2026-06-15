/**
 * Subscription write helper — per-user plan model.
 *
 * `subscriptions` no longer has a plain UNIQUE constraint: migration
 * 20260429110000 dropped UNIQUE(shop_id) and replaced it with a PARTIAL
 * unique index (user_id WHERE status IN open states). PostgreSQL's
 * ON CONFLICT cannot infer a partial index, so any
 * `.upsert(..., { onConflict: 'user_id' | 'shop_id' })` against this table
 * throws "no unique or exclusion constraint matching the ON CONFLICT
 * specification". Every write path must use this manual
 * select-then-update/insert instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

/** Statuses covered by the subscriptions_user_active_unique partial index. */
const OPEN_STATUSES = ['active', 'trialing', 'pending', 'past_due'];

export interface SubscriptionUpsertPayload {
    user_id: string;
    shop_id?: string | null;
    plan_id: string;
    status: 'active' | 'trialing' | 'pending' | 'past_due';
    billing_cycle: string;
    current_period_start?: string;
    current_period_end?: string;
    period_anchor_at?: string;
    tokens_used_in_period?: number;
}

export interface SubscriptionUpsertResult {
    data: { id: string } | null;
    error: { message: string } | null;
}

export interface SubscriptionUpsertOptions {
    /**
     * When true, an existing active/trialing/past_due row is left untouched
     * and returned as-is (only a 'pending' row gets overwritten). Used by
     * /subscribe so an abandoned payment can't downgrade a live plan.
     */
    preserveActive?: boolean;
}

export async function upsertUserSubscription(
    supabase: SupabaseClient,
    payload: SubscriptionUpsertPayload,
    options: SubscriptionUpsertOptions = {}
): Promise<SubscriptionUpsertResult> {
    const { data: existing, error: selectError } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', payload.user_id)
        .in('status', OPEN_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (selectError) {
        return { data: null, error: { message: selectError.message } };
    }

    if (existing && options.preserveActive && existing.status !== 'pending') {
        return { data: { id: existing.id }, error: null };
    }

    if (existing) {
        const { data, error } = await supabase
            .from('subscriptions')
            .update(payload)
            .eq('id', existing.id)
            .select('id')
            .maybeSingle();
        return { data, error: error ? { message: error.message } : null };
    }

    const { data: inserted, error: insertError } = await supabase
        .from('subscriptions')
        .insert(payload)
        .select('id')
        .maybeSingle();

    if (insertError) {
        // Concurrent insert can win the partial-unique race (23505) — retry as update.
        if (insertError.code === '23505') {
            logger.warn('subscriptions insert hit unique race, retrying as update', {
                user_id: payload.user_id,
            });
            const { data: raced } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', payload.user_id)
                .in('status', OPEN_STATUSES)
                .limit(1)
                .maybeSingle();
            if (raced) {
                const { data, error } = await supabase
                    .from('subscriptions')
                    .update(payload)
                    .eq('id', raced.id)
                    .select('id')
                    .maybeSingle();
                return { data, error: error ? { message: error.message } : null };
            }
        }
        return { data: null, error: { message: insertError.message } };
    }

    return { data: inserted, error: null };
}
