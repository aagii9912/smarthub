'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    Crown, Rocket, Building2, Check, X, Sparkles,
    CreditCard, Calendar, TrendingUp, AlertCircle,
    ChevronRight, Download, Clock, Zap, Loader2, RefreshCw
} from 'lucide-react';

// Icon mapping for plans
const planIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    starter: Rocket,
    business: Crown,
    enterprise: Building2,
};

const planColors: Record<string, { bg: string; text: string; gradient: string }> = {
    starter: { bg: 'bg-blue-100', text: 'text-blue-600', gradient: 'from-blue-500 to-blue-600' },
    business: { bg: 'bg-gradient-to-br from-indigo-500 to-purple-500', text: 'text-white', gradient: 'from-indigo-500 to-purple-500' },
    enterprise: { bg: 'bg-orange-100', text: 'text-orange-600', gradient: 'from-orange-500 to-orange-600' },
};

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

interface Subscription {
    id: string;
    plan_id: string;
    status: string;
    billing_period: 'monthly' | 'yearly';
    current_period_start: string;
    current_period_end: string;
    plans?: Plan;
}

interface Invoice {
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
    created_at: string;
    paid_at: string | null;
}

interface SubscriptionData {
    subscription: Subscription | null;
    plan: Plan | null;
    usage: Record<string, number>;
    invoices: Invoice[];
    has_subscription: boolean;
}

