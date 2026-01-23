
import { describe, it, expect } from 'vitest';
import {
    getPlanTypeFromSubscription,
    checkMessageLimit,
    getEnabledToolsForPlan,
    PLAN_CONFIGS
} from '../AIRouter';

describe('AIRouter', () => {
    describe('getPlanTypeFromSubscription', () => {
        it('should return starter for undefined subscription', () => {
            const result = getPlanTypeFromSubscription({} as any);
            expect(result).toBe('starter');
        });

        it('should return trial for inactive subscription', () => {
            const result = getPlanTypeFromSubscription({
                plan: 'pro',
                status: 'inactive'
            });
            expect(result).toBe('trial');
        });

        it('should return correct plan for active subscription', () => {
            expect(getPlanTypeFromSubscription({ plan: 'pro', status: 'active' })).toBe('pro');
            expect(getPlanTypeFromSubscription({ plan: 'ultimate', status: 'active' })).toBe('ultimate');
        });

        it('should return starter for expired trial', () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const result = getPlanTypeFromSubscription({
                plan: 'ultimate',
                status: 'trial',
                trial_ends_at: pastDate.toISOString()
            });
            expect(result).toBe('starter');
        });

        it('should return trial for active trial', () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const result = getPlanTypeFromSubscription({
                plan: 'ultimate',
                status: 'trial',
                trial_ends_at: futureDate.toISOString()
            });
            expect(result).toBe('trial');
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

        it('should always allow ultimate messages', () => {
            expect(checkMessageLimit('ultimate', 1000).allowed).toBe(true);
        });
    });

    describe('getEnabledToolsForPlan', () => {
        it('should return correct tools for starter', () => {
            const tools = getEnabledToolsForPlan('starter');
            // Starter tools: add_to_cart, view_cart, show_product_image, collect_contact_info
            expect(tools).toContain('add_to_cart');
            expect(tools).toContain('show_product_image');
            expect(tools).not.toContain('checkout'); // Pro feature
        });

        it('should return correct tools for pro', () => {
            const tools = getEnabledToolsForPlan('pro');
            expect(tools).toContain('add_to_cart');
            expect(tools).toContain('checkout');
            expect(tools).not.toContain('check_payment_status'); // Ultimate feature
        });

        it('should return all tools for ultimate', () => {
            const tools = getEnabledToolsForPlan('ultimate');
            expect(tools).toContain('checkout');
            expect(tools).toContain('check_payment_status');
        });
    });
});
