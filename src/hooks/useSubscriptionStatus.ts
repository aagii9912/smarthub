import { useQuery } from '@tanstack/react-query';
import { getPlanConfig, type PlanType } from '@/lib/ai/config/plans';

/**
 * Derived token-usage (credit) status for the current shop, sourced from
 * /api/subscription/current (which reads the shops table). Drives the credit
 * meter in the dashboard Header.
 *
 * Note: the 3-day trial was retired when Lite became free. The trialActive /
 * trialExpired fields are kept for backward compatibility but are no-ops now
 * that no subscription carries a trial status.
 */
export interface SubscriptionStatus {
    subStatus: string | null;
    trialEndsAt: string | null;
    trialActive: boolean;
    trialExpired: boolean;
    daysLeft: number;
    hoursLeft: number;
    /** e.g. "2 хоног 5 цаг" or "8 цаг" — empty unless the trial is active. */
    remainingText: string;
    tokensUsed: number;
    /** 0 when the plan has no known token cap. */
    tokensMax: number;
    /** Credits = tokens / 1000 (matches the subscription page wording). */
    creditsUsed: number;
    creditsMax: number;
    creditsLeft: number;
    planName: string | null;
    isActivePaid: boolean;
}

const TOKENS_PER_CREDIT = 1000;

export interface CurrentSubscriptionResponse {
    plan?: { name?: string; slug?: string; limits?: { max_tokens?: number; tokens?: number } | null } | null;
    usage?: { tokens?: number } | null;
    shop_status?: {
        subscription_status?: string | null;
        trial_ends_at?: string | null;
        trial_expired_at?: string | null;
    } | null;
}

/**
 * Pure derivation from the /api/subscription/current payload. Exported so the
 * trial/expired/days/token logic can be unit-tested without mocking fetch.
 * `now` is injectable for deterministic tests.
 */
export function deriveSubscriptionStatus(
    d: CurrentSubscriptionResponse,
    now: number = Date.now(),
): SubscriptionStatus {
    const subStatus = d.shop_status?.subscription_status ?? null;
    const trialEndsRaw = d.shop_status?.trial_ends_at ?? null;
    const trialEndsAt = trialEndsRaw ? new Date(trialEndsRaw) : null;

    const isTrialing = subStatus === 'trial' || subStatus === 'trialing';
    const hasFutureEnd = !!trialEndsAt && trialEndsAt.getTime() > now;
    const trialActive = isTrialing && hasFutureEnd;
    const trialExpired =
        subStatus === 'expired_trial' ||
        subStatus === 'expired' ||
        (isTrialing && !!trialEndsAt && trialEndsAt.getTime() <= now);

    let daysLeft = 0;
    let hoursLeft = 0;
    let remainingText = '';
    if (trialActive && trialEndsAt) {
        const totalHours = Math.max(0, Math.floor((trialEndsAt.getTime() - now) / 3_600_000));
        daysLeft = Math.floor(totalHours / 24);
        hoursLeft = totalHours % 24;
        remainingText = daysLeft > 0 ? `${daysLeft} хоног ${hoursLeft} цаг` : `${totalHours} цаг`;
    }

    const tokensUsed = Number(d.usage?.tokens ?? 0);
    const rawLimits = d.plan?.limits ?? {};
    const rawMax = Number(rawLimits.max_tokens ?? rawLimits.tokens ?? 0);

    // Match /dashboard/subscription exactly: when the DB plan has no explicit
    // max_tokens, fall back to the plan-config allowance keyed by slug (note the
    // page casts slug → PlanType, so an unknown slug like 'professional' resolves
    // to getPlanConfig's starter default). No plan at all → 0 credits.
    const tokensMax = rawMax > 0
        ? rawMax
        : d.plan
            ? getPlanConfig((d.plan.slug || 'lite') as PlanType).tokensPerMonth
            : 0;

    const creditsUsed = Math.ceil(tokensUsed / TOKENS_PER_CREDIT);
    const creditsMax = Math.floor(tokensMax / TOKENS_PER_CREDIT);
    const creditsLeft = Math.max(creditsMax - creditsUsed, 0);

    return {
        subStatus,
        trialEndsAt: trialEndsRaw,
        trialActive,
        trialExpired,
        daysLeft,
        hoursLeft,
        remainingText,
        tokensUsed,
        tokensMax,
        creditsUsed,
        creditsMax,
        creditsLeft,
        planName: d.plan?.name ?? null,
        isActivePaid: subStatus === 'active',
    };
}

export function useSubscriptionStatus() {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;

    return useQuery<SubscriptionStatus>({
        queryKey: ['subscription-status', shopId],
        queryFn: async (): Promise<SubscriptionStatus> => {
            const res = await fetch('/api/subscription/current', {
                headers: { 'x-shop-id': shopId || '' },
            });
            if (!res.ok) throw new Error('Failed to fetch subscription status');
            const d: CurrentSubscriptionResponse = await res.json();
            return deriveSubscriptionStatus(d);
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false,
    });
}
