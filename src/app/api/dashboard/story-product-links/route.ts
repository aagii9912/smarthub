import { logger } from '@/lib/utils/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
    getAllStoryLinks,
    createStoryLink,
    deleteStoryLink,
} from '@/lib/services/StoryProductLinkService';
import { createStoryLinkSchema } from '@/lib/validations/storyProductLink';

/**
 * Resolve the shop for the authenticated user (x-shop-id header, else first
 * active shop). Mirrors the comment-automations route.
 */
async function getShopId(request: NextRequest): Promise<string | null> {
    const userId = await getAuthUser();
    if (!userId) return null;

    const supabase = supabaseAdmin();

    // SECURITY: the x-shop-id header is attacker-controllable. All DB ops here
    // use the service-role client, which BYPASSES RLS, so we MUST verify the
    // header shop belongs to this user before trusting it — otherwise a user
    // could read/write/delete another shop's links by spoofing the header.
    const headerShopId = request.headers.get('x-shop-id');
    if (headerShopId) {
        const { data } = await supabase
            .from('shops')
            .select('id')
            .eq('user_id', userId)
            .eq('id', headerShopId)
            .maybeSingle();
        return data?.id ?? null; // null → caller returns 401
    }

    // Fallback (no header): first active shop owned by the user.
    const { data } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    return data?.id || null;
}

/**
 * GET /api/dashboard/story-product-links
 * List all story → product links for the authenticated shop (product joined).
 */
export async function GET(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const links = await getAllStoryLinks(shopId);
        return NextResponse.json({ links });
    } catch (error: unknown) {
        logger.error('GET story-product-links error:', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/dashboard/story-product-links
 * Create a manual link. IG → story_media_id; FB → active_hours (pin window).
 */
export async function POST(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = createStoryLinkSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Буруу өгөгдөл', details: parsed.error.issues.map(i => i.message) },
                { status: 400 }
            );
        }

        const input = parsed.data;

        // Guard: the product must belong to THIS shop (avoid linking another
        // shop's product id). Note RLS does NOT scope these writes — they run
        // through the service-role client — so shop ownership is enforced by
        // getShopId (header verified above) plus this explicit product check.
        const supabase = supabaseAdmin();
        const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('id', input.product_id)
            .eq('shop_id', shopId)
            .maybeSingle();
        if (!product) {
            return NextResponse.json({ error: 'Бараа олдсонгүй' }, { status: 400 });
        }

        const active_until = input.platform === 'facebook' && input.active_hours
            ? new Date(Date.now() + input.active_hours * 3600 * 1000).toISOString()
            : null;

        const link = await createStoryLink(shopId, {
            product_id: input.product_id,
            platform: input.platform,
            story_media_id: input.story_media_id,
            media_url: input.media_url,
            caption: input.caption,
            active_until,
        });

        if (!link) {
            return NextResponse.json({ error: 'Холбоос үүсгэж чадсангүй' }, { status: 500 });
        }

        return NextResponse.json({ link }, { status: 201 });
    } catch (error: unknown) {
        logger.error('POST story-product-links error:', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/dashboard/story-product-links?id={id}
 * Delete a link by id, scoped to the authenticated shop.
 */
export async function DELETE(request: NextRequest) {
    try {
        const shopId = await getShopId(request);
        if (!shopId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });
        }

        const success = await deleteStoryLink(id, shopId);
        if (!success) {
            return NextResponse.json({ error: 'Устгаж чадсангүй' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        logger.error('DELETE story-product-links error:', { error });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
