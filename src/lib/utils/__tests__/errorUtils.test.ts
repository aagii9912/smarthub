/**
 * Tests for type-safe error helpers used across API routes / logging.
 */
import { describe, it, expect } from 'vitest';
import {
    getErrorMessage,
    getErrorStack,
    getErrorName,
    getErrorDetails,
    isAPIError,
} from '@/lib/utils/errorUtils';

describe('getErrorMessage', () => {
    it('returns .message for Error instances', () => {
        expect(getErrorMessage(new Error('boom'))).toBe('boom');
    });
    it('returns the string itself for string errors', () => {
        expect(getErrorMessage('plain failure')).toBe('plain failure');
    });
    it('falls back to "Unknown error" for other types', () => {
        expect(getErrorMessage(null)).toBe('Unknown error');
        expect(getErrorMessage({ weird: true })).toBe('Unknown error');
        expect(getErrorMessage(42)).toBe('Unknown error');
    });
});

describe('getErrorStack', () => {
    it('returns a stack for Error instances', () => {
        expect(getErrorStack(new Error('x'))).toContain('Error');
    });
    it('returns undefined for non-errors', () => {
        expect(getErrorStack('nope')).toBeUndefined();
    });
});

describe('getErrorName', () => {
    it('returns the Error name', () => {
        expect(getErrorName(new TypeError('t'))).toBe('TypeError');
    });
    it('returns "UnknownError" for non-errors', () => {
        expect(getErrorName('nope')).toBe('UnknownError');
    });
});

describe('getErrorDetails', () => {
    it('bundles message, name, and stack for an Error', () => {
        const details = getErrorDetails(new RangeError('out of range'));
        expect(details.message).toBe('out of range');
        expect(details.name).toBe('RangeError');
        expect(details.stack).toContain('RangeError');
    });
    it('produces safe defaults for a non-error', () => {
        const details = getErrorDetails(123);
        expect(details).toEqual({
            message: 'Unknown error',
            name: 'UnknownError',
            stack: undefined,
        });
    });
});

describe('isAPIError', () => {
    it('is true when statusCode or code is present', () => {
        expect(isAPIError({ statusCode: 404 })).toBe(true);
        expect(isAPIError({ code: 'PGRST116' })).toBe(true);
    });
    it('is false for plain objects without those keys', () => {
        expect(isAPIError({ message: 'hi' })).toBe(false);
    });
    it('is false for null / primitives', () => {
        expect(isAPIError(null)).toBe(false);
        expect(isAPIError('err')).toBe(false);
        expect(isAPIError(undefined)).toBe(false);
    });
});
