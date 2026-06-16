/**
 * Tests for the standardized API response helpers.
 *
 * These define the error contract every route returns ({ error, success, ... }).
 * Production responses must NOT leak stack traces; dev responses should.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), success: vi.fn() },
}));

import {
    apiError,
    apiSuccess,
    apiValidationError,
    apiUnauthorized,
    apiNotFound,
} from '@/lib/utils/api-response';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('apiError', () => {
    it('defaults to HTTP 500 with success:false', async () => {
        const res = apiError('Something broke');
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body).toMatchObject({ error: 'Something broke', success: false });
    });

    it('honors a custom status, code, and details', async () => {
        const res = apiError('Bad', null, { status: 422, code: 'X', details: ['a', 'b'] });
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.code).toBe('X');
        expect(body.details).toEqual(['a', 'b']);
    });

    it('omits debug info outside development', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = apiError('Hidden', new Error('secret stack'));
        const body = await res.json();
        expect(body.debug).toBeUndefined();
    });
});

describe('apiSuccess', () => {
    it('spreads data alongside success/message', async () => {
        const res = apiSuccess({ id: 7, items: [1, 2] }, 'ok');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ success: true, message: 'ok', id: 7, items: [1, 2] });
    });

    it('supports a custom status', () => {
        const res = apiSuccess({ created: true }, undefined, 201);
        expect(res.status).toBe(201);
    });
});

describe('typed error shortcuts', () => {
    it('apiValidationError → 400 VALIDATION_ERROR with details', async () => {
        const res = apiValidationError(['name required']);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.details).toEqual(['name required']);
    });

    it('apiUnauthorized → 401 UNAUTHORIZED', async () => {
        const res = apiUnauthorized();
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.code).toBe('UNAUTHORIZED');
    });

    it('apiNotFound → 404 with resource name in the message', async () => {
        const res = apiNotFound('Order');
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Order not found');
        expect(body.code).toBe('NOT_FOUND');
    });
});
