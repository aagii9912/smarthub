'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    Crown, Rocket, Building2, Check, X, Sparkles,
    CreditCard, Calendar, TrendingUp, AlertCircle,
    ChevronRight, Download, Clock, Zap
} from 'lucide-react';

// Plan data
const plans = [
    {
        id: 'starter',
        name: 'Starter',
        icon: Rocket,
        price: { monthly: 49000, yearly: 490000 },
        color: 'blue',
        features: ['1 Facebook хуудас', '500 мессеж/сар', '50 бүтээгдэхүүн', 'Імэйл дэмжлэг']
    },
    {
        id: 'business',
        name: 'Business',
        icon: Crown,
        price: { monthly: 99000, yearly: 990000 },
        color: 'indigo',
        recommended: true,
        features: ['3 Facebook хуудас', 'Хязгааргүй мессеж', '500 бүтээгдэхүүн', 'CRM + Аналитик', 'QPay интеграц']
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        icon: Building2,
        price: { monthly: null, yearly: null },
        color: 'orange',
        features: ['Хязгааргүй бүгд', 'Тусгай AI', '24/7 дэмжлэг', 'API хандалт', 'Dedicated менежер']
    }
];

// Mock subscription data - in real app, fetch from API
const mockSubscription: {
    plan: string;
    status: string;
    billingPeriod: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingDate: string;
    amount: number;
    paymentMethod: string;
    usage: {
        messages: { used: number; limit: number | null };
        products: { used: number; limit: number };
        pages: { used: number; limit: number };
    };
} = {
    plan: 'business',
    status: 'active',
    billingPeriod: 'monthly',
    currentPeriodStart: '2026-01-01',
    currentPeriodEnd: '2026-02-01',
    nextBillingDate: '2026-02-01',
    amount: 99000,
    paymentMethod: 'QPay',
    usage: {
        messages: { used: 2450, limit: null },
        products: { used: 127, limit: 500 },
        pages: { used: 2, limit: 3 }
    }
};

// Mock billing history
const billingHistory = [
    { id: 1, date: '2026-01-01', amount: 99000, status: 'paid', invoice: 'INV-2026-001' },
    { id: 2, date: '2025-12-01', amount: 99000, status: 'paid', invoice: 'INV-2025-012' },
    { id: 3, date: '2025-11-01', amount: 99000, status: 'paid', invoice: 'INV-2025-011' },
    { id: 4, date: '2025-10-01', amount: 49000, status: 'paid', invoice: 'INV-2025-010' },
];

