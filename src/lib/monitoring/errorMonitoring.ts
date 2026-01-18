/**
 * Error Monitoring Service
 * Centralized error tracking with Sentry integration
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/utils/logger';
import { getErrorMessage, getErrorDetails } from '@/lib/utils/errorUtils';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Error context for tracking
 */
export interface ErrorContext {
    userId?: string;
    shopId?: string;
    customerId?: string;
    action?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Check if Sentry is configured
 */
function isSentryEnabled(): boolean {
    return !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production';
}

/**
 * Capture an exception with context
 */
export function captureException(
    error: unknown,
    context?: ErrorContext,
    severity: ErrorSeverity = 'error'
): void {
    const errorDetails = getErrorDetails(error);

    // Always log locally
    logger.error(`[${severity.toUpperCase()}] ${errorDetails.message}`, {
        ...errorDetails,
        ...context,
    });

    // Send to Sentry if configured
    if (isSentryEnabled()) {
        Sentry.withScope((scope) => {
            scope.setLevel(severity as Sentry.SeverityLevel);

            if (context?.userId) scope.setUser({ id: context.userId });
            if (context?.shopId) scope.setTag('shopId', context.shopId);
            if (context?.customerId) scope.setTag('customerId', context.customerId);
            if (context?.action) scope.setTag('action', context.action);
            if (context?.metadata) scope.setContext('metadata', context.metadata);

            if (error instanceof Error) {
                Sentry.captureException(error);
            } else {
                Sentry.captureMessage(errorDetails.message, severity as Sentry.SeverityLevel);
            }
        });
    }
}

/**
 * Capture a message (non-exception) event
 */
export function captureMessage(
    message: string,
    context?: ErrorContext,
    severity: ErrorSeverity = 'info'
): void {
    const logMethod = severity === 'fatal' || severity === 'error' ? 'error' : severity === 'warning' ? 'warn' : 'info';
    logger[logMethod](message, context ? { ...context } : undefined);

    if (isSentryEnabled()) {
        Sentry.withScope((scope) => {
            scope.setLevel(severity as Sentry.SeverityLevel);

            if (context?.shopId) scope.setTag('shopId', context.shopId);
            if (context?.action) scope.setTag('action', context.action);
            if (context?.metadata) scope.setContext('metadata', context.metadata);

            Sentry.captureMessage(message, severity as Sentry.SeverityLevel);
        });
    }
}

/**
 * Create a breadcrumb for tracking user journey
 */
export function addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level: ErrorSeverity = 'info'
): void {
    if (isSentryEnabled()) {
        Sentry.addBreadcrumb({
            category,
            message,
            data,
            level: level as Sentry.SeverityLevel,
        });
    }
}

/**
 * Set user context for error tracking
 */
export function setUser(userId: string, email?: string, username?: string): void {
    if (isSentryEnabled()) {
        Sentry.setUser({
            id: userId,
            email,
            username,
        });
    }
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
    if (isSentryEnabled()) {
        Sentry.setUser(null);
    }
}

/**
 * Wrap an async function with error tracking
 */
export async function withErrorTracking<T>(
    operation: () => Promise<T>,
    context: ErrorContext & { operationName: string }
): Promise<T> {
    const { operationName, ...errorContext } = context;

    addBreadcrumb('operation', `Starting: ${operationName}`, errorContext);

    try {
        const result = await operation();
        addBreadcrumb('operation', `Completed: ${operationName}`, errorContext);
        return result;
    } catch (error) {
        captureException(error, {
            ...errorContext,
            action: operationName,
        });
        throw error;
    }
}

/**
 * Create API error response with Sentry tracking
 */
export function handleAPIError(
    error: unknown,
    context?: ErrorContext
): { error: string; statusCode: number } {
    captureException(error, context);

    const message = getErrorMessage(error);

    // Determine status code based on error type
    let statusCode = 500;
    if (message.includes('not found')) statusCode = 404;
    if (message.includes('unauthorized') || message.includes('forbidden')) statusCode = 403;
    if (message.includes('invalid') || message.includes('validation')) statusCode = 400;

    return {
        error: process.env.NODE_ENV === 'production'
            ? 'An error occurred. Please try again later.'
            : message,
        statusCode,
    };
}