export default function SubscriptionPage() {
    const { shop } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<SubscriptionData | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            // Fetch current subscription and plans in parallel
            const [currentRes, plansRes] = await Promise.all([
                fetch('/api/subscription/current'),
                fetch('/api/subscription/plans')
            ]);

            if (!currentRes.ok) {
                const errData = await currentRes.json();
                throw new Error(errData.error || 'Failed to fetch subscription');
            }

            const currentData = await currentRes.json();
            const plansData = await plansRes.json();

            setData(currentData);
            setPlans(plansData.plans || []);

            // Set billing period from subscription if exists
            if (currentData.subscription?.billing_period) {
                setBillingPeriod(currentData.subscription.billing_period);
            }
        } catch (err: any) {
            console.error('Subscription fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('mn-MN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getUsagePercent = (used: number, limit: number | null) => {
        if (limit === null || limit === 0) return 0;
        return Math.min((used / limit) * 100, 100);
    };

    const getPlanIcon = (slug: string) => {
        return planIcons[slug] || Rocket;
    };

    const getPlanColor = (slug: string) => {
        return planColors[slug] || planColors.starter;
    };

    // Convert features object/array to displayable array with icons
    const getFeaturesList = (features: Record<string, unknown> | string[] | null, planSlug?: string): string[] => {
        if (!features) return [];
        if (Array.isArray(features)) return features;

        // User-friendly feature labels with icons
        const featureLabels: Record<string, { icon: string; label: string; showValue?: boolean }> = {
            // AI Features
            ai_enabled: { icon: '🤖', label: 'AI идэвхтэй' },
            ai_model: { icon: '🧠', label: 'AI загвар' },
            ai_memory: { icon: '💭', label: 'AI санах ой' },
            sales_intelligence: { icon: '📈', label: 'Борлуулалтын оюун ухаан' },

            // Cart & CRM
            cart_system: { icon: '🛒', label: 'Сагсны систем' },
            crm_analytics: { icon: '📊', label: 'CRM аналитик' },
            payment_integration: { icon: '💳', label: 'Төлбөр холболт' },

            // Messaging & Support
            comment_reply: { icon: '💬', label: 'Коммент хариулт' },
            bulk_marketing: { icon: '📢', label: 'Масс мессеж' },
            priority_support: { icon: '⭐', label: 'Тусламж' },
            appointment_booking: { icon: '📅', label: 'Цаг захиалга' },

            // Limits & Extras
            max_messages: { icon: '💬', label: 'мессеж/сар', showValue: true },
            messages_per_month: { icon: '💬', label: 'мессеж/сар', showValue: true },
            max_shops: { icon: '🏪', label: 'дэлгүүр', showValue: true },
            shops_limit: { icon: '🏪', label: 'дэлгүүр', showValue: true },
            max_products: { icon: '📦', label: 'бүтээгдэхүүн', showValue: true },
            max_customers: { icon: '👥', label: 'харилцагч', showValue: true },

            // Other
            auto_tagging: { icon: '🏷️', label: 'Авто таг' },
            excel_export: { icon: '📥', label: 'Excel экспорт' },
            custom_branding: { icon: '🎨', label: 'Хувийн брэнд' },
            analytics: { icon: '📊', label: 'Аналитик' },
        };

        // AI model user-friendly names
        const aiModelNames: Record<string, string> = {
            'gpt-4o-mini': 'Стандарт AI',
            'gpt-4o': 'Ахисан түвшний AI',
            'gpt-4': 'Ахисан түвшний AI',
        };

        const featureStrings: string[] = [];

        for (const [key, value] of Object.entries(features)) {
            const config = featureLabels[key];
            if (!config) continue;

            // Handle AI model specially
            if (key === 'ai_model' && typeof value === 'string') {
                const modelName = aiModelNames[value] || value;
                featureStrings.push(`${config.icon} ${modelName}`);
                continue;
            }

            // Handle boolean features
            if (value === true) {
                featureStrings.push(`${config.icon} ${config.label}`);
            }
            // Handle numeric limits
            else if (typeof value === 'number' && value !== 0 && config.showValue) {
                if (value === -1) {
                    featureStrings.push(`${config.icon} Хязгааргүй ${config.label}`);
                } else {
                    featureStrings.push(`${config.icon} ${value.toLocaleString()} ${config.label}`);
                }
            }
            // Handle string values for cart/crm levels
            else if (typeof value === 'string' && value !== 'none') {
                const levelNames: Record<string, string> = {
                    'basic': 'Энгийн',
                    'full': 'Бүрэн',
                    'advanced': 'Ахисан'
                };
                const levelName = levelNames[value] || value;
                // Only show if not basic or if explicitly showing
                if (value !== 'basic' || ['cart_system', 'crm_analytics'].includes(key)) {
                    featureStrings.push(`${config.icon} ${config.label}`);
                }
            }
        }

        return featureStrings;
    };

    // Loading State
    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="space-y-6 max-w-5xl">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-red-900">Алдаа гарлаа</h3>
                        <p className="text-red-600 mt-2">{error}</p>
                        <Button onClick={() => fetchData()} className="mt-4">
                            Дахин оролдох
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const subscription = data?.subscription;
    const currentPlan = data?.plan;
    const invoices = data?.invoices || [];
    const usage = data?.usage || {};

    // No subscription state
    if (!subscription) {
        return (
            <div className="space-y-6 max-w-5xl">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Захиалга</h1>
                    <p className="text-gray-500 mt-1">Төлөвлөгөө сонгоорой</p>
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4">
                    <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                        Сараар
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
                        Жилээр
                        <span className="ml-2 text-xs text-green-600 font-semibold">2 сар үнэгүй</span>
                    </span>
                </div>

                {/* Plans Grid - Filter out free plan */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plans
                        .filter(plan => plan.slug !== 'free') // Hide free plan
                        .map((plan) => {
                            const PlanIcon = getPlanIcon(plan.slug);
                            const colors = getPlanColor(plan.slug);
                            const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
                            // Highlight Pro/Professional as featured
                            const isFeatured = plan.is_featured || plan.slug === 'professional' || plan.slug === 'pro';


                            return (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-2xl border p-6 transition-all ${isFeatured
                                        ? 'border-indigo-300 bg-white shadow-lg scale-105'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                >
                                    {isFeatured && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 text-xs font-semibold text-white">
                                                <Sparkles className="w-3 h-3" />
                                                Санал болгох
                                            </span>
                                        </div>
                                    )}

                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colors.bg}`}>
                                        <PlanIcon className={`w-6 h-6 ${colors.text}`} />
                                    </div>

                                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                                    {plan.description && (
                                        <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                                    )}

                                    <div className="mt-2 mb-4">
                                        {price ? (
                                            <>
                                                <span className="text-2xl font-bold text-gray-900">
                                                    {formatCurrency(price)}
                                                </span>
                                                <span className="text-gray-500">/{billingPeriod === 'monthly' ? 'сар' : 'жил'}</span>
                                            </>
                                        ) : (
                                            <span className="text-2xl font-bold text-gray-900">Тохиролцоно</span>
                                        )}
                                    </div>

                                    <ul className="space-y-2 mb-6">
                                        {getFeaturesList(plan.features).map((feature: string, idx: number) => (
                                            <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        variant={isFeatured ? 'primary' : 'secondary'}
                                        className="w-full"
                                        onClick={() => {
                                            setSelectedPlan(plan.slug);
                                            setShowUpgradeModal(true);
                                        }}
                                    >
                                        {plan.slug === 'enterprise' ? 'Холбогдох' : 'Сонгох'}
                                    </Button>
                                </div>
                            );
                        })}
                </div>
            </div>
        );
    }

    // Has subscription - show current plan and options
    const colors = getPlanColor(currentPlan?.slug || 'starter');
    const PlanIcon = getPlanIcon(currentPlan?.slug || 'starter');

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Захиалга</h1>
                    <p className="text-gray-500 mt-1">Төлөвлөгөө болон төлбөрийн удирдлага</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Шинэчлэх
                    </Button>
                    <Link href="/" target="_blank">
                        <Button variant="secondary" className="gap-2">
                            <Sparkles className="w-4 h-4" />
                            Бүх төлөвлөгөө харах
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Current Plan Card */}
            <Card className="overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />
                <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors.bg}`}>
                                <PlanIcon className={`w-7 h-7 ${colors.text}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-gray-900">{currentPlan?.name || 'Unknown'} Plan</h2>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${subscription.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {subscription.status === 'active' ? 'Идэвхтэй' : 'Түр зогссон'}
                                    </span>
                                </div>
                                <p className="text-gray-500 mt-1">
                                    {subscription.billing_period === 'monthly' ? 'Сар бүр' : 'Жил бүр'} төлбөр
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setShowUpgradeModal(true)}
                                className="gap-2"
                            >
                                <TrendingUp className="w-4 h-4" />
                                Шинэчлэх
                            </Button>
                            <Button variant="ghost" className="text-red-600 hover:bg-red-50">
                                Цуцлах
                            </Button>
                        </div>
                    </div>

                    {/* Billing Info */}
                    <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Дараагийн төлбөр</p>
                                <p className="font-semibold text-gray-900">
                                    {formatCurrency(
                                        subscription.billing_period === 'monthly'
                                            ? currentPlan?.price_monthly || 0
                                            : currentPlan?.price_yearly || 0
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Төлбөрийн огноо</p>
                                <p className="font-semibold text-gray-900">
                                    {formatDate(subscription.current_period_end)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Төлбөрийн арга</p>
                                <p className="font-semibold text-gray-900">QPay</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Usage Stats - Premium Design */}
            <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        Хэрэглээний статистик
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Messages Stat Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Мессеж</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {(usage.messages || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <Zap className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Хэрэглэсэн</span>
                                    <span className="font-medium text-indigo-600">Хязгааргүй ∞</span>
                                </div>
                                <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                        style={{ width: '35%' }}
                                    />
                                </div>
                            </div>
                            {/* Decorative element */}
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full" />
                        </div>

                        {/* Products Stat Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Бүтээгдэхүүн</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {usage.products || 0}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Лимит</span>
                                    <span className={`font-medium ${getUsagePercent(usage.products || 0, 500) > 80 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                        {usage.products || 0} / 500
                                    </span>
                                </div>
                                <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${getUsagePercent(usage.products || 0, 500) > 80
                                            ? 'bg-gradient-to-r from-orange-500 to-red-500'
                                            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                            }`}
                                        style={{ width: `${getUsagePercent(usage.products || 0, 500)}%` }}
                                    />
                                </div>
                            </div>
                            {/* Decorative element */}
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full" />
                        </div>

                        {/* Facebook Pages Stat Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Facebook хуудас</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">
                                        {usage.pages || 1}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Хуудас</span>
                                    <span className="font-medium text-blue-600">{usage.pages || 1} / 3</span>
                                </div>
                                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                        style={{ width: `${getUsagePercent(usage.pages || 1, 3)}%` }}
                                    />
                                </div>
                            </div>
                            {/* Decorative element */}
                            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full" />
                        </div>
                    </div>

                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">{usage.customers || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">Харилцагч</p>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <p className="text-2xl font-bold text-gray-900">{usage.orders || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">Захиалга</p>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <p className="text-2xl font-bold text-emerald-600">{usage.orders_this_month || 0}</p>
                            <p className="text-xs text-gray-500 mt-1">Энэ сарын захиалга</p>
                        </div>
                        <div className="text-center border-l border-gray-200">
                            <p className="text-2xl font-bold text-violet-600">{formatCurrency(usage.revenue_this_month || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">Энэ сарын орлого</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Billing History */}
            {invoices.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-violet-600" />
                            Төлбөрийн түүх
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y divide-gray-100">
                            {invoices.map((invoice) => (
                                <div key={invoice.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${invoice.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'
                                            }`}>
                                            {invoice.status === 'paid' ? (
                                                <Check className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <Clock className="w-5 h-5 text-yellow-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{formatDate(invoice.created_at)}</p>
                                            <p className="text-sm text-gray-500">{invoice.invoice_number}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-semibold text-gray-900">{formatCurrency(invoice.amount)}</span>
                                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                            <Download className="w-4 h-4 text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Available Plans */}
            {plans.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Бусад төлөвлөгөөнүүд</h2>

                    {/* Billing Toggle */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                            Сараар
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
                            Жилээр
                            <span className="ml-2 text-xs text-green-600 font-semibold">2 сар үнэгүй</span>
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans
                            .filter(plan => plan.slug !== 'free') // Hide free plan
                            .map((plan) => {
                                const isCurrentPlan = plan.id === subscription.plan_id;
                                const PlanIconItem = getPlanIcon(plan.slug);
                                const colorsItem = getPlanColor(plan.slug);
                                const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
                                // Highlight Pro/Professional as featured
                                const isFeaturedItem = plan.is_featured || plan.slug === 'professional' || plan.slug === 'pro';

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-2xl border p-6 transition-all ${isCurrentPlan
                                            ? 'border-violet-300 bg-violet-50/50'
                                            : isFeaturedItem
                                                ? 'border-indigo-300 bg-white shadow-lg scale-105'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                    >
                                        {isFeaturedItem && !isCurrentPlan && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 text-xs font-semibold text-white">
                                                    <Sparkles className="w-3 h-3" />
                                                    Санал болгох
                                                </span>
                                            </div>
                                        )}

                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorsItem.bg}`}>
                                            <PlanIconItem className={`w-6 h-6 ${colorsItem.text}`} />
                                        </div>

                                        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>

                                        <div className="mt-2 mb-4">
                                            {price ? (
                                                <>
                                                    <span className="text-2xl font-bold text-gray-900">
                                                        {formatCurrency(price)}
                                                    </span>
                                                    <span className="text-gray-500">/{billingPeriod === 'monthly' ? 'сар' : 'жил'}</span>
                                                </>
                                            ) : (
                                                <span className="text-2xl font-bold text-gray-900">Тохиролцоно</span>
                                            )}
                                        </div>

                                        <ul className="space-y-2 mb-6">
                                            {getFeaturesList(plan.features).map((feature: string, idx: number) => (
                                                <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>

                                        {isCurrentPlan ? (
                                            <div className="w-full py-2.5 text-center text-sm font-medium text-violet-600 bg-violet-100 rounded-lg">
                                                Одоогийн төлөвлөгөө
                                            </div>
                                        ) : (
                                            <Button
                                                variant={plan.is_featured ? 'primary' : 'secondary'}
                                                className="w-full"
                                                onClick={() => {
                                                    setSelectedPlan(plan.slug);
                                                    setShowUpgradeModal(true);
                                                }}
                                            >
                                                {plan.slug === 'enterprise' ? 'Холбогдох' : 'Сонгох'}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Төлбөр төлөх</h3>
                                    <p className="text-sm text-gray-500">QPay-ээр хялбар төлнө үү</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Plan Summary */}
                        <div className="bg-gray-50 p-4 rounded-xl mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-medium text-gray-700">Сонгосон багц:</span>
                                <span className="font-bold text-violet-700 uppercase">
                                    {selectedPlan || 'Pro'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600">Хугацаа:</span>
                                <span className="text-sm text-gray-900">
                                    {billingPeriod === 'monthly' ? '1 сар' : '1 жил (2 сар үнэгүй)'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                <span className="font-bold text-gray-900">Нийт дүн:</span>
                                <span className="font-bold text-xl text-violet-700">
                                    {formatCurrency(
                                        plans.find(p => p.slug === selectedPlan)?.[
                                        billingPeriod === 'monthly' ? 'price_monthly' : 'price_yearly'
                                        ] || 0
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* QR Code Placeholder */}
                        <div className="text-center mb-6">
                            <p className="text-sm font-medium text-gray-700 mb-3">Банкны апп-аар уншуулна уу</p>
                            <div className="w-48 h-48 bg-white border-2 border-gray-100 rounded-xl mx-auto flex items-center justify-center shadow-sm p-2">
                                {/* Simulated QR */}
                                <div className="w-full h-full bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://qpay.mn/mock')] bg-contain bg-no-repeat bg-center opacity-80" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Төлбөр төлөгдсөний дараа автоматаар идэвхжинэ</p>
                        </div>

                        {/* Banks Icons (Mock) */}
                        <div className="flex justify-center gap-3 mb-6 opacity-60 grayscale hover:grayscale-0 transition-all">
                            <div className="w-8 h-8 rounded bg-blue-600" title="Khan Bank"></div>
                            <div className="w-8 h-8 rounded bg-green-600" title="TDB"></div>
                            <div className="w-8 h-8 rounded bg-orange-600" title="Golomt"></div>
                            <div className="w-8 h-8 rounded bg-red-600" title="XacBank"></div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setShowUpgradeModal(false)}
                            >
                                Болих
                            </Button>
                            <Button
                                className="flex-1 bg-violet-600 hover:bg-violet-700"
                                onClick={() => {
                                    // Simulate payment success
                                    setLoading(true);
                                    setTimeout(() => {
                                        setLoading(false);
                                        setShowUpgradeModal(false);
                                        fetchData(true); // Refresh data
                                        // You would typically show a success toast here
                                    }, 2000);
                                }}
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Төлбөр шалгах
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
