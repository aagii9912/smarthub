/**
 * StoryProductLinkService
 *
 * Manages the story → product registry that makes story-reply resolution
 * deterministic:
 *   • Instagram — keyed by reply_to.story.id (story_media_id). The webhook looks
 *     a story up here BEFORE calling vision; on a confident vision match it
 *     writes back a `vision_auto` row (read-through cache) so the next reply is
 *     free and works even on lite plans / after the story image expires.
 *   • Facebook — the FB webhook carries no story id (reply_to.story is IG-only),
 *     so FB rows are a time-windowed "active pin": the owner marks the current
 *     story's product and FB DMs before `active_until` get it as soft context.
 *
 * Webhook-facing reads/writes are resilient: they log and return null/void on
 * error so the message hot path never throws.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { StoryProductLink, StoryLinkPlatform } from '@/types/database';

export type { StoryProductLink } from '@/types/database';

const PRODUCT_JOIN = '*, product:products(id, name, image_url, price)';

/**
 * IG deterministic lookup by story_media_id. Returns null on miss or error.
 */
export async function getStoryLinkByMediaId(
    shopId: string,
    storyMediaId: string
): Promise<StoryProductLink | null> {
    const supabase = supabaseAdmin();
    // platform='instagram' filter is defense-in-depth: story_media_id is an
    // IG-only concept and the partial unique index is platform-agnostic, so a
    // stray FB row carrying a story_media_id must never satisfy an IG lookup.
    const { data, error } = await supabase
        .from('story_product_links')
        .select('*')
        .eq('shop_id', shopId)
        .eq('platform', 'instagram')
        .eq('story_media_id', storyMediaId)
        .maybeSingle();

    if (error) {
        logger.warn('getStoryLinkByMediaId failed', { error: error.message, shopId });
        return null;
    }
    return (data as StoryProductLink | null) || null;
}

/**
 * Facebook active pin: the latest non-expired pin for the shop. Returns null
 * when no pin is active (or on error).
 */
export async function getActiveFbPin(shopId: string): Promise<StoryProductLink | null> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
        .from('story_product_links')
        .select('*')
        .eq('shop_id', shopId)
        .eq('platform', 'facebook')
        .gt('active_until', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        logger.warn('getActiveFbPin failed', { error: error.message, shopId });
        return null;
    }
    return (data as StoryProductLink | null) || null;
}

/**
 * Read-through cache write after a confident IG vision match. Manual
 * select-then-insert/update because the unique index on (shop_id,
 * story_media_id) is PARTIAL (WHERE story_media_id IS NOT NULL) and Supabase's
 * .upsert(onConflict) does not reliably target a partial index. Never throws.
 */
export async function upsertVisionAutoLink(params: {
    shopId: string;
    productId: string;
    storyMediaId: string;
    mediaUrl?: string | null;
    confidence?: number | null;
}): Promise<void> {
    const { shopId, productId, storyMediaId, mediaUrl, confidence } = params;
    try {
        const supabase = supabaseAdmin();
        const existing = await getStoryLinkByMediaId(shopId, storyMediaId);

        if (existing) {
            // Do not clobber a manual tag with an auto guess.
            if (existing.source === 'manual') return;
            await supabase
                .from('story_product_links')
                .update({
                    product_id: productId,
                    confidence: confidence ?? null,
                    media_url: mediaUrl ?? existing.media_url ?? null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            return;
        }

        const { error } = await supabase.from('story_product_links').insert({
            shop_id: shopId,
            product_id: productId,
            platform: 'instagram',
            story_media_id: storyMediaId,
            source: 'vision_auto',
            confidence: confidence ?? null,
            media_url: mediaUrl ?? null,
        });
        // 23505 = unique violation: a concurrent reply to the same brand-new
        // story already wrote the (identical) mapping — benign, ignore. Log any
        // other error so it isn't silently dropped.
        if (error && error.code !== '23505') {
            logger.warn('upsertVisionAutoLink insert failed', { error: error.message, shopId });
        }
    } catch (err) {
        logger.warn('upsertVisionAutoLink failed', { error: String(err), shopId });
    }
}

/**
 * Dashboard list (newest first), with the linked product joined in.
 */
export async function getAllStoryLinks(shopId: string): Promise<StoryProductLink[]> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
        .from('story_product_links')
        .select(PRODUCT_JOIN)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('getAllStoryLinks failed', { error: error.message, shopId });
        return [];
    }
    return (data || []) as StoryProductLink[];
}

/**
 * Create a manual link. IG → pass story_media_id. FB → pass active_until
 * (the pin window). Returns the created row (with product joined) or null.
 */
export async function createStoryLink(
    shopId: string,
    data: {
        product_id: string;
        platform: StoryLinkPlatform;
        story_media_id?: string | null;
        media_url?: string | null;
        caption?: string | null;
        active_until?: string | null;
    }
): Promise<StoryProductLink | null> {
    const supabase = supabaseAdmin();

    // IG: a story_media_id is unique per shop (partial unique index). Re-tagging
    // the same story is a normal owner action, so UPDATE in place (re-point to
    // the new product) instead of hitting a 23505 unique violation. Mirrors the
    // select-then-insert/update pattern used by upsertVisionAutoLink (Supabase
    // .upsert(onConflict) does not reliably target a partial index).
    if (data.story_media_id) {
        const existing = await getStoryLinkByMediaId(shopId, data.story_media_id);
        if (existing) {
            const { data: updated, error: updErr } = await supabase
                .from('story_product_links')
                .update({
                    product_id: data.product_id,
                    media_url: data.media_url || null,
                    caption: data.caption || null,
                    source: 'manual',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .eq('shop_id', shopId)
                .select(PRODUCT_JOIN)
                .single();
            if (updErr) {
                logger.error('createStoryLink update failed', { error: updErr.message, shopId });
                return null;
            }
            return updated as StoryProductLink;
        }
    }

    const { data: result, error } = await supabase
        .from('story_product_links')
        .insert({
            shop_id: shopId,
            product_id: data.product_id,
            platform: data.platform,
            story_media_id: data.story_media_id || null,
            media_url: data.media_url || null,
            caption: data.caption || null,
            active_until: data.active_until || null,
            source: 'manual',
        })
        .select(PRODUCT_JOIN)
        .single();

    if (error) {
        logger.error('createStoryLink failed', { error: error.message, shopId });
        return null;
    }
    return result as StoryProductLink;
}

/**
 * Delete a link, scoped by shop_id. Returns true on success.
 */
export async function deleteStoryLink(id: string, shopId: string): Promise<boolean> {
    const supabase = supabaseAdmin();
    const { error } = await supabase
        .from('story_product_links')
        .delete()
        .eq('id', id)
        .eq('shop_id', shopId);

    if (error) {
        logger.error('deleteStoryLink failed', { error: error.message, shopId });
        return false;
    }
    return true;
}
