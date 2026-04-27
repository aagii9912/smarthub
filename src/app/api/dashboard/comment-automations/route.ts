import { logger } from '@/lib/utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
    getAllAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
} from '@/lib/services/CommentAutomationService';

/**
 * Helper: get shop ID for authenticated user
 */
async function getShopId(request: NextRequest): Promise<string | null> {
    const userId = await getAuthUser();
    if (!userId) return null;

    const shopId = request.headers.get('x-shop-id');
    if (shopId) return shopId;

    // Fallback: get first active shop
    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    return data?.id || null;
}

/**
 * GET /api/dashboard/comment-automations
 *
 * List every automation (active + inactive) for the authenticated shop.
 *
 * Auth: requires `x-shop-id` header or a session-bound shop fallback.
 *
 * Responses:
 *   200 — `{ automations: CommentAutomation[] }`
 *   401 — `{ error: 'Unauthorized' }` when shop cannot be resolved
 *   500 — `{ error: 'Internal server error' }` on unexpected failure
 */
export async function GET(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const automations = await getAllAutomations(shopId);
        return NextResponse.json({ automations });
    } catch (error: unknown) {
        logger.error('GET comment-automations error:', { error: error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/comment-automations
 *
 * Create a new automation for the authenticated shop.
 *
 * Body (JSON):
 *   - name: string (required)
 *   - trigger_keywords: string[] (required, must be non-empty)
 *   - dm_message: string (required)
 *   - match_type?: 'contains' | 'exact'        (default 'contains')
 *   - action_type?: 'send_dm' | 'reply_comment' | 'both' (default 'send_dm')
 *   - reply_message?: string                   (only used when action_type includes reply)
 *   - platform?: 'facebook' | 'instagram' | 'both' (default 'both')
 *   - post_id?: string                          (omit to apply to every post)
 *   - post_url?: string                         (display-only)
 *
 * Responses:
 *   201 — `{ automation: CommentAutomation }`
 *   400 — required fields missing
 *   401 — unauthenticated
 *   500 — insert failure
 */
export async function POST(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, trigger_keywords, dm_message, match_type, action_type, reply_message, platform, post_id, post_url } = body;

        if (!name || !trigger_keywords?.length || !dm_message) {
            return NextResponse.json(
                { error: 'name, trigger_keywords, dm_message шаардлагатай' },
                { status: 400 }
            );
        }

        const automation = await createAutomation(shopId, {
            name,
            trigger_keywords,
            dm_message,
            match_type,
            action_type,
            reply_message,
            platform,
            post_id,
            post_url,
        });

        if (!automation) {
            return NextResponse.json({ error: 'Automation үүсгэж чадсангүй' }, { status: 500 });
        }

        return NextResponse.json({ automation }, { status: 201 });
    } catch (error: unknown) {
        logger.error('POST comment-automations error:', { error: error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/dashboard/comment-automations
 *
 * Update an existing automation. Used both for full edits and the active/inactive
 * toggle (`{ id, is_active: boolean }`). Scoped to the authenticated shop, so
 * one shop cannot mutate another's rule.
 *
 * Body (JSON): `{ id: string, ...partial CommentAutomation fields }`
 *
 * Responses:
 *   200 — `{ automation: CommentAutomation }`
 *   400 — `id` missing
 *   401 — unauthenticated
 *   404 — automation not found for this shop
 */
export async function PATCH(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });
        }

        const automation = await updateAutomation(id, shopId, updates);
        if (!automation) {
            return NextResponse.json({ error: 'Automation олдсонгүй' }, { status: 404 });
        }

        return NextResponse.json({ automation });
    } catch (error: unknown) {
        logger.error('PATCH comment-automations error:', { error: error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/dashboard/comment-automations?id={id}
 *
 * Delete an automation by id, scoped to the authenticated shop.
 *
 * Responses:
 *   200 — `{ success: true }`
 *   400 — `id` query param missing
 *   401 — unauthenticated
 *   500 — delete failure
 */
export async function DELETE(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = request.nextUrl;
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });
        }

        const success = await deleteAutomation(id, shopId);
        if (!success) {
            return NextResponse.json({ error: 'Устгаж чадсангүй' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        logger.error('DELETE comment-automations error:', { error: error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
