/**
 * Redis Cache Layer
 * 
 * Provides caching for AI responses, intent detection, and cart locks.
 * Falls back gracefully when Redis is unavailable.
 */

import { getRedisClient } from './client';
import { logger } from '@/lib/utils/logger';

// ==============================
// AI Response Cache
// ==============================

/**
 * Cache an AI response for a given prompt hash.
 * Used to avoid duplicate AI calls for identical queries within a shop context.
 */
export async function cacheAIResponse(
    shopId: string,
    promptHash: string,
    response: string,
    ttlSeconds: number = 300 // 5 minutes
): Promise<void> {
    try {
        const redis = getRedisClient();
        const key = `ai:cache:${shopId}:${promptHash}`;
        await redis.set(key, response, { ex: ttlSeconds });
    } catch (err) {
        logger.debug('AI cache set failed (non-critical)', { error: String(err) });
    }
}

/**
 * Get a cached AI response.
 */
export async function getCachedAIResponse(
    shopId: string,
    promptHash: string
): Promise<string | null> {
    try {
        const redis = getRedisClient();
        const key = `ai:cache:${shopId}:${promptHash}`;
        return await redis.get(key);
    } catch {
        return null;
    }
}

// ==============================
// Intent Cache
// ==============================

/**
 * Cache an intent detection result.
 * Same message pattern → same intent (avoids redundant classification).
 */
export async function cacheIntent(
    messageHash: string,
    intent: string,
    confidence: number,
    ttlSeconds: number = 300 // 5 minutes
): Promise<void> {
    try {
        const redis = getRedisClient();
        const key = `intent:${messageHash}`;
        await redis.set(key, JSON.stringify({ intent, confidence }), { ex: ttlSeconds });
    } catch {
        // Non-critical
    }
}

/**
 * Get a cached intent result.
 */
export async function getCachedIntent(
    messageHash: string
): Promise<{ intent: string; confidence: number } | null> {
    try {
        const redis = getRedisClient();
        const key = `intent:${messageHash}`;
        const cached = await redis.get(key);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch {
        // Non-critical
    }
    return null;
}

// ==============================
// Cart Lock (Distributed)
// ==============================

/**
 * Acquire a cart lock to prevent concurrent modifications.
 * Returns true if lock was acquired.
 */
export async function acquireCartLock(
    cartId: string,
    ttlSeconds: number = 30
): Promise<boolean> {
    try {
        const redis = getRedisClient();
        const key = `cart:lock:${cartId}`;
        const existing = await redis.get(key);
        if (existing) return false; // Already locked
        await redis.set(key, Date.now().toString(), { ex: ttlSeconds });
        return true;
    } catch {
        // If Redis unavailable, allow operation (no distributed lock)
        return true;
    }
}

/**
 * Release a cart lock.
 */
export async function releaseCartLock(cartId: string): Promise<void> {
    try {
        const redis = getRedisClient();
        await redis.del(`cart:lock:${cartId}`);
    } catch {
        // Non-critical
    }
}

// ==============================
// Session Cache
// ==============================

/**
 * Cache user session data to avoid repeated DB lookups.
 */
export async function cacheSession(
    userId: string,
    data: Record<string, unknown>,
    ttlSeconds: number = 86400 // 24 hours
): Promise<void> {
    try {
        const redis = getRedisClient();
        const key = `session:${userId}`;
        await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
    } catch {
        // Non-critical
    }
}

export async function getCachedSession(
    userId: string
): Promise<Record<string, unknown> | null> {
    try {
        const redis = getRedisClient();
        const key = `session:${userId}`;
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached);
    } catch {
        // Non-critical
    }
    return null;
}

export async function invalidateSession(userId: string): Promise<void> {
    try {
        const redis = getRedisClient();
        await redis.del(`session:${userId}`);
    } catch {
        // Non-critical
    }
}

// ==============================
// Hash utility
// ==============================

/**
 * Simple hash for cache keys. Fast, non-cryptographic.
 */
export function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
