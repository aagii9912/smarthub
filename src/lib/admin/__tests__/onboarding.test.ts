import { describe, it, expect } from 'vitest';
import { getOnboarding, ONBOARDING_TOTAL, type OnboardingSignals } from '@/lib/admin/onboarding';

const base: OnboardingSignals = {
    facebook_page_id: null,
    product_count: 0,
    ai_setup_completed_at: null,
    ai_instructions: null,
    subscription_status: null,
    setup_completed: null,
};

describe('getOnboarding (#3)', () => {
    it('reports a fresh shop as 0/5', () => {
        const ob = getOnboarding(base);
        expect(ob.completed).toBe(0);
        expect(ob.total).toBe(ONBOARDING_TOTAL);
        expect(ob.percent).toBe(0);
        expect(ob.label).toBe('Шинээр бүртгүүлсэн');
    });

    it('counts each milestone and reports the furthest label', () => {
        const ob = getOnboarding({
            ...base,
            facebook_page_id: 'pg_1',
            product_count: 4,
            ai_instructions: 'Be nice',
        });
        expect(ob.completed).toBe(3);
        expect(ob.percent).toBe(60);
        expect(ob.label).toBe('AI тохируулсан');
    });

    it('treats a trial subscription as the plan milestone', () => {
        expect(getOnboarding({ ...base, subscription_status: 'trial' }).completed).toBe(1);
        expect(getOnboarding({ ...base, subscription_status: 'expired_trial' }).completed).toBe(1);
        expect(getOnboarding({ ...base, subscription_status: 'unpaid' }).completed).toBe(0);
    });

    it('reports a fully set-up shop as 5/5 / 100%', () => {
        const ob = getOnboarding({
            facebook_page_id: 'pg_1',
            product_count: 10,
            ai_setup_completed_at: '2026-06-01T00:00:00Z',
            ai_instructions: null,
            subscription_status: 'active',
            setup_completed: true,
        });
        expect(ob.completed).toBe(5);
        expect(ob.percent).toBe(100);
        expect(ob.label).toBe('Дууссан');
    });
});
