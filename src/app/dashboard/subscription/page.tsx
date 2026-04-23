'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getPlanConfig, PlanType } from '@/lib/ai/config/plans';
import {
    Crown,
    Check,
    Zap,
    BarChart3,
    Package,
    CreditCard,
    Loader2,
    X,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { cn } from '@/lib/utils';

interface Plan {
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    features: string[];
    limits: { products: number; orders: number; messages: number; tokens: number };
    highlighted?: boolean;
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
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [upgrading, setUpgrading] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState<{
        invoice_id?: string;
        qr_code?: string;
        urls?: QpayUrl[];
    } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

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
                const { plans: p } = await plansRes.json();
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
                    if (feats.priority_support) mappedFeatures.push('Priority support');

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
            }

            if (subRes.ok) {
                const d = await subRes.json();
                if (d.plan) {
                    setCurrentPlan(d.plan.slug);
                }
                setUsage(d.usage || { products: 0, orders: 0, messages: 0, tokens: 0 });
                setBillingHistory(d.invoices || []);
            }
        } catch (e) {
            logger.error('Алдаа гарлаа', { error: e });
        } finally {
            setLoading(false);
        }
    }

    async function initSubscription(planId: string) {
        setSelectedPlan(planId);
        setShowUpgrade(true);
        setPaymentInfo(null);
        setUpgrading(true);
        try {
            const res = await fetch('/api/subscription/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
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

    const safePlans =
        plans.length > 0
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
                title="Subscription & Билл"
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
                            ₮{currentPrice.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-white/45 tracking-[-0.01em]">
                            {billingCycle === 'monthly' ? '/сар' : '/жил'}
                        </p>
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
                    <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                            background: 'color-mix(in oklab, var(--success) 18%, transparent)',
                            color: 'var(--success)',
                        }}
                    >
                        −17%
                    </span>
                </span>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((p) => {
                    const isCurrent = p.id === currentPlan;
                    const price = billingCycle === 'monthly' ? p.price_monthly : p.price_yearly;
                    return (
                        <div
                            key={p.id}
                            className={cn(
                                'relative p-6',
                                p.highlighted ? 'card-featured' : 'card-outlined',
                                isCurrent && 'shadow-[inset_0_0_0_1px_var(--border-accent)]'
                            )}
                        >
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
                                    Popular
                                </div>
                            )}
                            <h4 className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">
                                {p.name}
                            </h4>
                            <p className="text-[26px] font-semibold text-foreground mt-2 tabular-nums tracking-[-0.02em]">
                                ₮{price.toLocaleString()}
                                <span className="text-[12px] font-normal text-white/45 ml-0.5">
                                    /{billingCycle === 'monthly' ? 'сар' : 'жил'}
                                </span>
                            </p>
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
                                    if (!isCurrent) {
                                        initSubscription(p.id);
                                    }
                                }}
                                disabled={isCurrent || upgrading}
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
                                            {new Date(b.date || b.created_at || '').toLocaleDateString(
                                                'mn-MN'
                                            )}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0c0c0f] rounded-2xl border border-white/[0.08] w-full max-w-sm p-6 shadow-2xl">
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
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        size="md"
                                        onClick={() => setShowUpgrade(false)}
                                        className="flex-1"
                                    >
                                        Болих
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="md"
                                        className="flex-1"
                                        leftIcon={
                                            upgrading ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <CreditCard className="w-3.5 h-3.5" strokeWidth={1.5} />
                                            )
                                        }
                                        onClick={async () => {
                                            setUpgrading(true);
                                            try {
                                                const checkRes = await fetch(
                                                    '/api/subscription/check-payment',
                                                    {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            invoice_id: paymentInfo?.invoice_id,
                                                        }),
                                                    }
                                                );
                                                const checkData = await checkRes.json();

                                                if (checkData.status === 'paid') {
                                                    toast.success(checkData.message || 'Амжилттай!');
                                                    setShowUpgrade(false);
                                                    fetchData(true);
                                                } else if (checkData.status === 'pending') {
                                                    toast.info(
                                                        checkData.message || 'Төлбөр хүлээгдэж байна'
                                                    );
                                                } else {
                                                    toast.error(checkData.message || 'Алдаа гарлаа');
                                                }
                                            } catch {
                                                toast.error('Төлбөр шалгахад алдаа гарлаа');
                                            }
                                            setUpgrading(false);
                                        }}
                                    >
                                        Төлбөр шалгах
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
