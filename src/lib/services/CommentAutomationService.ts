/**
 * CommentAutomationService
 * Manages comment-to-DM automations for shops
 * Matches incoming comments against stored automation rules and executes actions
 */

import { supabaseAdmin } from '@/lib/supabase';
import {
    sendTextMessage,
    sendPrivateReplyToComment,
    classifyMetaError,
} from '@/lib/facebook/messenger';
import { logger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';
import { captureException } from '@/lib/monitoring/errorMonitoring';
import { extractMongolianPhone, phoneLookupVariants } from '@/lib/utils/phone';
import type { CommentAutomation } from '@/types/database';

export type { CommentAutomation } from '@/types/database';

/**
 * Whitelist of shop IDs that may run comment automations during phased rollout.
 * Empty list (or unset env var) = feature disabled for everyone.
 * Set `COMMENT_AUTOMATION_ENABLED_SHOPS=*` to enable for all shops.
 */
export function isShopWhitelisted(shopId: string): boolean {
    const raw = process.env.COMMENT_AUTOMATION_ENABLED_SHOPS;
    if (!raw) return false;
    if (raw.trim() === '*') return true;
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return ids.includes(shopId);
}

/**
 * Get all active automations for a shop.
 * Returns an empty array if the query fails — errors are logged but never thrown
 * so the webhook hot path stays resilient.
 */
export async function getActiveAutomations(shopId: string): Promise<CommentAutomation[]> {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
        .from('comment_automations')
        .select('id, shop_id, name, is_active, post_id, post_url, trigger_keywords, match_type, action_type, dm_message, reply_message, platform, trigger_count, last_triggered_at, updated_at, created_at')
        .eq('shop_id', shopId)
        .eq('is_active', true);

    if (error) {
        logger.error('Failed to fetch comment automations', { error: error.message });
        return [];
    }

    return (data || []) as CommentAutomation[];
}

/**
 * Find the first active automation that matches an incoming comment.
 * Filters in order: platform → post_id (null = applies to every post) → keywords.
 * Returns `null` if no rule matches.
 */
export async function getMatchingAutomation(
    shopId: string,
    postId: string | null,
    commentText: string,
    platform: 'facebook' | 'instagram'
): Promise<CommentAutomation | null> {
    if (!isShopWhitelisted(shopId)) return null;

    const automations = await getActiveAutomations(shopId);

    if (automations.length === 0) return null;

    const normalizedComment = commentText.toLowerCase().trim();

    for (const automation of automations) {
        // Check platform filter
        if (automation.platform !== 'both' && automation.platform !== platform) {
            continue;
        }

        // Check post_id filter (null = all posts)
        if (automation.post_id && postId && automation.post_id !== postId) {
            continue;
        }

        // Check keyword match
        const matched = matchKeywords(
            normalizedComment,
            automation.trigger_keywords,
            automation.match_type
        );

        if (matched) {
            return automation;
        }
    }

    return null;
}

/**
 * Match a (lowercased, trimmed) comment string against a keyword list.
 * `contains` returns true if any keyword appears as a substring; `exact` returns
 * true only when the whole comment equals a keyword. Both are case-insensitive.
 * Exported so service tests can verify matching behavior in isolation.
 */
export function matchKeywords(
    comment: string,
    keywords: string[],
    matchType: 'contains' | 'exact'
): boolean {
    for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        if (!normalizedKeyword) continue;

        if (matchType === 'exact') {
            // Exact match: entire comment must equal the keyword
            if (comment === normalizedKeyword) return true;
        } else {
            // Contains: keyword appears anywhere in comment
            if (comment.includes(normalizedKeyword)) return true;
        }
    }
    return false;
}

/**
 * Return the original (un-normalised) keyword that matched the comment, for
 * display in the lead report ("which trigger fired"). Mirrors matchKeywords'
 * logic but returns the keyword instead of a boolean. `null` if none matched.
 */
export function findMatchedKeyword(
    comment: string,
    keywords: string[],
    matchType: 'contains' | 'exact'
): string | null {
    const normalizedComment = comment.toLowerCase().trim();
    for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        if (!normalizedKeyword) continue;

        const matched =
            matchType === 'exact'
                ? normalizedComment === normalizedKeyword
                : normalizedComment.includes(normalizedKeyword);
        if (matched) return keyword;
    }
    return null;
}

/**
 * Run an automation: send DM and/or post a comment reply, then increment the
 * trigger counter and write a chat_history entry. DM/reply failures are logged
 * but do not throw — the returned flags indicate which side(s) succeeded.
 */
