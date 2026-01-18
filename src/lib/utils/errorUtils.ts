/**
 * Error Utilities - Helper functions for type-safe error handling
 */

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}

/**
 * Extract error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.stack;
    }
    return undefined;
}

/**
 * Extract error name from unknown error
 */
export function getErrorName(error: unknown): string {
    if (error instanceof Error) {
        return error.name;
    }
    return 'UnknownError';
}

/**
 * Create a full error details object for logging
 */
export function getErrorDetails(error: unknown): {
    message: string;
    name: string;
    stack?: string;
} {
    return {
        message: getErrorMessage(error),
        name: getErrorName(error),
        stack: getErrorStack(error),
    };
}

/**
 * Type guard for API error response
 */
export interface APIErrorResponse {
    statusCode?: number;
    code?: string;
    message?: string;
}

export function isAPIError(error: unknown): error is APIErrorResponse {
    return (
        typeof error === 'object' &&
        error !== null &&
        ('statusCode' in error || 'code' in error)
    );
}
