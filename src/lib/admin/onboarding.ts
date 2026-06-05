/**
 * Onboarding progress derivation for the admin shops table (#3).
 *
 * The shops row doesn't store an explicit wizard step, so we derive how far a
 * shop has progressed from the milestone signals that are already on the row.
 * Kept here (not inline in the page) so the logic is unit-testable.
 */

export interface OnboardingSignals {
    facebook_page_id: string | null;
    product_count: number;
    ai_setup_completed_at: string | null;
    ai_instructions: string | null;
    subscription_status: string | null;
    setup_completed: boolean | null;
}

export interface OnboardingProgress {
    completed: number;
    total: number;
    /** Furthest milestone reached, e.g. "AI тохируулсан". */
    label: string;
    percent: number;
}

export const ONBOARDING_TOTAL = 5;

// Statuses that mean the shop has chosen a plan or started a trial.
const PLAN_CHOSEN_STATUSES = ['trial', 'trialing', 'active', 'past_due', 'expired_trial'];

export function getOnboarding(shop: OnboardingSignals): OnboardingProgress {
    const steps: { label: string; done: boolean }[] = [
        { label: 'Хуудас холбосон', done: !!shop.facebook_page_id },
        { label: 'Бараа нэмсэн', done: (shop.product_count ?? 0) > 0 },
        { label: 'AI тохируулсан', done: !!shop.ai_setup_completed_at || !!shop.ai_instructions },
        { label: 'Багц / Туршилт', done: PLAN_CHOSEN_STATUSES.includes(shop.subscription_status || '') },
        { label: 'Дууссан', done: shop.setup_completed === true },
    ];

    const completed = steps.filter((s) => s.done).length;

    // Furthest reached milestone (last one marked done, in order).
    let label = 'Шинээр бүртгүүлсэн';
    for (const s of steps) if (s.done) label = s.label;

    return {
        completed,
        total: ONBOARDING_TOTAL,
        label,
        percent: Math.round((completed / ONBOARDING_TOTAL) * 100),
    };
}
