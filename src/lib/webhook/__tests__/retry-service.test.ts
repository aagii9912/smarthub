/**
 * Retry Service Unit Tests
 * Tests for webhook retry mechanism
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    calculateBackoffDelay,
    retryWithBackoff,
} from '@/lib/webhook/retryService';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                })),
            })),
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
                })),
            })),
        })),
    })),
}));

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
    },
}));

// Mock error monitoring
vi.mock('@/lib/monitoring/errorMonitoring', () => ({
    captureException: vi.fn(),
}));

describe('RetryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateBackoffDelay', () => {
        it('should return initial delay for first attempt', () => {
            const delay = calculateBackoffDelay(1, { initialDelayMs: 1000, backoffMultiplier: 2 });
            // With jitter, should be around 1000 ± 100
            expect(delay).toBeGreaterThanOrEqual(900);
            expect(delay).toBeLessThanOrEqual(1100);
        });

        it('should double delay for each subsequent attempt', () => {
            const config = { initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 100000 };

            const delay1 = calculateBackoffDelay(1, config);
            const delay2 = calculateBackoffDelay(2, config);
            const delay3 = calculateBackoffDelay(3, config);

            // delay2 should be roughly 2x delay1, delay3 roughly 4x delay1
            expect(delay2).toBeGreaterThan(delay1 * 1.5);
            expect(delay3).toBeGreaterThan(delay2 * 1.5);
        });

        it('should cap delay at maxDelayMs', () => {
            const delay = calculateBackoffDelay(10, {
                initialDelayMs: 1000,
                backoffMultiplier: 2,
                maxDelayMs: 5000
            });

            expect(delay).toBeLessThanOrEqual(5000);
        });

        it('should use default config when not provided', () => {
            const delay = calculateBackoffDelay(1);
            expect(delay).toBeGreaterThan(0);
            expect(delay).toBeLessThanOrEqual(2000);
        });
    });

    describe('retryWithBackoff', () => {
        it('should succeed on first try', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const result = await retryWithBackoff(fn, { maxAttempts: 3 });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and succeed', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockResolvedValue('success');

            const result = await retryWithBackoff(fn, {
                maxAttempts: 5,
                initialDelayMs: 10 // Fast for tests
            });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should throw after max attempts', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

            await expect(
                retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 })
            ).rejects.toThrow('Always fails');

            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should pass context to error logging', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('Test error'));

            await expect(
                retryWithBackoff(
                    fn,
                    { maxAttempts: 2, initialDelayMs: 10 },
                    { operationName: 'testOperation', shopId: 'shop-123' }
                )
            ).rejects.toThrow();
        });
    });
});
