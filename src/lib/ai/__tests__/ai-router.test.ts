
import { describe, it, expect } from 'vitest';
import {
    getPlanTypeFromSubscription,
    checkTokenLimit,
    checkCreditLimit,
    getCreditsPerMonth,
    tokensToCredits,
    creditsToTokens,
    TOKENS_PER_CREDIT,
    getEnabledToolsForPlan,
    PLAN_CONFIGS,
} from '../config/plans';

describe('AIRouter', () => {
    describe('getPlanTypeFromSubscription', () => {
        it('should return lite for undefined subscription', () => {
            const result = getPlanTypeFromSubscription({} as any);
            expect(result).toBe('lite');
        });

        it('should return lite for inactive subscription', () => {
            const result = getPlanTypeFromSubscription({
                plan: 'pro',
                status: 'inactive'
            });
            expect(result).toBe('lite');
        });

        it('should return correct plan for active subscription', () => {
            expect(getPlanTypeFromSubscription({ plan: 'lite', status: 'active' })).toBe('lite');
            expect(getPlanTypeFromSubscription({ plan: 'starter', status: 'active' })).toBe('starter');
            expect(getPlanTypeFromSubscription({ plan: 'pro', status: 'active' })).toBe('pro');
            expect(getPlanTypeFromSubscription({ plan: 'enterprise', status: 'active' })).toBe('enterprise');
        });

        it('should return lite for unknown plan', () => {
            const result = getPlanTypeFromSubscription({
                plan: 'unknown',
                status: 'active'
            });
            expect(result).toBe('lite');
        });

        it('should map aliases correctly', () => {
            expect(getPlanTypeFromSubscription({ plan: 'basic', status: 'active' })).toBe('lite');
            expect(getPlanTypeFromSubscription({ plan: 'chatbot', status: 'active' })).toBe('lite');
            expect(getPlanTypeFromSubscription({ plan: 'professional', status: 'active' })).toBe('pro');
        });
    });

    describe('credit helpers', () => {
        it('should convert tokens to credits (round up partial)', () => {
            expect(tokensToCredits(0)).toBe(0);
            expect(tokensToCredits(1)).toBe(1);
            expect(tokensToCredits(1000)).toBe(1);
            expect(tokensToCredits(1001)).toBe(2);
            expect(tokensToCredits(2_400_000)).toBe(2400);
        });

        it('should convert credits to tokens', () => {
            expect(creditsToTokens(0)).toBe(0);
            expect(creditsToTokens(100)).toBe(100 * TOKENS_PER_CREDIT);
            expect(creditsToTokens(2400)).toBe(2_400_000);
        });

        it('should derive creditsPerMonth from plan tokens', () => {
            expect(getCreditsPerMonth('lite')).toBe(1_000);
            expect(getCreditsPerMonth('starter')).toBe(2_400);
            expect(getCreditsPerMonth('pro')).toBe(12_000);
            expect(getCreditsPerMonth('enterprise')).toBe(100_000);
        });

        it('checkCreditLimit mirrors checkTokenLimit in credit units', () => {
            const half = PLAN_CONFIGS.starter.tokensPerMonth / 2;
            const cr = checkCreditLimit('starter', half);
            expect(cr.allowed).toBe(true);
            expect(cr.limit).toBe(2_400);
            expect(cr.used).toBe(1_200);
            expect(cr.remaining).toBe(1_200);
            expect(cr.usagePercent).toBe(50);
        });

        it('checkCreditLimit blocks at limit', () => {
            const cr = checkCreditLimit('starter', PLAN_CONFIGS.starter.tokensPerMonth);
            expect(cr.allowed).toBe(false);
            expect(cr.remaining).toBe(0);
        });
    });

    describe('checkTokenLimit', () => {
        it('should allow tokens within limit', () => {
            const result = checkTokenLimit('starter', 100_000);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(PLAN_CONFIGS.starter.tokensPerMonth - 100_000);
            expect(result.usagePercent).toBeGreaterThan(0);
        });

        it('should block tokens at limit', () => {
            const starterLimit = PLAN_CONFIGS.starter.tokensPerMonth;
            const result = checkTokenLimit('starter', starterLimit);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.usagePercent).toBe(100);
        });

        it('should block tokens over limit', () => {
            const starterLimit = PLAN_CONFIGS.starter.tokensPerMonth;
            const result = checkTokenLimit('starter', starterLimit + 500_000);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.usagePercent).toBe(100);
        });

        it('should have correct token limits per plan', () => {
            expect(PLAN_CONFIGS.lite.tokensPerMonth).toBe(1_000_000);
            expect(PLAN_CONFIGS.starter.tokensPerMonth).toBe(2_400_000);
            expect(PLAN_CONFIGS.pro.tokensPerMonth).toBe(12_000_000);
            expect(PLAN_CONFIGS.enterprise.tokensPerMonth).toBe(100_000_000);
        });

        it('should calculate usage percentage correctly', () => {
            // 50% usage
            const halfUsed = PLAN_CONFIGS.pro.tokensPerMonth / 2;
            const result = checkTokenLimit('pro', halfUsed);
            expect(result.usagePercent).toBe(50);
            expect(result.allowed).toBe(true);
        });

        it('should correctly flag thresholds for warnings at 80% and 90%', () => {
            const limit = PLAN_CONFIGS.starter.tokensPerMonth;
            
            // 80% usage
            const eightyPercent = limit * 0.8;
            expect(checkTokenLimit('starter', eightyPercent).usagePercent).toBe(80);
            
            // 90% usage
            const ninetyPercent = limit * 0.9;
            expect(checkTokenLimit('starter', ninetyPercent).usagePercent).toBe(90);
        });

        it('should allow large enterprise usage', () => {
            const result = checkTokenLimit('enterprise', 50_000_000);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(50_000_000);
        });
    });

    describe('getEnabledToolsForPlan', () => {
        it('should return minimal tools for lite', () => {
            const tools = getEnabledToolsForPlan('lite');
            expect(tools).toContain('show_product_image');
            expect(tools).toContain('collect_contact_info');
            expect(tools).not.toContain('add_to_cart');
            expect(tools).not.toContain('checkout');
            expect(tools.length).toBe(2);
        });

        it('should return correct tools for starter', () => {
            const tools = getEnabledToolsForPlan('starter');
            expect(tools).toContain('add_to_cart');
            expect(tools).toContain('show_product_image');
            expect(tools).toContain('checkout');
            expect(tools).not.toContain('cancel_order');
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
