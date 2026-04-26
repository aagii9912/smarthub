/**
 * QPay webhook signature validation tests.
 *
 * Focus: constant-time comparison correctness, edge cases around
 * malformed input that could previously throw or leak timing info.
 */

import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/utils/circuit-breaker', () => ({
    getBreaker: () => ({
        execute: (fn: () => unknown) => fn(),
        recordSuccess: vi.fn(),
        recordFailure: vi.fn(),
    }),
}));

import { validateWebhookSignature } from '@/lib/payment/qpay';

const makeSig = (payload: string, secret: string) =>
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('validateWebhookSignature', () => {
    const secret = 'super-secret';
    const payload = '{"invoice_id":"abc","amount":100}';

    it('returns true for a valid signature', () => {
        const sig = makeSig(payload, secret);
        expect(validateWebhookSignature(payload, sig, secret)).toBe(true);
    });

    it('returns false for a wrong signature of the same length', () => {
        const sig = makeSig(payload, secret);
        // Flip the final hex character — same length, different value.
        const bad = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
        expect(validateWebhookSignature(payload, bad, secret)).toBe(false);
    });

    it('returns false for a signature with a different length without throwing', () => {
        // timingSafeEqual throws on length mismatch — we pre-check length.
        expect(validateWebhookSignature(payload, 'short', secret)).toBe(false);
    });

    it('returns false for an empty signature', () => {
        expect(validateWebhookSignature(payload, '', secret)).toBe(false);
    });

    it('returns false when secret is wrong', () => {
        const sig = makeSig(payload, 'different-secret');
        expect(validateWebhookSignature(payload, sig, secret)).toBe(false);
    });

    it('returns false for malformed (non-hex) signature without throwing', () => {
        const junk = '!@#$%^&*()_+'.repeat(5);
        expect(validateWebhookSignature(payload, junk, secret)).toBe(false);
    });
});
