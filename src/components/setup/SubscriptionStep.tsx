'use client';
import { logger } from '@/lib/utils/logger';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
    Crown, Rocket, Building2, Sparkles,
    CreditCard, X, Loader2, ArrowRight, CheckCircle2, Smartphone, Gift, Clock
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/constants/legal';

// Types
interface Plan {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price_monthly: number | null;
    price_yearly: number | null;
    features: Record<string, unknown> | string[] | null;
    is_featured: boolean;
}

interface QPayUrl {
    name?: string;
    description?: string;
    logo?: string;
    link?: string;
}

interface PaymentInfo {
    invoice_id?: string;
    qr_code?: string;
    urls?: QPayUrl[];
    amount?: number;
    payment_required?: boolean;
    qpay_error?: boolean;
    qpay_error_code?: string;
    qpay_error_detail?: string;
    message?: string;
}

interface Promotion {
    id?: string;
    code: string;
    name: string;
    description: string | null;
    bonus_months: number;
    eligible_billing_cycles: string[];
    eligible_plan_slugs: string[];
}

interface SubscriptionStepProps {
    onComplete: () => void;
}

// Map QPay error codes to user-facing Mongolian messages.
const qpayErrorMessage: Record<string, string> = {
    circuit_open: 'QPay түр ачаалал ихтэй байна. Хэдхэн минутын дараа дахин оролдоно уу.',
    mock: 'Тестийн орчинд ажиллаж байна — QPay-н тохиргоо хийгдээгүй байна.',
    config: 'QPay-н тохиргоо дутуу байна. Админтай холбогдоно уу.',
    token: 'QPay-н нэвтрэлт амжилтгүй боллоо. Credentials шалгана уу.',
    http_4xx: 'QPay-н хүсэлт зөв бус байна. Credentials эсвэл данс буруу байж магадгүй.',
    http_5xx: 'QPay-н сервер түр ажиллахгүй байна.',
    network: 'Сүлжээний алдаа. Холболтоо шалгана уу.',
};

// Icon and color mappings
const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    starter: Rocket,
    business: Crown,
    enterprise: Building2,
};

const planColors: Record<string, { bg: string; text: string }> = {
    starter: { bg: 'bg-blue-100', text: 'text-blue-600' },
    business: { bg: 'bg-gradient-to-br from-indigo-500 to-purple-500', text: 'text-white' },
    enterprise: { bg: 'bg-orange-100', text: 'text-orange-600' },
};

