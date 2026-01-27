/**
 * API Response Utilities
 * Standardized error and success response helpers
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';

const isDev = process.env.NODE_ENV === 'development';

interface ErrorResponseOptions {
    status?: number;
    code?: string;
    details?: string[];
}

/**
 * Create standardized error response
 * In development: includes full error details
 * In production: sanitized error message only
 */
export function apiError(
    message: string,
    error?: unknown,
    options: ErrorResponseOptions = {}
): NextResponse {
    const { status = 500, code, details } = options;

    // Log the full error
    logger.error(message, { error, code });

    // Build response
    const response: Record<string, unknown> = {
        error: message,
        success: false,
    };

    if (code) response.code = code;
    if (details) response.details = details;

    // In development, include more debugging info
    if (isDev && error) {
        response.debug = {
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
        };
    }

    return NextResponse.json(response, { status });
}

/**
 * Create standardized success response
 */
export function apiSuccess<T>(
    data: T,
    message?: string,
    status = 200
): NextResponse {
    return NextResponse.json({
        success: true,
        message,
        ...data,
    }, { status });
}

/**
 * Validation error response
 */
export function apiValidationError(errors: string[]): NextResponse {
    return apiError('Validation failed', null, {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: errors,
    });
}

/**
 * Unauthorized error response
 */
export function apiUnauthorized(message = 'Unauthorized'): NextResponse {
    return apiError(message, null, {
        status: 401,
        code: 'UNAUTHORIZED',
    });
}

/**
 * Not found error response
 */
export function apiNotFound(resource = 'Resource'): NextResponse {
    return apiError(`${resource} not found`, null, {
        status: 404,
        code: 'NOT_FOUND',
    });
}
