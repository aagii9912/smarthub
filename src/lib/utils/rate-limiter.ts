/**
 * Rate Limiter Utility
 * In-memory rate limiting for API protection
 * 
 * Note: For production scale, use Redis-based rate limiting
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store (for single-instance deployments)
// For production: Replace with Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configs for different route types
export const RATE_LIMIT_CONFIGS = {
    // Strict: AI/Chat endpoints (expensive operations)
    strict: { windowMs: 60000, maxRequests: 20 },

    // Standard: Regular API endpoints
    standard: { windowMs: 60000, maxRequests: 100 },

    // Relaxed: Public/read-only endpoints
    relaxed: { windowMs: 60000, maxRequests: 200 },

    // Webhook: External service callbacks
    webhook: { windowMs: 60000, maxRequests: 500 },
} as const;

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard
): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
        cleanupExpiredEntries();
    }

    if (!entry || now > entry.resetAt) {
        // New window
        const newEntry: RateLimitEntry = {
            count: 1,
            resetAt: now + config.windowMs,
        };
        rateLimitStore.set(key, newEntry);
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt: newEntry.resetAt,
        };
    }

    // Existing window
    if (entry.count >= config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
        };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt,
    };
}

/**
 * Clean up expired entries from memory
 */
function cleanupExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetAt) {
            rateLimitStore.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.debug('Rate limit cleanup', { entriesRemoved: cleaned });
    }
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: Request): string {
    // Try to get real IP from headers (behind proxy/load balancer)
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnecting = req.headers.get('cf-connecting-ip'); // Cloudflare

    const ip = forwarded?.split(',')[0]?.trim()
        || realIp
        || cfConnecting
        || 'unknown';

    return ip;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(resetAt: number): NextResponse {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    return NextResponse.json(
        {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter,
        },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
            },
        }
    );
}

/**
 * Rate limit middleware helper for API routes
 */
export function withRateLimit(
    handler: (req: Request) => Promise<NextResponse>,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.standard
) {
    return async (req: Request): Promise<NextResponse> => {
        const clientId = getClientIdentifier(req);
        const url = new URL(req.url);
        const key = `${clientId}:${url.pathname}`;

        const { allowed, remaining, resetAt } = checkRateLimit(key, config);

        if (!allowed) {
            logger.warn('Rate limit exceeded', { clientId, path: url.pathname });
            return createRateLimitResponse(resetAt);
        }

        const response = await handler(req);

        // Add rate limit headers
        response.headers.set('X-RateLimit-Remaining', String(remaining));
        response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

        return response;
    };
}

/**
 * Check rate limit in middleware (for edge runtime)
 */
export function checkMiddlewareRateLimit(
    req: Request,
    routeType: keyof typeof RATE_LIMIT_CONFIGS = 'standard'
): { allowed: boolean; response?: NextResponse } {
    const clientId = getClientIdentifier(req);
    const url = new URL(req.url);
    const key = `${clientId}:${routeType}`;

    const config = RATE_LIMIT_CONFIGS[routeType];
    const { allowed, resetAt } = checkRateLimit(key, config);

    if (!allowed) {
        logger.warn('Rate limit exceeded in middleware', {
            clientId,
            path: url.pathname,
            routeType
        });
        return {
            allowed: false,
            response: createRateLimitResponse(resetAt)
        };
    }

    return { allowed: true };
}