export async function executeAutomation(
    automation: CommentAutomation,
    senderId: string,
    commentId: string,
    pageAccessToken: string,
    platform: 'facebook' | 'instagram'
): Promise<{ dmSent: boolean; replySent: boolean }> {
    const result = { dmSent: false, replySent: false };
    const supabase = supabaseAdmin();
    let dmAttempted = false;
    let dmFailed = false;
    let replyAttempted = false;
    let replyFailed = false;

    // 1. Send DM if action includes it.
    // Facebook: must use Private Reply (recipient.comment_id) — the commenter
    // hasn't necessarily messaged the page, so the standard recipient.id path
    // falls outside the 24-hour window and Meta rejects it (error 10/200).
    // Instagram: comment-to-DM uses recipient.id with the IG-DM access token
    // and does not have an equivalent comment_id form on the same endpoint, so
    // keep sendTextMessage there (the IG webhook delivers messages from
    // commenters that the page may already have a thread with).
    if (automation.action_type === 'send_dm' || automation.action_type === 'both') {
        dmAttempted = true;
        try {
            if (platform === 'facebook') {
                await sendPrivateReplyToComment({
                    commentId,
                    message: automation.dm_message,
                    pageAccessToken,
                });
            } else {
                await sendTextMessage({
                    recipientId: senderId,
                    message: automation.dm_message,
                    pageAccessToken,
                });
            }
            result.dmSent = true;
            logger.success(`[Comment Automation] DM sent for ${senderId} via ${platform}`, {
                automationName: automation.name,
                commentId,
            });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[Comment Automation] Failed to send DM`, { error: msg, senderId, commentId, platform });
            dmFailed = true;
        }
    }

    // 2. Reply to comment if action includes it
    if (
        (automation.action_type === 'reply_comment' || automation.action_type === 'both') &&
        automation.reply_message
    ) {
        replyAttempted = true;
        try {
            // Meta Graph API expects the page access token in the URL query
            // string for POST /{comment-id}/comments, not in the JSON body.
            // Putting it in the body silently produces an OAuthException —
            // exactly the failure mode the user just reported (DM lands,
            // public comment reply does not).
            const apiVersion = 'v21.0';
            const response = await fetch(
                `https://graph.facebook.com/${apiVersion}/${commentId}/comments?access_token=${encodeURIComponent(pageAccessToken)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: automation.reply_message,
                    }),
                }
            );

            if (response.ok) {
                result.replySent = true;
                logger.success(`[Comment Automation] Comment reply sent on ${platform}`, {
                    automationName: automation.name,
                    commentId,
                });
            } else {
                const errorData = await response.json();
                const kind = classifyMetaError(errorData?.error);
                logger.error(`[Comment Automation] Comment reply failed`, { error: errorData, kind });
                if (kind === 'token_expired' || kind === 'permission_denied') {
                    captureException(
                        new Error(`Meta API ${kind} (commentReply): ${errorData?.error?.message ?? 'no message'}`),
                        {
                            shopId: automation.shop_id,
                            action: 'commentReply',
                            metadata: {
                                code: errorData?.error?.code,
                                subcode: errorData?.error?.error_subcode,
                                fbtrace_id: errorData?.error?.fbtrace_id,
                                platform,
                                error_kind: kind,
                                feature: 'comment-automation',
                                automationId: automation.id,
                            },
                        },
                        'error'
                    );
                }
                replyFailed = true;
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[Comment Automation] Comment reply error`, { error: msg });
            replyFailed = true;
        }
    }

    // 3. Increment trigger count
    await supabase
        .from('comment_automations')
        .update({
            trigger_count: automation.trigger_count + 1,
            last_triggered_at: new Date().toISOString(),
        })
        .eq('id', automation.id);

    // 4. Push notification — success path (at least one channel delivered)
    if (result.dmSent || result.replySent) {
        try {
            const enabled = await isNotificationEnabled(automation.shop_id, 'automation');
            if (enabled) {
                const parts: string[] = [];
                if (result.dmSent) parts.push('DM');
                if (result.replySent) parts.push('Хариу');
                const channelText = parts.join(' + ');
                await sendPushNotification(automation.shop_id, {
                    title: '💬 Сэтгэгдэл автоматаар хариулагдлаа',
                    body: `${automation.name} — ${channelText} илгээгдлээ`,
                    url: '/dashboard/comment-automation',
                    tag: `automation-${automation.id}-${commentId}`,
                });
            }
        } catch (pushErr) {
            logger.warn('Comment automation success push failed', {
                error: pushErr instanceof Error ? pushErr.message : String(pushErr),
            });
        }
    }

    // 5. Push notification — failure path (everything we attempted failed)
    const totalFailed =
        (dmAttempted && dmFailed && (!replyAttempted || replyFailed)) ||
        (replyAttempted && replyFailed && (!dmAttempted || dmFailed));
    if (totalFailed) {
        try {
            const enabled = await isNotificationEnabled(automation.shop_id, 'automation');
            if (enabled) {
                await sendPushNotification(automation.shop_id, {
                    title: '⚠️ Автомат хариу амжилтгүй',
                    body: `${automation.name} автомат дүрэм хариу илгээж чадсангүй`,
                    url: '/dashboard/comment-automation',
                    tag: `automation-fail-${automation.id}`,
                });
            }
        } catch (pushErr) {
            logger.warn('Comment automation failure push failed', {
                error: pushErr instanceof Error ? pushErr.message : String(pushErr),
            });
        }
    }

    // Note: deliberately NOT writing to `chat_history` here.
    // chat_history rows without a customer_id propagate as `{id: null}`
    // entries into /api/dashboard/conversations and crash the inbox list
    // (ConversationListItem.toneFor reads `id.length`). Comment automation
    // already has its own audit trail on `comment_automations` itself
    // (trigger_count, last_triggered_at) and a real conversation only starts
    // once the commenter messages back, at which point the messaging webhook
    // creates a proper customer + chat_history row.

    return result;
}

/**
 * Turn a phone-bearing comment into a real `customers` row so it shows up in the
 * lead dashboard, the customers list and the lead report — all three read
 * `customers`, which comment capture never wrote to. Before this, a broker's 40
 * comment leads existed only on the Тайлан tab and could not be searched,
 * tagged or called from the CRM.
 *
 * Deliberately keyed on the **phone**, not on `from.id`: a Facebook comment
 * carries a Page-scoped ASID that is not the Messenger PSID, so writing it into
 * `customers.facebook_id` would collide with the row the messaging webhook
 * creates when the same person later DMs. `facebook_id` is left null and the
 * messaging path keeps owning that key.
 *
 * Returns the customer id, or null when there is nothing to link.
 */
async function linkCommentLeadToCustomer(params: {
    shopId: string;
    phone: string;
    name: string | null;
    platform: 'facebook' | 'instagram';
    dmSent: boolean;
}): Promise<string | null> {
    const supabase = supabaseAdmin();
    // Equality over the plausible stored shapes, NOT `LIKE '%digits'`: this runs
    // in the webhook hot path (every phone-bearing comment during a live), a
    // leading wildcard can never use an index, and it would also miss a number
    // stored as "976-9911-2233". Backed by idx_customers_shop_phone.
    const variants = phoneLookupVariants(params.phone);
    const { data: existingRows } = await supabase
        .from('customers')
        .select('id, name')
        .eq('shop_id', params.shopId)
        .in('phone', variants.length > 0 ? variants : [params.phone])
        .limit(1);
    const existing = existingRows?.[0];

    // A DM we sent is a real outbound contact — it should reset the follow-up
    // clock. A comment we merely observed is not.
    const contactedAt = params.dmSent ? new Date().toISOString() : null;

    if (existing?.id) {
        const patch: Record<string, string> = {};
        if (!existing.name && params.name) patch.name = params.name;
        if (contactedAt) patch.last_contact_at = contactedAt;
        if (Object.keys(patch).length > 0) {
            await supabase.from('customers').update(patch).eq('id', existing.id);
        }
        return existing.id;
    }

    const { data: created, error } = await supabase
        .from('customers')
        .insert({
            shop_id: params.shopId,
            name: params.name,
            phone: params.phone,
            platform: params.platform === 'instagram' ? 'instagram' : 'messenger',
            tags: ['Сэтгэгдэл'],
            last_contact_at: contactedAt,
        })
        .select('id')
        .single();

    if (error) {
        logger.warn('Failed to create customer from comment lead', { error: error.message });
        return null;
    }
    return created?.id ?? null;
}

/**
 * Log one captured comment into `comment_leads` for the lead report. Extracts a
 * Mongolian phone number from the comment text (the "авна 99XXXXXX" pattern) and
 * records the source (live vs post) and whether the DM / reply were delivered.
 *
 * `captureType`:
 *   - 'automation' — a rule matched and DM'd the commenter; pass that automation
 *     so we can store its id + which keyword fired.
 *   - 'missed' — the commenter left a phone but NO rule matched, so the shop
 *     never engaged them. Pass `automation: null`.
 *
 * `linkCustomer` — when true and the comment carried a phone, also upsert a
 * `customers` row and store its id on the lead. Callers pass this for
 * lead-archetype shops (үл хөдлөх / авто / сургалт), where the comment IS the
 * lead; a commerce shop's customer record is still owned by the messaging path.
 *
 * Best-effort: idempotent on `comment_id` (webhook retries) and never throws —
 * a logging failure must not break comment handling.
 */
export async function recordCommentLead(params: {
    shopId: string;
    automation: CommentAutomation | null;
    captureType: 'automation' | 'missed';
    platform: 'facebook' | 'instagram';
    sourceType: 'post' | 'live';
    postId: string | null;
    commentId: string;
    commenterId: string | null;
    commenterName: string | null;
    commentText: string;
    dmSent: boolean;
    replySent: boolean;
    linkCustomer?: boolean;
}): Promise<void> {
    try {
        const supabase = supabaseAdmin();
        const extractedPhone = extractMongolianPhone(params.commentText);
        const matchedKeyword = params.automation
            ? findMatchedKeyword(
                  params.commentText,
                  params.automation.trigger_keywords,
                  params.automation.match_type
              )
            : null;

        let customerId: string | null = null;
        if (params.linkCustomer && extractedPhone) {
            customerId = await linkCommentLeadToCustomer({
                shopId: params.shopId,
                phone: extractedPhone,
                name: params.commenterName,
                platform: params.platform,
                dmSent: params.dmSent,
            });
        }

        const { error } = await supabase
            .from('comment_leads')
            .upsert(
                {
                    shop_id: params.shopId,
                    automation_id: params.automation?.id ?? null,
                    capture_type: params.captureType,
                    platform: params.platform,
                    source_type: params.sourceType,
                    post_id: params.postId,
                    comment_id: params.commentId,
                    commenter_id: params.commenterId,
                    commenter_name: params.commenterName,
                    comment_text: params.commentText,
                    extracted_phone: extractedPhone,
                    matched_keyword: matchedKeyword,
                    dm_sent: params.dmSent,
                    reply_sent: params.replySent,
                    customer_id: customerId,
                },
                { onConflict: 'comment_id', ignoreDuplicates: true }
            );

        if (error) {
            logger.error('Failed to record comment lead', { error: error.message, commentId: params.commentId });
        }
    } catch (err) {
        logger.warn('recordCommentLead threw', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/**
 * Get every automation for a shop (active + inactive), newest first.
 * Used by the dashboard list view. Returns `[]` on query error.
 */
export async function getAllAutomations(shopId: string): Promise<CommentAutomation[]> {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
        .from('comment_automations')
        .select('id, shop_id, name, is_active, post_id, post_url, trigger_keywords, match_type, action_type, dm_message, reply_message, platform, trigger_count, last_triggered_at, updated_at, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

    if (error) {
        logger.error('Failed to fetch all comment automations', { error: error.message });
        return [];
    }

    return (data || []) as CommentAutomation[];
}

/**
 * Insert a new automation. Defaults: `match_type='contains'`,
 * `action_type='send_dm'`, `platform='both'`. Returns `null` on error.
 */
export async function createAutomation(
    shopId: string,
    data: {
        name: string;
        trigger_keywords: string[];
        dm_message: string;
        match_type?: 'contains' | 'exact';
        action_type?: 'send_dm' | 'reply_comment' | 'both';
        reply_message?: string;
        platform?: 'facebook' | 'instagram' | 'both';
        post_id?: string;
        post_url?: string;
    }
): Promise<CommentAutomation | null> {
    const supabase = supabaseAdmin();

    const { data: result, error } = await supabase
        .from('comment_automations')
        .insert({
            shop_id: shopId,
            name: data.name,
            trigger_keywords: data.trigger_keywords,
            dm_message: data.dm_message,
            match_type: data.match_type || 'contains',
            action_type: data.action_type || 'send_dm',
            reply_message: data.reply_message || null,
            platform: data.platform || 'both',
            post_id: data.post_id || null,
            post_url: data.post_url || null,
        })
        .select()
        .single();

    if (error) {
        logger.error('Failed to create comment automation', { error: error.message });
        return null;
    }

    return result as CommentAutomation;
}

/**
 * Update an automation. Scoped by `shop_id` so a shop can never modify another
 * shop's rule. `updated_at` is set automatically. Returns the updated row, or
 * `null` if the row was not found or the update failed.
 */
export async function updateAutomation(
    automationId: string,
    shopId: string,
    updates: Partial<Omit<CommentAutomation, 'id' | 'shop_id' | 'created_at'>>
): Promise<CommentAutomation | null> {
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
        .from('comment_automations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', automationId)
        .eq('shop_id', shopId)
        .select()
        .single();

    if (error) {
        logger.error('Failed to update comment automation', { error: error.message });
        return null;
    }

    return data as CommentAutomation;
}

/**
 * Delete an automation, scoped by `shop_id`. Returns `true` on success and
 * `false` on database error.
 */
export async function deleteAutomation(
    automationId: string,
    shopId: string
): Promise<boolean> {
    const supabase = supabaseAdmin();

    const { error } = await supabase
        .from('comment_automations')
        .delete()
        .eq('id', automationId)
        .eq('shop_id', shopId);

    if (error) {
        logger.error('Failed to delete comment automation', { error: error.message });
        return false;
    }

    return true;
}
