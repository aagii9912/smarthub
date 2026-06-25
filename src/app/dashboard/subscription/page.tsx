'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getPlanConfig, PlanType } from '@/lib/ai/config/plans';
import {
    Crown,
    Check,
    Zap,
    BarChart3,
    Package,
    Loader2,
    X,
    Sparkles,
    AlertTriangle,
    Gift,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/constants/legal';

interface Plan {
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    features: string[];
    limits: { products: number; orders: number; messages: number; tokens: number };
    highlighted?: boolean;
}

interface ActivePromotion {
    id: string;
    code: string;
    name: string;
    description: string | null;
    bonus_months: number;
    eligible_billing_cycles: string[];
    eligible_plan_slugs: string[];
}

interface ShopStatus {
    subscription_status: string | null;
    trial_ends_at: string | null;
    trial_expired_at: string | null;
    requires_consent?: boolean;
}

interface SubscribeConsent {
    terms_accepted: boolean;
    privacy_accepted: boolean;
    age_confirmed: boolean;
    marketing_consent: boolean;
    terms_version: string;
    privacy_version: string;
}

export default function SubscriptionPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPlan, setCurrentPlan] = useState('starter');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [usage, setUsage] = useState({ products: 0, orders: 0, messages: 0, tokens: 0 });
    interface BillingEntry {
        id?: string;
        amount?: number;
        status?: string;
        created_at?: string;
        date?: string;
        description?: string;
    }
    interface QpayUrl {
        name?: string;
        description?: string;
        link?: string;
    }
    const [billingHistory, setBillingHistory] = useState<BillingEntry[]>([]);
    const [plansError, setPlansError] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [upgrading, setUpgrading] = useState(false);
    // QR-poll гацсан (MAX_DURATION_MS хэтэрсэн) үед гараар шалгах UI харуулна.
    const [pollTimedOut, setPollTimedOut] = useState(false);
    const [manualChecking, setManualChecking] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState<{
        invoice_id?: string;
        qr_code?: string;
        urls?: QpayUrl[];
    } | null>(null);
    const [activePromotion, setActivePromotion] = useState<ActivePromotion | null>(null);
    const [shopStatus, setShopStatus] = useState<ShopStatus | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [consentError, setConsentError] = useState('');
    const { t } = useLanguage();

    useEffect(() => {
        fetchData();
    }, []);

    // Escape товчоор upgrade модалыг хаана (a11y).
    useEffect(() => {
        if (!showUpgrade) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowUpgrade(false);
                setPaymentInfo(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showUpgrade]);

    // Auto-poll QPay payment status while the QR modal is open. The QPay
    // webhook or our /check-payment fallback flips the invoice to 'paid'
    // shortly after the user scans the QR with their banking app — the next
    // poll picks that up and immediately switches the plan. No manual
    // confirmation click needed.
    useEffect(() => {
        if (!showUpgrade || !paymentInfo?.invoice_id) return;

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const POLL_MS = 3000;
        const MAX_DURATION_MS = 15 * 60 * 1000;
        const startedAt = Date.now();
        const invoiceId = paymentInfo.invoice_id;

        setPollTimedOut(false);

        const poll = async () => {
            if (cancelled) return;
            if (Date.now() - startedAt > MAX_DURATION_MS) {
                // Автомат хяналт зогссоныг хэрэглэгчид мэдэгдэж, гараар
                // шалгах товч руу шилжүүлнэ.
                setPollTimedOut(true);
                return;
            }

            try {
                const paid = await checkPaymentStatus(invoiceId);
                if (cancelled || paid) return;
            } catch (e) {
                logger.error('Auto-check payment error', { error: e });
            }

            if (!cancelled) {
                timeoutId = setTimeout(poll, POLL_MS);
            }
        };

        timeoutId = setTimeout(poll, POLL_MS);

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showUpgrade, paymentInfo?.invoice_id]);

    // Нэхэмжлэлийн төлөвийг нэг удаа шалгана — авто-poll болон гар шалгалт
    // хоёулаа үүнийг хэрэглэнэ. Төлөгдсөн бол UI-г шинэчилж true буцаана.
    async function checkPaymentStatus(invoiceId: string): Promise<boolean> {
        const res = await fetch('/api/subscription/check-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice_id: invoiceId }),
        });
        const data = await res.json();

        if (data.status === 'paid') {
            toast.success(data.message || 'Төлбөр амжилттай! Plan шинэчлэгдлээ 🎉');
            setShowUpgrade(false);
            setPaymentInfo(null);
            setPollTimedOut(false);
            fetchData(true);
            return true;
        }
        return false;
    }

    async function manualCheckPayment() {
        if (!paymentInfo?.invoice_id || manualChecking) return;
        setManualChecking(true);
        try {
            const paid = await checkPaymentStatus(paymentInfo.invoice_id);
            if (!paid) {
                toast.info('Төлбөр хараахан баталгаажаагүй байна. Түр хүлээгээд дахин шалгана уу.');
            }
        } catch (e) {
            logger.error('Manual check payment error', { error: e });
            toast.error('Төлбөр шалгахад алдаа гарлаа');
        } finally {
            setManualChecking(false);
        }
    }

    async function fetchData(refresh = false) {
        try {
            if (!refresh) setLoading(true);
            const headers = {
                'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
            };
            const [subRes, plansRes] = await Promise.all([
                fetch('/api/subscription/current', { headers }),
                fetch('/api/subscription/plans'),
            ]);
            let fetchedPlans: Plan[] = [];
            if (plansRes.ok) {
                const plansBody = await plansRes.json();
                const p = plansBody.plans;
                setActivePromotion(plansBody.promotion ?? null);
                interface RawPlanLimits {
                    max_products?: number;
                    max_customers?: number;
                    max_messages?: number;
                    max_tokens?: number;
                }
                interface RawPlanFeatures {
                    ai_enabled?: boolean;
                    shops_limit?: number;
                    analytics?: string;
                    priority_support?: boolean;
                }
                interface RawPlan {
                    id: string;
                    slug: string;
                    name: string;
                    price_monthly?: number;
                    price_yearly?: number;
                    is_featured?: boolean;
                    features?: RawPlanFeatures | null;
                    limits?: RawPlanLimits | null;
                }
                fetchedPlans = (p as RawPlan[]).map((plan) => {
                    const feats: RawPlanFeatures = (plan.features ?? {}) as RawPlanFeatures;
                    const lmt: RawPlanLimits = (plan.limits ?? {}) as RawPlanLimits;

                    const mappedFeatures: string[] = [];
                    const maxProducts = lmt.max_products ?? 0;
                    const maxCustomers = lmt.max_customers ?? 0;
                    const maxMessages = lmt.max_messages ?? 0;
                    const maxTokens = lmt.max_tokens ?? 0;
                    const shopsLimit = feats.shops_limit ?? 0;

                    if (maxProducts > 0) mappedFeatures.push(`${maxProducts} бараа`);
                    else if (maxProducts === -1) mappedFeatures.push('Хязгааргүй бараа');

                    const planConfig = getPlanConfig((plan.slug || 'lite') as PlanType);

                    const effectiveTokens = maxTokens > 0 ? maxTokens : planConfig.tokensPerMonth;
                    if (effectiveTokens > 0) {
                        const credits = Math.floor(effectiveTokens / 1000);
                        mappedFeatures.push(`${credits.toLocaleString()} credit/сар`);
                    } else {
                        mappedFeatures.push('Хязгааргүй credit');
                    }

                    if (feats.ai_enabled) mappedFeatures.push('AI чатбот');
                    if (shopsLimit > 1) mappedFeatures.push('Бүх платформ (FB/IG)');
                    else mappedFeatures.push('Facebook холболт');
                    if (feats.analytics && feats.analytics !== 'none')
                        mappedFeatures.push('Тайлан & Analytics');
                    if (feats.priority_support) mappedFeatures.push('Тэргүүлэх дэмжлэг');

                    return {
                        id: plan.slug || plan.id,
                        name: plan.name,
                        price_monthly: plan.price_monthly || 0,
                        price_yearly: plan.price_yearly || 0,
                        features: mappedFeatures,
                        limits: {
                            products: maxProducts > 0 ? maxProducts : 99999,
                            orders: maxCustomers > 0 ? maxCustomers : 99999,
                            messages: maxMessages > 0 ? maxMessages : 99999,
                            tokens: planConfig.tokensPerMonth || 99999,
                        },
                        highlighted: !!plan.is_featured,
                    } satisfies Plan;
                });

                setPlans(fetchedPlans);
                setPlansError(false);
            } else {
                setPlansError(true);
            }

            if (subRes.ok) {
                const d = await subRes.json();
                if (d.plan) {
                    setCurrentPlan(d.plan.slug);
                }
                setUsage(d.usage || { products: 0, orders: 0, messages: 0, tokens: 0 });
                setBillingHistory(d.invoices || []);
                setShopStatus(d.shop_status ?? null);
            }
        } catch (e) {
            logger.error('Алдаа гарлаа', { error: e });
            setPlansError(true);
        } finally {
            setLoading(false);
        }
    }

    async function initSubscription(planId: string, consent?: SubscribeConsent) {
        setSelectedPlan(planId);
        setShowUpgrade(true);
        setPaymentInfo(null);
        setUpgrading(true);
        try {
            const res = await fetch('/api/subscription/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: planId,
                    billing_cycle: billingCycle,
                    ...(consent ? { consent } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.message || 'Алдаа гарлаа');

            if (!data.payment_required) {
                toast.success(data.message || 'Амжилттай шинэчлэгдлээ');
                setShowUpgrade(false);
                fetchData(true);
            } else {
                setPaymentInfo(data);
            }
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
            setShowUpgrade(false);
        } finally {
            setUpgrading(false);
        }
    }

    // Плангууд ачаалагдаагүй үед зөвхөн layout-ийн placeholder — хэзээ ч
    // сонгох боломжтой карт болж рендэрлэгдэх ёсгүй (доорх grid-д шалгана).
    const plansLoaded = plans.length > 0;
    const safePlans = plansLoaded
        ? plans
        : [
              {
                  id: 'starter',
                  name: 'Уншиж байна...',
                  price_monthly: 0,
                  price_yearly: 0,
                  features: [],
                  limits: { products: 0, orders: 0, messages: 0, tokens: 0 },
              },
          ];
    const PLANS = safePlans;
    const plan = PLANS.find((p) => p.id === currentPlan) || PLANS[0];
    const creditsUsed = Math.ceil((usage.tokens || 0) / 1000);
    const creditsMax = Math.floor((plan.limits.tokens || 0) / 1000);
    const usageItems = [
        { label: 'Бүтээгдэхүүн', value: usage.products, max: plan.limits.products, icon: Package },
        { label: 'Захиалга', value: usage.orders, max: plan.limits.orders, icon: BarChart3 },
        { label: 'AI Credit', value: creditsUsed, max: creditsMax, icon: Zap },
    ];

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="h-40 card-outlined animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-72 card-outlined animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const currentPrice = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="Төлбөрийн тохиргоо"
                title="Багц ба төлбөр"
                subtitle="Одоогийн планы хэрэглээ, дараагийн төлбөр, түүх бүгдийг нэг дор удирдаарай."
                actions={
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/70">
                        <Crown className="w-3.5 h-3.5 text-[var(--gold)]" strokeWidth={1.5} />
                        <span className="font-medium tracking-[-0.01em]">{plan.name}</span>
                    </div>
                }
            />


            {/* Current Plan */}
            <div className="card-featured p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[color-mix(in_oklab,var(--gold)_18%,transparent)] text-[var(--gold)]">
                            <Crown className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                                {plan.name} План
                            </p>
                            <p className="text-[11px] text-white/50 tracking-[-0.01em]">Идэвхтэй захиалга</p>
                        </div>
                    </div>
                    <div className="text-left md:text-right">
                        <p className="text-[26px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                            {currentPrice > 0 ? `₮${currentPrice.toLocaleString()}` : 'Үнэгүй'}
                        </p>
                        {currentPrice > 0 && (
                            <p className="text-[11px] text-white/45 tracking-[-0.01em]">
                                {billingCycle === 'monthly' ? '/сар' : '/жил'}
                            </p>
                        )}
                    </div>
                </div>
                {/* Usage Bars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6 pt-5 border-t border-white/[0.08]">
                    {usageItems.map((u) => {
                        const pct = u.max >= 99999 ? 5 : Math.min((u.value / u.max) * 100, 100);
                        const barColor =
                            pct > 85
                                ? 'var(--destructive)'
                                : pct > 65
                                  ? 'var(--warning)'
                                  : 'var(--brand-indigo-400)';
                        return (
                            <div key={u.label}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <u.icon className="w-3.5 h-3.5 text-white/45" strokeWidth={1.5} />
                                        <span className="text-[11px] font-medium text-white/45 uppercase tracking-[0.06em]">
                                            {u.label}
                                        </span>
                                    </div>
                                    <span className="text-[12px] font-semibold text-foreground tabular-nums">
                                        {u.value}
                                        {u.max < 99999 ? `/${u.max}` : ''}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, background: barColor }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3">
                <span
                    className={cn(
                        'text-[13px] tracking-[-0.01em]',
                        billingCycle === 'monthly' ? 'text-foreground font-medium' : 'text-white/45'
                    )}
                >
                    Сарын
                </span>
                <button
                    onClick={() => setBillingCycle((c) => (c === 'monthly' ? 'yearly' : 'monthly'))}
                    className="relative w-11 h-6 rounded-full border border-white/[0.08] bg-white/[0.04] transition-colors"
                    aria-label="Toggle billing cycle"
                >
                    <div
                        className={cn(
                            'absolute top-0.5 w-4 h-4 rounded-full transition-all bg-foreground',
                            billingCycle === 'yearly' ? 'left-6' : 'left-1'
                        )}
                    />
                </button>
                <span
                    className={cn(
                        'text-[13px] tracking-[-0.01em] flex items-center gap-1.5',
                        billingCycle === 'yearly' ? 'text-foreground font-medium' : 'text-white/45'
                    )}
                >
                    Жилийн
                    {!activePromotion?.eligible_billing_cycles?.includes('yearly') && (
                        <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                                background: 'color-mix(in oklab, var(--success) 18%, transparent)',
                                color: 'var(--success)',
                            }}
                        >
                            −17%
                        </span>
                    )}
                </span>
            </div>

            {shopStatus?.requires_consent && (
                <div id="consent-block" className="card-outlined p-5 space-y-3">
                    <h3 className="text-[13.5px] font-semibold text-foreground tracking-[-0.01em]">
                        {t.setup.subscription.consent.title}
                    </h3>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={e => { setTermsAccepted(e.target.checked); setConsentError(''); }}
                            className="mt-0.5 w-4 h-4 accent-[var(--brand-indigo-400)] cursor-pointer"
                        />
                        <span className="text-[12.5px] text-white/70 leading-relaxed tracking-[-0.01em]">
                            <Link href="/terms" target="_blank" rel="noopener noreferrer"
                                className="text-[var(--brand-indigo-400)] underline hover:text-[var(--brand-indigo)]">
                                {t.setup.subscription.consent.termsLinkLabel}
                            </Link>
                            {t.setup.subscription.consent.acceptTermsSuffix}
                            <span className="text-[var(--destructive)] ml-1">*</span>
                        </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={privacyAccepted}
                            onChange={e => { setPrivacyAccepted(e.target.checked); setConsentError(''); }}
                            className="mt-0.5 w-4 h-4 accent-[var(--brand-indigo-400)] cursor-pointer"
                        />
                        <span className="text-[12.5px] text-white/70 leading-relaxed tracking-[-0.01em]">
                            <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                                className="text-[var(--brand-indigo-400)] underline hover:text-[var(--brand-indigo)]">
                                {t.setup.subscription.consent.privacyLinkLabel}
                            </Link>
                            {t.setup.subscription.consent.acceptPrivacySuffix}
                            <span className="text-[var(--destructive)] ml-1">*</span>
                        </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={ageConfirmed}
                            onChange={e => { setAgeConfirmed(e.target.checked); setConsentError(''); }}
                            className="mt-0.5 w-4 h-4 accent-[var(--brand-indigo-400)] cursor-pointer"
                        />
                        <span className="text-[12.5px] text-white/70 leading-relaxed tracking-[-0.01em]">
                            {t.setup.subscription.consent.ageConfirm}
                            <span className="text-[var(--destructive)] ml-1">*</span>
                        </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-white/[0.06]">
                        <input
                            type="checkbox"
                            checked={marketingConsent}
                            onChange={e => setMarketingConsent(e.target.checked)}
                            className="mt-0.5 w-4 h-4 accent-[var(--brand-indigo-400)] cursor-pointer"
                        />
                        <span className="text-[12.5px] text-white/55 leading-relaxed tracking-[-0.01em]">
                            {t.setup.subscription.consent.marketingOptIn}
                            <span className="text-white/40 ml-1">{t.setup.subscription.consent.optional}</span>
                        </span>
                    </label>

                    {consentError && (
                        <div
                            className="mt-2 p-3 rounded-lg text-[11.5px] tracking-[-0.01em]"
                            style={{
                                background: 'color-mix(in oklab, var(--destructive) 12%, transparent)',
                                border: '1px solid color-mix(in oklab, var(--destructive) 30%, transparent)',
                                color: 'var(--destructive)',
                            }}
                        >
                            {consentError}
                        </div>
                    )}
                </div>
            )}

            {/* Plans Grid */}
            {plansError && !plansLoaded ? (
                <div className="card-outlined p-10 flex flex-col items-center justify-center text-center">
                    <AlertTriangle
                        className="w-6 h-6 mb-3"
                        style={{ color: 'var(--destructive)' }}
                        strokeWidth={1.5}
                    />
                    <p className="text-[13.5px] font-semibold text-foreground tracking-[-0.01em] mb-1">
                        Багцын мэдээлэл ачаалахад алдаа гарлаа
                    </p>
                    <p className="text-[12px] text-white/55 mb-4 tracking-[-0.01em]">
                        Сүлжээгээ шалгаад дахин оролдоно уу.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => fetchData()}>
                        Дахин ачаалах
                    </Button>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((p) => {
                    const isCurrent = p.id === currentPlan;
                    const price = billingCycle === 'monthly' ? p.price_monthly : p.price_yearly;
                    const promoApplies =
                        !!activePromotion &&
                        billingCycle === 'yearly' &&
                        activePromotion.eligible_billing_cycles.includes('yearly') &&
                        activePromotion.eligible_plan_slugs.includes(p.id);
                    return (
                        <div
                            key={p.id}
                            className={cn(
                                'relative p-6',
                                p.highlighted ? 'card-featured' : 'card-outlined',
                                isCurrent && 'shadow-[inset_0_0_0_1px_var(--border-accent)]',
                                promoApplies && 'ring-2 ring-violet-500/50'
                            )}
                        >
                            {promoApplies && (
                                <div
                                    className="absolute -top-2.5 right-4 px-2.5 py-0.5 text-[10px] font-semibold rounded-full tracking-[0.06em] flex items-center gap-1"
                                    style={{
                                        background: 'linear-gradient(90deg, var(--brand-violet-500), var(--brand-indigo))',
                                        color: 'white',
                                        boxShadow: 'var(--shadow-cta-indigo)',
                                    }}
                                >
                                    <Gift className="w-3 h-3" strokeWidth={2} />
                                    1 жил төлж 2 жил
                                </div>
                            )}
                            {p.highlighted && (
                                <div
                                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[10px] font-semibold rounded-full tracking-[0.12em] uppercase flex items-center gap-1"
                                    style={{
                                        background:
                                            'linear-gradient(90deg, var(--brand-indigo), var(--brand-violet-500))',
                                        color: 'white',
                                        boxShadow: 'var(--shadow-cta-indigo)',
                                    }}
                                >
                                    <Sparkles className="w-3 h-3" strokeWidth={2} />
                                    Эрэлттэй
                                </div>
                            )}
                            <h4 className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">
                                {p.name}
                            </h4>
                            <p className="text-[26px] font-semibold text-foreground mt-2 tabular-nums tracking-[-0.02em]">
                                {price > 0 ? (
                                    <>
                                        ₮{price.toLocaleString()}
                                        <span className="text-[12px] font-normal text-white/45 ml-0.5">
                                            /{billingCycle === 'monthly' ? 'сар' : 'жил'}
                                        </span>
                                    </>
                                ) : (
                                    'Үнэгүй'
                                )}
                            </p>
                            {promoApplies && (
                                <p className="text-[11.5px] mt-1 font-medium" style={{ color: 'var(--brand-violet-500)' }}>
                                    🎁 {12 + activePromotion!.bonus_months} сар хүчинтэй болно
                                </p>
                            )}
                            <ul className="mt-5 space-y-2.5">
                                {p.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-center gap-2 text-[12.5px] text-white/70 tracking-[-0.01em]"
                                    >
                                        <span
                                            className="flex items-center justify-center w-4 h-4 rounded-full shrink-0"
                                            style={{
                                                background:
                                                    'color-mix(in oklab, var(--brand-indigo) 20%, transparent)',
                                                color: 'var(--brand-indigo-400)',
                                            }}
                                        >
                                            <Check className="w-3 h-3" strokeWidth={2.5} />
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Button
                                onClick={() => {
                                    if (isCurrent) return;
                                    if (shopStatus?.requires_consent) {
                                        if (!termsAccepted || !privacyAccepted || !ageConfirmed) {
                                            setConsentError(t.setup.subscription.consent.errorRequired);
                                            document.getElementById('consent-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            return;
                                        }
                                        initSubscription(p.id, {
                                            terms_accepted: termsAccepted,
                                            privacy_accepted: privacyAccepted,
                                            age_confirmed: ageConfirmed,
                                            marketing_consent: marketingConsent,
                                            terms_version: TERMS_VERSION,
                                            privacy_version: PRIVACY_VERSION,
                                        });
                                    } else {
                                        initSubscription(p.id);
                                    }
                                }}
                                disabled={isCurrent || upgrading || !plansLoaded}
                                variant={isCurrent ? 'ghost' : p.highlighted ? 'primary' : 'outline'}
                                size="md"
                                className="w-full mt-6"
                            >
                                {isCurrent ? 'Одоогийн план' : 'Сонгох'}
                            </Button>
                        </div>
                    );
                })}
            </div>
            )}

            {/* Billing History */}
            {billingHistory.length > 0 && (
                <div className="card-outlined overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                        <h3 className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                            Төлбөрийн түүх
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                                    <th className="text-left px-5 py-3 text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">
                                        Огноо
                                    </th>
                                    <th className="text-left px-5 py-3 text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">
                                        Тайлбар
                                    </th>
                                    <th className="text-right px-5 py-3 text-[11px] font-medium text-white/40 uppercase tracking-[0.08em]">
                                        Дүн
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {billingHistory.map((b, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-3 text-[12.5px] text-white/70 tabular-nums">
                                            {(() => {
                                                const d = new Date(b.date || b.created_at || '');
                                                return isNaN(d.getTime())
                                                    ? '—'
                                                    : d.toLocaleDateString('mn-MN');
                                            })()}
                                        </td>
                                        <td className="px-5 py-3 text-[12.5px] text-foreground tracking-[-0.01em]">
                                            {b.description || ''}
                                        </td>
                                        <td className="px-5 py-3 text-right text-[12.5px] font-semibold text-foreground tabular-nums">
                                            ₮{Number(b.amount).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            {showUpgrade && selectedPlan && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowUpgrade(false);
                            setPaymentInfo(null);
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Багц шинэчлэх"
                        className="bg-[#0c0c0f] rounded-2xl border border-white/[0.08] w-full max-w-sm p-6 shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                                Шинэчлэх
                            </h3>
                            <button
                                onClick={() => setShowUpgrade(false)}
                                className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-white/45" strokeWidth={1.5} />
                            </button>
                        </div>
                        <p className="text-[13px] text-white/55 mb-5 tracking-[-0.01em]">
                            <span className="font-semibold text-foreground">
                                {PLANS.find((p) => p.id === selectedPlan)?.name}
                            </span>{' '}
                            план руу шинэчлэх
                        </p>

                        {upgrading && !paymentInfo ? (
                            <div className="py-10 flex flex-col items-center justify-center text-white/55">
                                <Loader2 className="w-6 h-6 animate-spin mb-2 text-[var(--brand-indigo-400)]" />
                                <span className="text-[12px] tracking-[-0.01em]">
                                    Нэхэмжлэх үүсгэж байна...
                                </span>
                            </div>
                        ) : paymentInfo?.qr_code ? (
                            <>
                                <p className="text-[11px] text-white/45 mb-3 text-center tracking-[-0.01em]">
                                    Дэлгэц дээрх QPay QR кодыг уншуулж төлнө үү
                                </p>
                                <div className="w-48 h-48 bg-white border border-white/[0.08] rounded-2xl mx-auto flex items-center justify-center mb-6 overflow-hidden p-2 shadow-inner">
                                    <Image
                                        src={`data:image/png;base64,${paymentInfo.qr_code}`}
                                        alt="QPay QR"
                                        width={192}
                                        height={192}
                                        className="w-full h-full object-contain"
                                        unoptimized
                                    />
                                </div>
                                <div className="flex flex-col items-center gap-3">
                                    {pollTimedOut ? (
                                        <>
                                            <p
                                                className="text-[11px] text-center tracking-[-0.01em]"
                                                style={{ color: 'var(--warning)' }}
                                            >
                                                Төлбөр автоматаар баталгаажсангүй. Та доорх товчоор
                                                дахин шалгана уу.
                                            </p>
                                            <Button
                                                variant="primary"
                                                size="md"
                                                onClick={manualCheckPayment}
                                                disabled={manualChecking}
                                                className="w-full"
                                            >
                                                {manualChecking
                                                    ? 'Шалгаж байна...'
                                                    : 'Төлбөр шалгах'}
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 text-[11px] text-white/55 tracking-[-0.01em]">
                                            <Loader2 className="w-3 h-3 animate-spin text-[var(--brand-indigo-400)]" />
                                            <span>Төлбөрийг автоматаар хянаж байна...</span>
                                        </div>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="md"
                                        onClick={() => {
                                            setShowUpgrade(false);
                                            setPaymentInfo(null);
                                        }}
                                        className="w-full"
                                    >
                                        Болих
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="py-10 flex flex-col items-center justify-center text-white/55 text-center">
                                <p
                                    className="text-[12px] max-w-[220px] mb-4 tracking-[-0.01em]"
                                    style={{ color: 'var(--destructive)' }}
                                >
                                    Нэхэмжлэх үүсгэхэд алдаа гарлаа. Төлбөрийн систем түр ажиллахгүй байна.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowUpgrade(false)}
                                >
                                    Хаах
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
