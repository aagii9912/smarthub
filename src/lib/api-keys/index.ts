/**
 * Public API key helpers.
 *
 * Гуравдагч талын `/api/v1/*` маршрутуудыг баталгаажуулахад ашиглагдана.
 * Түлхүүрийн PLAINTEXT-ийг DB-д хадгалдаггүй — зөвхөн SHA-256 hash-аар
 * хадгалж, ирсэн түлхүүрийг hash хийж lookup хийнэ.
 *
 * Формат: `sk_live_<base64url(24 random bytes)>`
 */

import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

const KEY_PREFIX = 'sk_live_';
/** Жагсаалтад харуулах таних хэсгийн урт (prefix + эхний хэдэн тэмдэгт). */
const DISPLAY_PREFIX_LEN = KEY_PREFIX.length + 6;

export interface GeneratedApiKey {
    /** Бүтэн түлхүүр — зөвхөн үүсгэх агшинд буцаана, дахин харуулахгүй. */
    plaintext: string;
    /** DB-д хадгалах SHA-256 (hex). */
    hash: string;
    /** Жагсаалтад таних prefix (ж: "sk_live_a1b2c3"). */
    prefix: string;
}

/** Бүтэн түлхүүрийг SHA-256 (hex) болгоно. Lookup ба хадгалалт хоёуланд ашиглана. */
export function hashApiKey(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
}

/** Шинэ API key үүсгэнэ. `plaintext`-ийг зөвхөн энэ агшинд буцаана. */
export function generateApiKey(): GeneratedApiKey {
    const random = randomBytes(24).toString('base64url');
    const plaintext = `${KEY_PREFIX}${random}`;
    return {
        plaintext,
        hash: hashApiKey(plaintext),
        prefix: plaintext.slice(0, DISPLAY_PREFIX_LEN),
    };
}

/** Хүсэлтээс түлхүүрийг унших — `Authorization: Bearer` эсвэл `x-api-key`. */
export function extractApiKey(request: NextRequest | Request): string | null {
    const auth = request.headers.get('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
        const token = auth.slice(7).trim();
        if (token) return token;
    }
    const headerKey = request.headers.get('x-api-key');
    if (headerKey && headerKey.trim()) return headerKey.trim();
    return null;
}

export interface ResolvedApiKey {
    keyId: string;
    shopId: string;
    /** Дэлгүүрийн эзний user_id (token metering зөв pool руу орно). */
    userId: string;
}

/**
 * Хүсэлтийн API key-г шалгаж, дэлгүүр + эзнийг resolve хийнэ.
 *
 * Цуцлагдсан (`revoked_at`) эсвэл хугацаа дууссан (`expires_at`) түлхүүрийг
 * `null` буцаана. Амжилттай бол `last_used_at`-г шинэчилнэ (блоклохгүй).
 */
export async function resolveApiKey(
    request: NextRequest | Request,
): Promise<ResolvedApiKey | null> {
    const plaintext = extractApiKey(request);
    if (!plaintext) return null;

    const hash = hashApiKey(plaintext);
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
        .from('api_keys')
        .select('id, shop_id, user_id, revoked_at, expires_at')
        .eq('key_hash', hash)
        .maybeSingle();

    if (error) {
        logger.error('resolveApiKey lookup error', { error });
        return null;
    }
    if (!data) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
        return null;
    }

    // last_used_at-г шинэчилнэ (fire-and-forget — хариу хойшлуулахгүй).
    void supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(({ error: updErr }) => {
            if (updErr) logger.warn('resolveApiKey last_used_at update failed', { error: updErr });
        });

    return {
        keyId: data.id as string,
        shopId: data.shop_id as string,
        userId: data.user_id as string,
    };
}
