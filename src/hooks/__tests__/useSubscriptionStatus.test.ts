import { describe, it, expect } from 'vitest';
import { deriveSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

// Fixed "now" for deterministic day/hour math.
const NOW = new Date('2026-06-05T12:00:00Z').getTime();
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

describe('deriveSubscriptionStatus (#1/#2)', () => {
    it('treats shops "trial" with a future end as an active trial', () => {
        const s = deriveSubscriptionStatus(
            {
                shop_status: { subscription_status: 'trial', trial_ends_at: inHours(53) }, // 2d 5h
                usage: { tokens: 1200 },
                plan: { name: 'Lite', limits: { max_tokens: 10000 } },
            },
            NOW,
        );
        expect(s.trialActive).toBe(true);
        expect(s.trialExpired).toBe(false);
        expect(s.daysLeft).toBe(2);
        expect(s.hoursLeft).toBe(5);
        expect(s.remainingText).toBe('2 хоног 5 цаг');
        expect(s.tokensUsed).toBe(1200);
        expect(s.tokensMax).toBe(10000);
        // Credits = tokens / 1000: used = ceil(1.2) = 2, max = 10, left = 8.
        expect(s.creditsUsed).toBe(2);
        expect(s.creditsMax).toBe(10);
        expect(s.creditsLeft).toBe(8);
    });

    it('reports 0 credits left for a free plan with no token cap', () => {
        const s = deriveSubscriptionStatus(
            { shop_status: { subscription_status: 'unpaid' }, usage: { tokens: 0 }, plan: { limits: {} } },
            NOW,
        );
        expect(s.creditsMax).toBe(0);
        expect(s.creditsLeft).toBe(0);
        expect(s.trialActive).toBe(false);
        expect(s.trialExpired).toBe(false);
    });

    it('also accepts the "trialing" spelling as active', () => {
        const s = deriveSubscriptionStatus(
            { shop_status: { subscription_status: 'trialing', trial_ends_at: inHours(8) } },
            NOW,
        );
        expect(s.trialActive).toBe(true);
        expect(s.daysLeft).toBe(0);
        expect(s.remainingText).toBe('8 цаг');
    });

    it('flags "expired_trial" as expired', () => {
        const s = deriveSubscriptionStatus(
            { shop_status: { subscription_status: 'expired_trial', trial_ends_at: inHours(-10) } },
            NOW,
        );
        expect(s.trialExpired).toBe(true);
        expect(s.trialActive).toBe(false);
    });

    it('flags a "trial" whose end has passed as expired (before the cron flips it)', () => {
        const s = deriveSubscriptionStatus(
            { shop_status: { subscription_status: 'trial', trial_ends_at: inHours(-1) } },
            NOW,
        );
        expect(s.trialExpired).toBe(true);
        expect(s.trialActive).toBe(false);
    });

    it('treats an active paid plan as neither trialing nor expired', () => {
        const s = deriveSubscriptionStatus(
            { shop_status: { subscription_status: 'active' }, plan: { name: 'Pro' } },
            NOW,
        );
        expect(s.trialActive).toBe(false);
        expect(s.trialExpired).toBe(false);
        expect(s.isActivePaid).toBe(true);
    });

    it('falls back to limits.tokens, then 0, for the token cap', () => {
        expect(
            deriveSubscriptionStatus({ plan: { limits: { tokens: 5000 } }, usage: { tokens: 10 } }, NOW).tokensMax,
        ).toBe(5000);
        expect(
            deriveSubscriptionStatus({ plan: { limits: {} }, shop_status: { subscription_status: 'active' } }, NOW)
                .tokensMax,
        ).toBe(0);
    });
});
