'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
    Users, CreditCard, TrendingUp, Package,
    ArrowUpRight, Clock, FileText
} from 'lucide-react';

interface DashboardData {
    stats: {
        total_shops: number;
        subscriptions: {
            active: number;
            canceled: number;
            past_due: number;
            total: number;
        };
        revenue: {
            total_revenue: number;
            pending_revenue: number;
            paid_count: number;
            pending_count: number;
        };
        plans_count: number;
    };
    plans: Array<{ id: string; name: string; price_monthly: number }>;
    recent_shops: Array<{ id: string; name: string; created_at: string }>;
    recent_invoices: Array<{ id: string; amount: number; status: string; created_at: string; shops: { name: string } }>;
}

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    async function fetchDashboard() {
        try {
            const res = await fetch('/api/admin/dashboard');
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            console.error('Dashboard error:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Failed to load dashboard</p>
            </div>
        );
    }

    const formatMoney = (amount: number) => {
        return `₮${amount.toLocaleString()}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview</h1>
                <p className="text-sm text-gray-500 mt-1">Key metrics and recent activity across your platform.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Shops */}
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                            <Users className="w-16 h-16" />
                        </div>
                        <div className="flex flex-col justify-between h-full relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl ring-1 ring-violet-100">
                                    <Users className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-gray-600">Total Shops</p>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {data.stats.total_shops}
                                </h3>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Active Subscriptions */}
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                            <CreditCard className="w-16 h-16" />
                        </div>
                        <div className="flex flex-col justify-between h-full relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl ring-1 ring-sky-100">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-gray-600">Active Subs</p>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {data.stats.subscriptions.active}
                                </h3>
                                {data.stats.subscriptions.past_due > 0 && (
                                    <p className="text-xs font-medium text-amber-600 mt-1.5 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                        {data.stats.subscriptions.past_due} past due
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Revenue */}
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-16 h-16" />
                        </div>
                        <div className="flex flex-col justify-between h-full relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl ring-1 ring-emerald-100">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {formatMoney(data.stats.revenue.total_revenue)}
                                </h3>
                                <p className="text-xs font-medium text-gray-500 mt-1.5">
                                    {data.stats.revenue.paid_count} payments
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Plans */}
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-6 relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                            <Package className="w-16 h-16" />
                        </div>
                        <div className="flex flex-col justify-between h-full relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl ring-1 ring-amber-100">
                                    <Package className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-gray-600">Active Plans</p>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                                    {data.stats.plans_count}
                                </h3>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Shops */}
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-gray-50 bg-white flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-900">Recent Shops</h2>
                        <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded-md">New</span>
                    </div>
                    <CardContent className="p-0 flex-1">
                        {data.recent_shops.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                <Users className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-sm">No recent shops</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {data.recent_shops.map((shop) => (
                                    <div key={shop.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm border border-gray-200">
                                                {shop.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{shop.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(shop.created_at).toLocaleDateString('mn-MN')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-violet-600 group-hover:border-violet-200 transition-colors">
                                            <ArrowUpRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Invoices */}
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-gray-50 bg-white flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-900">Recent Invoices</h2>
                    </div>
                    <CardContent className="p-0 flex-1">
                        {data.recent_invoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                <FileText className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-sm">No invoices yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {data.recent_invoices.map((invoice) => (
                                    <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{invoice.shops?.name}</p>
                                            <p className="text-sm font-semibold text-gray-700 mt-0.5">{formatMoney(invoice.amount)}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 text-xs rounded-lg font-medium border ${invoice.status === 'paid'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            : invoice.status === 'pending'
                                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                : 'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Plans Overview */}
            <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-50 bg-white">
                    <h2 className="text-base font-semibold text-gray-900">Plans Overview</h2>
                </div>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {data.plans.map((plan) => (
                            <div key={plan.id} className="p-5 bg-gray-50/50 border border-gray-100 rounded-xl text-center hover:bg-gray-50 transition-colors">
                                <p className="text-sm font-medium text-gray-700">{plan.name}</p>
                                <div className="mt-2 flex items-baseline justify-center gap-1">
                                    <p className="text-xl font-bold text-gray-900 tracking-tight">
                                        {plan.price_monthly === 0 ? 'Free' : formatMoney(plan.price_monthly)}
                                    </p>
                                    <p className="text-xs font-medium text-gray-500">/mo</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