export default function SubscriptionPage() {
    const { shop } = useAuth();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    const subscription = mockSubscription;
    const currentPlan = plans.find(p => p.id === subscription.plan);

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
        if (limit === null) return 0;
        return Math.min((used / limit) * 100, 100);
    };

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Захиалга</h1>
                    <p className="text-gray-500 mt-1">Төлөвлөгөө болон төлбөрийн удирдлага</p>
                </div>
                <Link href="/" target="_blank">
                    <Button variant="secondary" className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Бүх төлөвлөгөө харах
                    </Button>
                </Link>
            </div>

            {/* Current Plan Card */}
            <Card className="overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${subscription.plan === 'starter' ? 'from-blue-500 to-blue-600' :
                    subscription.plan === 'business' ? 'from-indigo-500 to-purple-500' :
                        'from-orange-500 to-orange-600'
                    }`} />
                <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${subscription.plan === 'starter' ? 'bg-blue-100' :
                                subscription.plan === 'business' ? 'bg-gradient-to-br from-indigo-500 to-purple-500' :
                                    'bg-orange-100'
                                }`}>
                                {currentPlan && (
                                    <currentPlan.icon className={`w-7 h-7 ${subscription.plan === 'business' ? 'text-white' :
                                        subscription.plan === 'starter' ? 'text-blue-600' : 'text-orange-600'
                                        }`} />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-gray-900">{currentPlan?.name} Plan</h2>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${subscription.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {subscription.status === 'active' ? 'Идэвхтэй' : 'Түр зогссон'}
                                    </span>
                                </div>
                                <p className="text-gray-500 mt-1">
                                    {subscription.billingPeriod === 'monthly' ? 'Сар бүр' : 'Жил бүр'} төлбөр
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
                                <p className="font-semibold text-gray-900">{formatCurrency(subscription.amount)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Төлбөрийн огноо</p>
                                <p className="font-semibold text-gray-900">{formatDate(subscription.nextBillingDate)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Төлбөрийн арга</p>
                                <p className="font-semibold text-gray-900">{subscription.paymentMethod}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-violet-600" />
                        Хэрэглээний статистик
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Messages */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Мессеж</span>
                            <span className="text-sm text-gray-500">
                                {subscription.usage.messages.used.toLocaleString()}
                                {subscription.usage.messages.limit ? ` / ${subscription.usage.messages.limit.toLocaleString()}` : ' (Хязгааргүй)'}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                style={{ width: subscription.usage.messages.limit ? `${getUsagePercent(subscription.usage.messages.used, subscription.usage.messages.limit)}%` : '30%' }}
                            />
                        </div>
                    </div>

                    {/* Products */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Бүтээгдэхүүн</span>
                            <span className="text-sm text-gray-500">
                                {subscription.usage.products.used} / {subscription.usage.products.limit}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${getUsagePercent(subscription.usage.products.used, subscription.usage.products.limit) > 80
                                    ? 'bg-orange-500'
                                    : 'bg-green-500'
                                    }`}
                                style={{ width: `${getUsagePercent(subscription.usage.products.used, subscription.usage.products.limit)}%` }}
                            />
                        </div>
                    </div>

                    {/* Facebook Pages */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Facebook хуудас</span>
                            <span className="text-sm text-gray-500">
                                {subscription.usage.pages.used} / {subscription.usage.pages.limit}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${getUsagePercent(subscription.usage.pages.used, subscription.usage.pages.limit)}%` }}
                            />
                        </div>
                    </div>

                    {subscription.usage.products.used / subscription.usage.products.limit! > 0.8 && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-orange-900">Бүтээгдэхүүний хязгаар дөхөж байна</p>
                                <p className="text-sm text-orange-600">Илүү олон бүтээгдэхүүн нэмэхийн тулд шинэчилнэ үү</p>
                            </div>
                            <Button size="sm" onClick={() => setShowUpgradeModal(true)}>
                                Шинэчлэх
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Billing History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-violet-600" />
                        Төлбөрийн түүх
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="divide-y divide-gray-100">
                        {billingHistory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'
                                        }`}>
                                        {item.status === 'paid' ? (
                                            <Check className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-yellow-600" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{formatDate(item.date)}</p>
                                        <p className="text-sm text-gray-500">{item.invoice}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                        <Download className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Available Plans */}
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
                    {plans.map((plan) => {
                        const isCurrentPlan = plan.id === subscription.plan;
                        const PlanIcon = plan.icon;

                        return (
                            <div
                                key={plan.id}
                                className={`relative rounded-2xl border p-6 transition-all ${isCurrentPlan
                                    ? 'border-violet-300 bg-violet-50/50'
                                    : plan.recommended
                                        ? 'border-indigo-300 bg-white shadow-lg'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                            >
                                {plan.recommended && !isCurrentPlan && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 text-xs font-semibold text-white">
                                            <Sparkles className="w-3 h-3" />
                                            Санал болгох
                                        </span>
                                    </div>
                                )}

                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.id === 'starter' ? 'bg-blue-100' :
                                    plan.id === 'business' ? 'bg-gradient-to-br from-indigo-500 to-purple-500' :
                                        'bg-orange-100'
                                    }`}>
                                    <PlanIcon className={`w-6 h-6 ${plan.id === 'business' ? 'text-white' :
                                        plan.id === 'starter' ? 'text-blue-600' : 'text-orange-600'
                                        }`} />
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>

                                <div className="mt-2 mb-4">
                                    {plan.price[billingPeriod] ? (
                                        <>
                                            <span className="text-2xl font-bold text-gray-900">
                                                {formatCurrency(plan.price[billingPeriod]!)}
                                            </span>
                                            <span className="text-gray-500">/{billingPeriod === 'monthly' ? 'сар' : 'жил'}</span>
                                        </>
                                    ) : (
                                        <span className="text-2xl font-bold text-gray-900">Тохиролцоно</span>
                                    )}
                                </div>

                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                            <Check className="w-4 h-4 text-green-500" />
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
                                        variant={plan.recommended ? 'primary' : 'secondary'}
                                        className="w-full"
                                        onClick={() => {
                                            setSelectedPlan(plan.id);
                                            setShowUpgradeModal(true);
                                        }}
                                    >
                                        {plan.id === 'enterprise' ? 'Холбогдох' : 'Сонгох'}
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Төлөвлөгөө шинэчлэх</h3>
                                <p className="text-sm text-gray-500">Илүү олон боломжтой болоорой</p>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl mb-4">
                            <p className="text-sm text-gray-600">
                                {selectedPlan === 'enterprise'
                                    ? 'Enterprise төлөвлөгөө авахын тулд бидэнтэй холбогдоно уу.'
                                    : 'Шинэ төлөвлөгөө руу шилжихэд одоогийн үлдэгдэл дуусах хүртэл хүлээх шаардлагагүй.'}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => setShowUpgradeModal(false)}
                            >
                                Болих
                            </Button>
                            <Button className="flex-1">
                                {selectedPlan === 'enterprise' ? 'Холбогдох' : 'Шинэчлэх'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
