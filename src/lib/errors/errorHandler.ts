/**
 * Global Error Handler
 * Centralized error handling with consistent responses
 */

import { NextResponse } from 'next/server';
import { captureException } from '@/lib/monitoring/errorMonitoring';
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errorUtils';
import { logger } from '@/lib/utils/logger';

/**
 * Error types for categorization
 */
export type ErrorType =
    | 'VALIDATION_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    | 'NOT_FOUND_ERROR'
    | 'RATE_LIMIT_ERROR'
    | 'EXTERNAL_SERVICE_ERROR'
    | 'DATABASE_ERROR'
    | 'INTERNAL_ERROR';

/**
 * Application error with type information
 */
export class AppError extends Error {
    public readonly type: ErrorType;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        type: ErrorType = 'INTERNAL_ERROR',
        statusCode?: number,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.statusCode = statusCode ?? this.getDefaultStatusCode(type);
        this.isOperational = true;
        this.context = context;

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    private getDefaultStatusCode(type: ErrorType): number {
        const statusCodes: Record<ErrorType, number> = {
            VALIDATION_ERROR: 400,
            AUTHENTICATION_ERROR: 401,
            AUTHORIZATION_ERROR: 403,
            NOT_FOUND_ERROR: 404,
            RATE_LIMIT_ERROR: 429,
            EXTERNAL_SERVICE_ERROR: 502,
            DATABASE_ERROR: 503,
            INTERNAL_ERROR: 500,
        };
        return statusCodes[type];
    }
}

/**
 * Create common error types
 */
export const Errors = {
    validation: (message: string, context?: Record<string, unknown>) =>
        new AppError(message, 'VALIDATION_ERROR', 400, context),

    unauthorized: (message = 'Authentication required') =>
        new AppError(message, 'AUTHENTICATION_ERROR', 401),

    forbidden: (message = 'Access denied') =>
        new AppError(message, 'AUTHORIZATION_ERROR', 403),

    notFound: (resource: string) =>
        new AppError(`${resource} not found`, 'NOT_FOUND_ERROR', 404),

    rateLimit: (message = 'Too many requests') =>
        new AppError(message, 'RATE_LIMIT_ERROR', 429),

    externalService: (service: string, message: string) =>
        new AppError(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, { service }),

    database: (message: string) =>
        new AppError(message, 'DATABASE_ERROR', 503),

    internal: (message = 'Internal server error') =>
        new AppError(message, 'INTERNAL_ERROR', 500),
};

/**
 * Error response format
 */
interface ErrorResponse {
    success: false;
    error: {
        message: string;
        type: ErrorType;
        code: string;
    };
}

/**
 * Create error response for API routes
 */
export function createErrorResponse(error: unknown, shopId?: string): NextResponse<ErrorResponse> {
    // Determine error details
    let statusCode = 500;
    let errorType: ErrorType = 'INTERNAL_ERROR';
    let errorMessage = 'An unexpected error occurred';
    let shouldReport = true;

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        errorType = error.type;
        errorMessage = error.message;
        // Don't report operational errors to Sentry
        shouldReport = !error.isOperational;
    } else {
        const details = getErrorDetails(error);
        errorMessage = details.message;

        // Categorize by message patterns
        if (errorMessage.includes('not found')) {
            errorType = 'NOT_FOUND_ERROR';
            statusCode = 404;
            shouldReport = false;
        } else if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) {
            errorType = 'AUTHENTICATION_ERROR';
            statusCode = 401;
            shouldReport = false;
        } else if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
            errorType = 'AUTHORIZATION_ERROR';
            statusCode = 403;
            shouldReport = false;
        } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
            errorType = 'VALIDATION_ERROR';
            statusCode = 400;
            shouldReport = false;
        }
    }

    // Log the error
    logger.error(`[${errorType}] ${errorMessage}`, { statusCode, shopId });

    // Report to Sentry if warranted
    if (shouldReport) {
        captureException(error, { shopId, action: 'api_error' });
    }

    // Build response
    const response: ErrorResponse = {
        success: false,
        error: {
            message: process.env.NODE_ENV === 'production' && statusCode === 500
                ? 'An unexpected error occurred. Please try again later.'
                : errorMessage,
            type: errorType,
            code: `E_${errorType}`,
        },
    };

    return NextResponse.json(response, { status: statusCode });
}

/**
 * Wrap API route handler with error catching
 */
export function withErrorHandler<T>(
    handler: () => Promise<NextResponse<T>>,
    context?: { shopId?: string }
): Promise<NextResponse<T | ErrorResponse>> {
    return handler().catch((error) => {
        return createErrorResponse(error, context?.shopId);
    });
}

/**
 * Try-catch wrapper for async operations
 */
export async function tryCatch<T>(
    operation: () => Promise<T>,
    fallback: T,
    context?: { action?: string; shopId?: string }
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        logger.error(`Operation failed: ${context?.action || 'unknown'}`, {
            error: getErrorMessage(error),
        });

        captureException(error, {
            action: context?.action,
            shopId: context?.shopId,
        }, 'warning');

        return fallback;
    }
}

/**
 * Assert condition or throw error
 */
export function assert(
    condition: unknown,
    message: string,
    errorType: ErrorType = 'VALIDATION_ERROR'
): asserts condition {
    if (!condition) {
        throw new AppError(message, errorType);
    }
}

/**
 * Assert value is defined
 */
export function assertDefined<T>(
    value: T | null | undefined,
    name: string
): asserts value is T {
    if (value === null || value === undefined) {
        throw new AppError(`${name} is required`, 'VALIDATION_ERROR');
    }
}
