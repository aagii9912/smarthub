/**
 * Error Handler Unit Tests
 * Tests for global error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    AppError,
    Errors,
    createErrorResponse,
    tryCatch,
    assert,
    assertDefined,
} from '@/lib/errors/errorHandler';

// Mock dependencies
vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('@/lib/monitoring/errorMonitoring', () => ({
    captureException: vi.fn(),
}));

describe('ErrorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('AppError', () => {
        it('should create error with correct properties', () => {
            const error = new AppError('Test error', 'VALIDATION_ERROR', 400);

            expect(error.message).toBe('Test error');
            expect(error.type).toBe('VALIDATION_ERROR');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(true);
        });

        it('should use default status code for error type', () => {
            const error = new AppError('Not found', 'NOT_FOUND_ERROR');
            expect(error.statusCode).toBe(404);
        });

        it('should include context when provided', () => {
            const error = new AppError('Error', 'INTERNAL_ERROR', 500, { userId: '123' });
            expect(error.context).toEqual({ userId: '123' });
        });
    });

    describe('Errors factory', () => {
        it('should create validation error', () => {
            const error = Errors.validation('Invalid input');
            expect(error.type).toBe('VALIDATION_ERROR');
            expect(error.statusCode).toBe(400);
        });

        it('should create unauthorized error', () => {
            const error = Errors.unauthorized();
            expect(error.type).toBe('AUTHENTICATION_ERROR');
            expect(error.statusCode).toBe(401);
        });

        it('should create forbidden error', () => {
            const error = Errors.forbidden();
            expect(error.type).toBe('AUTHORIZATION_ERROR');
            expect(error.statusCode).toBe(403);
        });

        it('should create not found error', () => {
            const error = Errors.notFound('Product');
            expect(error.type).toBe('NOT_FOUND_ERROR');
            expect(error.message).toContain('Product');
        });

        it('should create rate limit error', () => {
            const error = Errors.rateLimit();
            expect(error.type).toBe('RATE_LIMIT_ERROR');
            expect(error.statusCode).toBe(429);
        });

        it('should create external service error', () => {
            const error = Errors.externalService('Facebook', 'API timeout');
            expect(error.type).toBe('EXTERNAL_SERVICE_ERROR');
            expect(error.message).toContain('Facebook');
        });
    });

    describe('tryCatch', () => {
        it('should return result on success', async () => {
            const result = await tryCatch(
                async () => 'success',
                'fallback'
            );
            expect(result).toBe('success');
        });

        it('should return fallback on error', async () => {
            const result = await tryCatch(
                async () => { throw new Error('Fail'); },
                'fallback'
            );
            expect(result).toBe('fallback');
        });

        it('should work with complex fallback values', async () => {
            const fallback = { items: [], total: 0 };
            const result = await tryCatch(
                async () => { throw new Error('Fail'); },
                fallback
            );
            expect(result).toEqual(fallback);
        });
    });

    describe('assert', () => {
        it('should not throw when condition is true', () => {
            expect(() => assert(true, 'Should not throw')).not.toThrow();
        });

        it('should throw AppError when condition is false', () => {
            expect(() => assert(false, 'Condition failed')).toThrow(AppError);
        });

        it('should throw with correct error type', () => {
            try {
                assert(false, 'Auth failed', 'AUTHENTICATION_ERROR');
            } catch (error) {
                expect(error).toBeInstanceOf(AppError);
                expect((error as AppError).type).toBe('AUTHENTICATION_ERROR');
            }
        });
    });

    describe('assertDefined', () => {
        it('should not throw for defined values', () => {
            expect(() => assertDefined('value', 'Param')).not.toThrow();
            expect(() => assertDefined(0, 'Param')).not.toThrow();
            expect(() => assertDefined(false, 'Param')).not.toThrow();
        });

        it('should throw for null', () => {
            expect(() => assertDefined(null, 'userId')).toThrow(AppError);
        });

        it('should throw for undefined', () => {
            expect(() => assertDefined(undefined, 'shopId')).toThrow(AppError);
        });

        it('should include param name in error message', () => {
            try {
                assertDefined(null, 'orderId');
            } catch (error) {
                expect((error as AppError).message).toContain('orderId');
            }
        });
    });
});
