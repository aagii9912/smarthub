/**
 * GET  /api/dashboard/api-keys — тухайн дэлгүүрийн API key-үүдийг жагсаана
 * POST /api/dashboard/api-keys — шинэ API key үүсгэнэ (plaintext-г ганц удаа буцаана)
 *
 * Session-auth (`getAuthUserShopAccess` + `x-shop-id`). API key-г удирдах нь
 * эмзэг үйлдэл тул `settings:write` эрх шаардана (owner / admin).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, ForbiddenError } from '@/lib/auth/membership';
import { supabaseAdmin } from '@/lib/supabase';
import { generateApiKey } from '@/lib/api-keys';
import { logger } from '@/lib/utils/logger';

function handleError(error: unknown) {
    if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('API keys route error', { error });
    return NextResponse.json({ error: 'Серверийн алдаа гарлаа' }, { status: 500 });
}

const createSchema = z.object({
    name: z.string().trim().min(1, 'Нэр шаардлагатай').max(60, 'Нэр хэт урт байна'),
});

// GET — жагсаалт (hash/plaintext БУЦААХГҮЙ)
export async function GET() {
    try {
        const { shop } = await requirePermission('settings:write');
        const supabase = supabaseAdmin();

        const { data, error } = await supabase
            .from('api_keys')
            .select('id, name, key_prefix, last_used_at, revoked_at, expires_at, created_at')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ keys: data ?? [] });
    } catch (error) {
        return handleError(error);
    }
}

// POST — шинэ key үүсгэх. Бүтэн түлхүүрийг ганц удаа буцаана.
export async function POST(request: Request) {
    try {
        const { shop } = await requirePermission('settings:write');

        const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? 'Буруу өгөгдөл' },
                { status: 400 },
            );
        }

        const supabase = supabaseAdmin();

        // Эзний user_id-г авна (token metering эзний pool руу орох ёстой тул
        // shops.user_id-г ашиглана — key үүсгэсэн гишүүн биш).
        const { data: shopRow, error: shopErr } = await supabase
            .from('shops')
            .select('user_id')
            .eq('id', shop.id)
            .single();
        if (shopErr) throw shopErr;
        const ownerId = (shopRow as { user_id?: string | null }).user_id;
        if (!ownerId) {
            return NextResponse.json({ error: 'Дэлгүүрийн эзэн олдсонгүй' }, { status: 400 });
        }

        const generated = generateApiKey();

        const { data, error } = await supabase
            .from('api_keys')
            .insert({
                shop_id: shop.id,
                user_id: ownerId,
                name: parsed.data.name,
                key_prefix: generated.prefix,
                key_hash: generated.hash,
            })
            .select('id, name, key_prefix, created_at')
            .single();

        if (error) throw error;

        // `key` (plaintext)-г ЗӨВХӨН ЭНД буцаана — дахин авах боломжгүй.
        return NextResponse.json({ ...data, key: generated.plaintext }, { status: 201 });
    } catch (error) {
        return handleError(error);
    }
}
