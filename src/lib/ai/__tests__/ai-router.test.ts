
import { describe, it, expect } from 'vitest';
import {
    getPlanTypeFromSubscription,
    checkMessageLimit,
    getEnabledToolsForPlan,
    PLAN_CONFIGS
} from '../config/plans';

describe('AIRouter', () => {
    describe('getPlanTypeFromSubscription', () => {
        it('should return starter for undefined subscription', () => {
            const result = getPlanTypeFromSubscription({} as any);
            expect(result).toBe('starter');
        });

        it('should return starter for inactive subscription', () => {
            const result = getPlanTypeFromSubscription({
                plan: 'pro',
                status: 'inactive'
            });
            expect(result).toBe('starter');
        });

        it('should return correct plan for active subscription', () => {
            expect(getPlanTypeFromSubscription({ plan: 'pro', status: 'active' })).toBe('pro');
            expect(getPlanTypeFromSubscription({ plan: 'enterprise', status: 'active' })).toBe('enterprise');
        });

        it('should return starter for unknown plan', () => {
            const result = getPlanTypeFromSubscription({
                plan: 'unknown',
                status: 'active'
            });
            expect(result).toBe('starter');
        });
    });

    describe('checkMessageLimit', () => {
        it('should allow messages within limit', () => {
            expect(checkMessageLimit('starter', 10).allowed).toBe(true);
            expect(checkMessageLimit('pro', 500).allowed).toBe(true);
        });

        it('should block messages over limit', () => {
            const starterLimit = PLAN_CONFIGS.starter.messagesPerMonth;
            expect(checkMessageLimit('starter', starterLimit).allowed).toBe(false);
            expect(checkMessageLimit('starter', starterLimit + 1).allowed).toBe(false);
        });

        it('should always allow enterprise messages', () => {
            expect(checkMessageLimit('enterprise', 1000).allowed).toBe(true);
        });
    });

    describe('getEnabledToolsForPlan', () => {
        it('should return correct tools for starter', () => {
            const tools = getEnabledToolsForPlan('starter');
            expect(tools).toContain('add_to_cart');
            expect(tools).toContain('show_product_image');
            expect(tools).not.toContain('checkout');
        });

        it('should return correct tools for pro', () => {
            const tools = getEnabledToolsForPlan('pro');
            expect(tools).toContain('add_to_cart');
            expect(tools).toContain('checkout');
            expect(tools).not.toContain('check_payment_status');
        });

        it('should return all tools for enterprise', () => {
            const tools = getEnabledToolsForPlan('enterprise');
            expect(tools).toContain('checkout');
            expect(tools).toContain('check_payment_status');
        });
    });
});