export function SubscriptionStep({ onComplete }: SubscriptionStepProps) {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [promotion, setPromotion] = useState<Promotion | null>(null);
    const [loading, setLoading] = useState(true);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [subscribing, setSubscribing] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'paid' | 'error'>('idle');
    const [pollingError, setPollingError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [consentError, setConsentError] = useState('');
    const [trialState, setTrialState] = useState<'available' | 'active' | 'used' | 'unknown'>('unknown');
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
    const [trialLoading, setTrialLoading] = useState(false);
    const [trialError, setTrialError] = useState('');
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { t } = useLanguage();
    const { refreshShop } = useAuth();

    const allRequiredConsents = termsAccepted && privacyAccepted && ageConfirmed;

    // Verify the shop is actually 'active' on the server before letting the
    // wizard navigate to /dashboard. If the activation didn't propagate to the
    // shops row (e.g. webhook silent failure), call check-payment with
    // force=true to re-run the activation chain. Returns true once the shop is
    // active. Returns false if even the forced retry fails — in that case the
    // wizard surfaces an error and keeps polling instead of navigating away.
    const verifyShopActivated = useCallback(async (invoiceIdForForce?: string): Promise<boolean> => {
        try {
            const res = await fetch('/api/subscription/current');
            if (res.ok) {
                const data = await res.json();
                if (data?.shop_status?.subscription_status === 'active') {
                    return true;
                }
            }
        } catch (err) {
            logger.warn('Initial subscription/current check failed:', { error: err });
        }

        // Shop not active yet — try the fail-safe force activation once.
        try {
            const forceRes = await fetch('/api/subscription/check-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: invoiceIdForForce, force: true }),
            });
            const forceData = await forceRes.json();

            if (!forceRes.ok || forceData.status !== 'paid') {
                logger.warn('Force activation did not succeed:', { data: forceData });
                return false;
            }
        } catch (err) {
            logger.warn('Force activation request failed:', { error: err });
            return false;
        }

        // Re-check after force activation.
        try {
            const res = await fetch('/api/subscription/current');
            if (res.ok) {
                const data = await res.json();
                return data?.shop_status?.subscription_status === 'active';
            }
        } catch (err) {
            logger.warn('Post-force subscription/current check failed:', { error: err });
        }
        return false;
    }, []);

    // Fetch plans
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/subscription/plans');
                const data = await res.json();
                setPlans(data.plans || []);
                setPromotion(data.promotion ?? null);
            } catch (err) {
                logger.error('Error fetching plans:', { error: err });
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, []);

    // Determine the user's current trial state once on mount.
    useEffect(() => {
        let active = true;
        const fetchTrialState = async () => {
            try {
                const res = await fetch('/api/subscription/current');
                if (!res.ok) {
                    if (active) setTrialState('available');
                    return;
                }
                const data = await res.json();
                const subStatus = data?.subscription?.status as string | undefined;
                const shopStatus = data?.shop_status?.subscription_status as string | undefined;
                const endsAt = (data?.subscription?.trial_ends_at as string | undefined)
                    ?? (data?.shop_status?.trial_ends_at as string | undefined)
                    ?? null;

                if (!active) return;

                if (subStatus === 'trialing' || shopStatus === 'trial' || shopStatus === 'trialing') {
                    setTrialState('active');
                    setTrialEndsAt(endsAt);
                } else if (
                    subStatus === 'active' ||
                    shopStatus === 'active' ||
                    shopStatus === 'expired_trial' ||
                    subStatus === 'expired' ||
                    subStatus === 'canceled'
                ) {
                    // Already on a paid plan, or trial was previously used.
                    setTrialState('used');
                } else {
                    setTrialState('available');
                }
            } catch {
                if (active) setTrialState('available');
            }
        };
        fetchTrialState();
        return () => {
            active = false;
        };
    }, []);

    const trialDaysRemaining = (() => {
        if (!trialEndsAt) return null;
        const diffMs = new Date(trialEndsAt).getTime() - Date.now();
        if (Number.isNaN(diffMs) || diffMs <= 0) return 0;
        return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    })();

    const handleStartTrial = async () => {
        if (!allRequiredConsents) {
            setConsentError(t.setup.subscription.consent.errorRequired);
            if (typeof window !== 'undefined') {
                document.getElementById('consent-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        setConsentError('');
        setTrialError('');
        setTrialLoading(true);
        try {
            const res = await fetch('/api/subscription/start-trial', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setTrialError(data?.error || 'Туршилт эхлүүлэхэд алдаа гарлаа.');
                if (data?.code === 'subscription_exists') setTrialState('active');
                else if (data?.code === 'trial_already_used') setTrialState('used');
                return;
            }
            await refreshShop();
            setTrialState('active');
            setTrialEndsAt(data?.trial_ends_at ?? null);
            onComplete();
        } catch (err) {
            logger.error('start-trial error', { error: err });
            setTrialError('Сүлжээний алдаа. Дахин оролдоно уу.');
        } finally {
            setTrialLoading(false);
        }
    };

    const handleContinueWithTrial = () => {
        onComplete();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
    };

    const getPlanIcon = (slug: string) => planIcons[slug] || Rocket;
    const getPlanColor = (slug: string) => planColors[slug] || planColors.starter;

    const getFeaturesList = (features: Record<string, unknown> | string[] | null): string[] => {
        if (!features) return [];
        if (Array.isArray(features)) return features;

        const featureLabels: Record<string, { icon: string; label: string; showValue?: boolean }> = {
            ai_enabled: { icon: '🤖', label: t.features.aiEnabled },
            cart_system: { icon: '🛒', label: t.features.cartSystem },
            crm_analytics: { icon: '📊', label: t.features.crmAnalytics },
            max_messages: { icon: '💬', label: t.features.creditsPerMonth, showValue: true },
            max_credits: { icon: '💬', label: t.features.creditsPerMonth, showValue: true },
            max_products: { icon: '📦', label: t.features.productCount, showValue: true },
            priority_support: { icon: '⭐', label: t.features.prioritySupport },
        };

        const featureStrings: string[] = [];
        for (const [key, value] of Object.entries(features)) {
            const config = featureLabels[key];
            if (!config) continue;

            if (value === true) {
                featureStrings.push(`${config.icon} ${config.label}`);
            } else if (typeof value === 'number' && value !== 0 && config.showValue) {
                if (value === -1) {
                    featureStrings.push(`${config.icon} ${t.features.unlimited} ${config.label}`);
                } else {
                    featureStrings.push(`${config.icon} ${value.toLocaleString()} ${config.label}`);
                }
            }
        }
        return featureStrings;
    };

    // Start polling for payment status
    const startPolling = useCallback((invoiceId: string) => {
        // Clear existing polling
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
        }

        setPaymentStatus('pending');

        pollingRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/subscription/check-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: invoiceId }),
                });
                const data = await res.json();

                if (data.status === 'paid') {
                    // Verify the shop row was actually flipped to 'active' on
                    // the server before navigating. Don't trust the 'paid'
                    // status alone — there are silent-failure paths upstream.
                    const activated = await verifyShopActivated(invoiceId);

                    if (!activated) {
                        setPollingError('Төлбөр хийгдсэн ч идэвхжилт хойшилж байна. Хэдхэн секундын дараа дахин шалгана уу.');
                        // Keep polling so a transient backend issue can recover.
                        return;
                    }

                    // Activation confirmed.
                    if (pollingRef.current) {
                        clearInterval(pollingRef.current);
                        pollingRef.current = null;
                    }
                    await refreshShop();
                    setPollingError('');
                    setPaymentStatus('paid');

                    // Wait a moment for the success animation, then complete
                    setTimeout(() => {
                        onComplete();
                    }, 2500);
                } else if (data.status === 'activation_failed') {
                    // Server confirmed payment but couldn't activate the shop.
                    // Surface the message but keep polling — verifyShopActivated
                    // will run on the next 'paid' response and may recover.
                    setPollingError(data.message || 'Идэвхжилт хойшилж байна. Дахин оролдоно уу.');
                }
                // If still pending or other status, continue polling
            } catch (err) {
                logger.error('Polling error:', { error: err });
                // Don't stop polling on network errors
            }
        }, 3000);
    }, [onComplete, refreshShop, verifyShopActivated]);

    const handleSelectPlan = (planSlug: string) => {
        if (!allRequiredConsents) {
            setConsentError(t.setup.subscription.consent.errorRequired);
            // Scroll user back up to the consent box if it scrolled out of view
            if (typeof window !== 'undefined') {
                document.getElementById('consent-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        setConsentError('');
        setSelectedPlan(planSlug);
        setPaymentInfo(null);
        setPaymentStatus('idle');
        setPollingError('');
        setShowPaymentModal(true);
    };

    // Create subscription invoice and get real QR
    const handleSubscribe = async () => {
        if (!selectedPlan) return;
        setSubscribing(true);
        setPollingError('');

        try {
            const res = await fetch('/api/subscription/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: selectedPlan,
                    billing_cycle: billingPeriod,
                    consent: {
                        terms_accepted: termsAccepted,
                        privacy_accepted: privacyAccepted,
                        age_confirmed: ageConfirmed,
                        marketing_consent: marketingConsent,
                        terms_version: TERMS_VERSION,
                        privacy_version: PRIVACY_VERSION,
                    }
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Алдаа гарлаа');
            }

            if (data.payment_required) {
                setPaymentInfo(data);

                if (data.qpay_error) {
                    // QPay unavailable — show error with specific reason if available.
                    const codeMsg = data.qpay_error_code && qpayErrorMessage[data.qpay_error_code];
                    const headline = codeMsg || data.message || 'QPay түр ажиллахгүй байна';
                    const detail = data.qpay_error_detail
                        ? `${headline}\n${data.qpay_error_detail}`
                        : headline;
                    setPollingError(detail);
                    setPaymentStatus('error');
                } else if (typeof data.qr_code === 'string' && data.qr_code.length > 0) {
                    // QR code received — start polling
                    startPolling(data.invoice_id);
                } else {
                    // Empty QR string — treat as a silent failure rather than
                    // hanging the user on a blank modal.
                    setPollingError('QR код хоосон ирлээ. QPay-н тохиргоог шалгана уу.');
                    setPaymentStatus('error');
                }
            } else {
                // Free plan (shouldn't happen given current backend but handle gracefully)
                onComplete();
            }
        } catch (err) {
            logger.error('Subscription error:', { error: err });
            setPollingError(err instanceof Error ? err.message : 'Алдаа гарлаа');
            setPaymentStatus('error');
        } finally {
            setSubscribing(false);
        }
    };

    // Manual payment check
    const handleManualCheck = async () => {
        if (!paymentInfo?.invoice_id) return;
        setSubscribing(true);

        try {
            const res = await fetch('/api/subscription/check-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: paymentInfo.invoice_id }),
            });
            const data = await res.json();

            if (data.status === 'paid') {
                const activated = await verifyShopActivated(paymentInfo.invoice_id);

                if (!activated) {
                    setPollingError('Төлбөр хийгдсэн ч идэвхжилт хойшилж байна. Хэдхэн секундын дараа дахин шалгана уу.');
                    return;
                }

                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                await refreshShop();
                setPollingError('');
                setPaymentStatus('paid');
                setTimeout(() => {
                    onComplete();
                }, 2500);
            } else if (data.status === 'pending') {
                setPollingError('Төлбөр хүлээгдэж байна. QR код уншуулсны дараа дахин шалгана уу.');
            } else if (data.status === 'activation_failed') {
                setPollingError(data.message || 'Идэвхжилт хойшилж байна. Дахин оролдоно уу.');
            } else {
                setPollingError(data.message || 'Алдаа гарлаа');
            }
        } catch {
            setPollingError('Төлбөр шалгахад алдаа гарлаа');
        } finally {
            setSubscribing(false);
        }
    };

    // Close modal and clean up
    const handleCloseModal = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        setShowPaymentModal(false);
        setPaymentInfo(null);
        setPaymentStatus('idle');
        setPollingError('');
    };

    // Detect if user is on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    const filteredPlans = plans.filter(plan => plan.slug !== 'free' && (plan.price_monthly || 0) > 0);
    const selected = plans.find(p => p.slug === selectedPlan);

    const promoActiveForCycle =
        !!promotion && promotion.eligible_billing_cycles.includes(billingPeriod);
    const isPlanEligibleForPromo = (slug: string) =>
        promoActiveForCycle && promotion!.eligible_plan_slugs.includes(slug);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/30">
                    <CreditCard className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{t.setup.subscription.title}</h2>
                <p className="text-gray-500 mt-2">{t.setup.subscription.subtitle}</p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                    {t.setup.subscription.monthly}
                </span>
                <button
                    onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-violet-600 transition-colors"
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
                <span className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
                    {t.setup.subscription.yearly}
                    {promotion && promotion.eligible_billing_cycles.includes('yearly') && (
                        <span className="ml-2 text-xs text-green-600 font-semibold">
                            +{promotion.bonus_months} {t.setup.subscription.bonusMonthsShort}
                        </span>
                    )}
                </span>
            </div>

            {/* Promo Banner */}
            {promoActiveForCycle && (
                <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-violet-900">{promotion!.name}</div>
                        {promotion!.description && (
                            <div className="text-xs text-violet-700 mt-0.5">{promotion!.description}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Trial Card */}
            {trialState !== 'unknown' && (
                <div className={`rounded-2xl border p-5 ${trialState === 'used'
                    ? 'border-gray-200 bg-gray-50 opacity-70'
                    : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                    }`}>
                    <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${trialState === 'used' ? 'bg-gray-200' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                            }`}>
                            {trialState === 'active' ? (
                                <Clock className="w-5 h-5 text-white" />
                            ) : (
                                <Gift className={`w-5 h-5 ${trialState === 'used' ? 'text-gray-500' : 'text-white'}`} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900">
                                3 хоног үнэгүй туршаад үзэх
                            </h3>
                            {trialState === 'active' && (
                                <p className="text-sm text-emerald-700 mt-1">
                                    Туршилт идэвхтэй
                                    {trialDaysRemaining !== null && trialDaysRemaining > 0 && (
                                        <> — {trialDaysRemaining} хоног үлдсэн</>
                                    )}
                                </p>
                            )}
                            {trialState === 'available' && (
                                <p className="text-sm text-gray-600 mt-1">
                                    Картын мэдээлэл хэрэггүй. 3 хоногийн дараа автоматаар зогсоно.
                                </p>
                            )}
                            {trialState === 'used' && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Та өмнө нь туршилт ашигласан байна. Доорх төлбөртэй планаас сонгоно уу.
                                </p>
                            )}
                            {trialError && (
                                <p className="text-xs text-red-600 mt-2">{trialError}</p>
                            )}
                        </div>
                        {trialState === 'available' && (
                            <Button
                                onClick={handleStartTrial}
                                disabled={trialLoading}
                                className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {trialLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Эхлүүлэх'}
                            </Button>
                        )}
                        {trialState === 'active' && (
                            <Button
                                onClick={handleContinueWithTrial}
                                variant="secondary"
                                className="flex-shrink-0"
                            >
                                Үргэлжлүүлэх
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredPlans.map((plan) => {
                    const PlanIcon = getPlanIcon(plan.slug);
                    const colors = getPlanColor(plan.slug);
                    const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
                    const isFeatured = plan.is_featured || plan.slug === 'professional' || plan.slug === 'pro';

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-2xl border p-5 transition-all cursor-pointer hover:shadow-md ${isFeatured
                                ? 'border-violet-300 bg-violet-50/50'
                                : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                                }`}
                            onClick={() => handleSelectPlan(plan.slug)}
                        >
                            {isFeatured && (
                                <div className="absolute -top-3 left-4">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 text-xs font-semibold text-white">
                                        <Sparkles className="w-3 h-3" />
                                        {t.setup.subscription.recommended}
                                    </span>
                                </div>
                            )}

                            {isPlanEligibleForPromo(plan.slug) && (
                                <div className="absolute -top-3 right-4">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                                        +{promotion!.bonus_months} {t.setup.subscription.bonusMonthsShort}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                                    <PlanIcon className={`w-6 h-6 ${colors.text}`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                                    {plan.description && (
                                        <p className="text-sm text-gray-500 truncate">{plan.description}</p>
                                    )}
                                </div>

                                <div className="text-right flex-shrink-0">
                                    {price ? (
                                        <>
                                            <span className="text-xl font-bold text-gray-900">
                                                {formatCurrency(price)}
                                            </span>
                                            <span className="text-gray-500 text-sm">/{billingPeriod === 'monthly' ? t.setup.subscription.perMonth : t.setup.subscription.perYear}</span>
                                        </>
                                    ) : (
                                        <span className="text-lg font-bold text-gray-900">{t.setup.subscription.contactUs}</span>
                                    )}
                                </div>

                                <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>

                            {/* Features on hover/expanded */}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {getFeaturesList(plan.features).slice(0, 4).map((feature, idx) => (
                                    <span key={idx} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Consent Block — required before plan selection */}
            <div id="consent-block" className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">
                    {t.setup.subscription.consent.title}
                </h3>

                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={e => { setTermsAccepted(e.target.checked); setConsentError(''); }}
                        className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-violet-600 underline hover:text-violet-700">
                            {t.setup.subscription.consent.termsLinkLabel}
                        </Link>
                        {t.setup.subscription.consent.acceptTermsSuffix}
                        <span className="text-red-500 ml-1">*</span>
                    </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={e => { setPrivacyAccepted(e.target.checked); setConsentError(''); }}
                        className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-violet-600 underline hover:text-violet-700">
                            {t.setup.subscription.consent.privacyLinkLabel}
                        </Link>
                        {t.setup.subscription.consent.acceptPrivacySuffix}
                        <span className="text-red-500 ml-1">*</span>
                    </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={ageConfirmed}
                        onChange={e => { setAgeConfirmed(e.target.checked); setConsentError(''); }}
                        className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                        {t.setup.subscription.consent.ageConfirm}
                        <span className="text-red-500 ml-1">*</span>
                    </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group pt-2 border-t border-gray-100">
                    <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={e => setMarketingConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 leading-relaxed">
                        {t.setup.subscription.consent.marketingOptIn}
                        <span className="text-gray-400 ml-1">{t.setup.subscription.consent.optional}</span>
                    </span>
                </label>

                {consentError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
                        {consentError}
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200 border border-gray-100 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{t.setup.subscription.payment}</h3>
                                    <p className="text-sm text-gray-500">{t.setup.subscription.payViaQPay}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Plan Summary */}
                        <div className="bg-gray-50 p-4 rounded-xl mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-gray-700">{t.setup.subscription.selectedPlan}</span>
                                <span className="font-bold text-violet-700">{selected.name}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600">{t.setup.subscription.duration}</span>
                                <span className="text-sm text-gray-900">
                                    {billingPeriod === 'monthly' ? t.setup.subscription.oneMonth : t.setup.subscription.oneYear}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                <span className="font-bold text-gray-900">{t.setup.subscription.totalAmount}</span>
                                <span className="font-bold text-xl text-violet-700">
                                    {formatCurrency(
                                        (billingPeriod === 'monthly' ? selected.price_monthly : selected.price_yearly) || 0
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* ═══════════ Payment States ═══════════ */}

                        {/* State: Payment Success */}
                        {paymentStatus === 'paid' && (
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Төлбөр амжилттай! 🎉</h3>
                                <p className="text-sm text-gray-500">Dashboard руу шилжиж байна...</p>
                            </div>
                        )}

                        {/* State: No payment yet — show "Create Invoice" button */}
                        {paymentStatus === 'idle' && !paymentInfo && (
                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={handleCloseModal}
                                >
                                    {t.common.back}
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleSubscribe}
                                    disabled={subscribing}
                                >
                                    {subscribing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'QPay төлбөр үүсгэх'
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* State: QR Code displayed — waiting for payment */}
                        {paymentInfo?.qr_code && paymentStatus === 'pending' && (
                            <>
                                <div className="text-center mb-5">
                                    <p className="text-sm font-medium text-gray-700 mb-3">{t.setup.subscription.scanWithBank}</p>
                                    <div className="w-52 h-52 bg-white border-2 border-gray-100 rounded-2xl mx-auto flex items-center justify-center overflow-hidden p-2 shadow-sm">
                                        <img
                                            src={`data:image/png;base64,${paymentInfo.qr_code}`}
                                            alt="QPay QR"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* Polling indicator */}
                                    <div className="flex items-center justify-center gap-2 mt-3">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                                        <span className="text-xs text-gray-500">Төлбөр хүлээж байна...</span>
                                    </div>
                                </div>

                                {/* Bank App Links (for mobile) */}
                                {isMobile && paymentInfo.urls && paymentInfo.urls.length > 0 && (
                                    <div className="mb-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Smartphone className="w-4 h-4 text-gray-500" />
                                            <span className="text-xs font-medium text-gray-700">Банкны аппаар төлөх:</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {paymentInfo.urls.slice(0, 9).map((url, idx) => (
                                                <a
                                                    key={idx}
                                                    href={url.link}
                                                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-100 hover:border-violet-300 hover:bg-violet-50/50 transition-all text-center"
                                                >
                                                    {url.logo ? (
                                                        <img src={url.logo} alt={url.name || ''} className="w-8 h-8 rounded-lg object-contain" />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                                            <CreditCard className="w-4 h-4 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-gray-600 leading-tight line-clamp-1">
                                                        {url.name || url.description || `Банк ${idx + 1}`}
                                                    </span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {pollingError && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs text-center">
                                        {pollingError}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <Button
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={handleCloseModal}
                                    >
                                        {t.common.back}
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        onClick={handleManualCheck}
                                        disabled={subscribing}
                                    >
                                        {subscribing ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Төлбөр шалгах'
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* State: QPay Error */}
                        {paymentStatus === 'error' && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <X className="w-8 h-8 text-red-500" />
                                </div>
                                <p className="text-sm text-red-600 mb-4">{pollingError || 'Төлбөрийн систем түр ажиллахгүй байна'}</p>
                                <div className="flex gap-3">
                                    <Button
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={handleCloseModal}
                                    >
                                        {t.common.back}
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        onClick={handleSubscribe}
                                        disabled={subscribing}
                                    >
                                        {subscribing ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Дахин оролдох'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
