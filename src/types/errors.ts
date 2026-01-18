/**
 * Custom Error Classes
 * Structured error handling for better debugging and user feedback
 */

/**
 * Base application error
 */
export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public isOperational: boolean = true,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
        };
    }
}

/**
 * Validation error - for input validation failures
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', 400, true, details);
        this.name = 'ValidationError';
    }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        const message = id
            ? `${resource} with ID '${id}' not found`
            : `${resource} not found`;
        super(message, 'NOT_FOUND', 404, true, { resource, id });
        this.name = 'NotFoundError';
    }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 'AUTHENTICATION_ERROR', 401, true);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization error - user authenticated but not allowed
 */
export class AuthorizationError extends AppError {
    constructor(message: string = 'Not authorized to perform this action') {
        super(message, 'AUTHORIZATION_ERROR', 403, true);
        this.name = 'AuthorizationError';
    }
}

/**
 * AI service error
 */
export class AIError extends AppError {
    constructor(
        message: string,
        public provider: 'openai' | 'gemini',
        details?: Record<string, unknown>
    ) {
        super(message, 'AI_ERROR', 502, true, { provider, ...details });
        this.name = 'AIError';
    }
}

/**
 * Payment error
 */
export class PaymentError extends AppError {
    constructor(
        message: string,
        public provider: 'qpay' | 'socialpay',
        details?: Record<string, unknown>
    ) {
        super(message, 'PAYMENT_ERROR', 502, true, { provider, ...details });
        this.name = 'PaymentError';
    }
}

/**
 * Facebook API error
 */
export class FacebookError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'FACEBOOK_ERROR', 502, true, details);
        this.name = 'FacebookError';
    }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'DATABASE_ERROR', 500, false, details);
        this.name = 'DatabaseError';
    }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
    constructor(retryAfter?: number) {
        super('Too many requests', 'RATE_LIMIT_ERROR', 429, true, { retryAfter });
        this.name = 'RateLimitError';
    }
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Wrap unknown errors into AppError
 */
export function wrapError(error: unknown, defaultMessage: string = 'An unexpected error occurred'): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError(
            error.message || defaultMessage,
            'INTERNAL_ERROR',
            500,
            false,
            { originalError: error.name, stack: error.stack }
        );
    }

    return new AppError(defaultMessage, 'INTERNAL_ERROR', 500, false);
}
