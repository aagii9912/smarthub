/**
 * Redis Client Abstraction
 * 
 * Uses Upstash Redis when configured (production),
 * falls back to in-memory Map (development/hobby tier).
 * 
 * Setup: npm install @upstash/redis
 * Env:   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { logger } from '@/lib/utils/logger';

// ==============================
// Type definitions
// ==============================
export interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, opts?: { ex?: number }): Promise<void>;
    incr(key: string): Promise<number>;
    del(key: string): Promise<void>;
    expire(key: string, seconds: number): Promise<void>;
    ttl(key: string): Promise<number>;
    isRedis: boolean; // true if backed by real Redis
}

// ==============================
// In-memory fallback
// ==============================
class InMemoryRedis implements RedisClient {
    private store = new Map<string, { value: string; expiresAt?: number }>();
    isRedis = false;

    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key: string, value: string, opts?: { ex?: number }): Promise<void> {
        this.store.set(key, {
            value,
            expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
        });
    }

    async incr(key: string): Promise<number> {
        const current = await this.get(key);
        const newValue = (parseInt(current || '0', 10) || 0) + 1;
        const entry = this.store.get(key);
        this.store.set(key, {
            value: String(newValue),
            expiresAt: entry?.expiresAt,
        });
        return newValue;
    }

    async del(key: string): Promise<void> {
        this.store.delete(key);
    }

    async expire(key: string, seconds: number): Promise<void> {
        const entry = this.store.get(key);
        if (entry) {
            entry.expiresAt = Date.now() + seconds * 1000;
        }
    }

    async ttl(key: string): Promise<number> {
        const entry = this.store.get(key);
        if (!entry || !entry.expiresAt) return -1;
        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    // Periodic cleanup
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}

// ==============================
// Upstash Redis wrapper
// ==============================
import type { Redis as UpstashRedis } from '@upstash/redis';

class UpstashRedisWrapper implements RedisClient {
    private client: UpstashRedis;
    isRedis = true;

    constructor(client: UpstashRedis) {
        this.client = client;
    }

    async get(key: string): Promise<string | null> {
        const result = await this.client.get(key);
        return result !== null && result !== undefined ? String(result) : null;
    }

    async set(key: string, value: string, opts?: { ex?: number }): Promise<void> {
        if (opts?.ex) {
            await this.client.set(key, value, { ex: opts.ex });
        } else {
            await this.client.set(key, value);
        }
    }

    async incr(key: string): Promise<number> {
        return await this.client.incr(key);
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }

    async ttl(key: string): Promise<number> {
        return await this.client.ttl(key);
    }
}

// ==============================
// Singleton initialization
// ==============================
let _redisClient: RedisClient | null = null;

export function getRedisClient(): RedisClient {
    if (_redisClient) return _redisClient;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
        try {
            // Direct require for Next.js compat
            const { Redis } = require('@upstash/redis');
            const upstashClient = new Redis({ url, token });
            logger.info('Redis client initialized (Upstash)');
            _redisClient = new UpstashRedisWrapper(upstashClient);
        } catch (e) {
            logger.error('Upstash Redis load failed, using in-memory fallback:', { error: String(e) });
            _redisClient = new InMemoryRedis();
        }
    } else {
        logger.debug('Redis env vars not set, using in-memory store');
        _redisClient = new InMemoryRedis();
    }

    return _redisClient;
}

/**
 * Convenience: check if real Redis is available
 */
export function isRedisAvailable(): boolean {
    return getRedisClient().isRedis;
}
