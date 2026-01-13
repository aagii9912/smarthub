'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
    CreditCard, Search, Filter, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, AlertCircle, Clock
} from 'lucide-react';

interface Subscription {
    id: string;
    shop_id: string;
    plan_id: string;
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    current_period_start: string;
    current_period_end: string;
    created_at: string;
    shops: { id: string; name: string; email: string };
    plans: { id: string; name: string; price_monthly: number; price_yearly: number };
}

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSubscriptions();
    }, [page, statusFilter]);

    async function fetchSubscriptions() {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: page.toString(), limit: '10' });
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`/api/admin/subscriptions?${params}`);
            if (res.ok) {
                const data = await res.json();
                setSubscriptions(data.subscriptions || []);
                setTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(subscriptionId: string, newStatus: string) {
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription_id: subscriptionId, status: newStatus })
            });
            if (res.ok) {
                fetchSubscriptions();
            }
        } catch (error) {
            console.error('Update error:', error);
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'canceled': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'past_due': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'trialing': return <Clock className="w-4 h-4 text-blue-500" />;
            default: return null;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-green-100 text-green-700',
            canceled: 'bg-red-100 text-red-700',
            past_due: 'bg-yellow-100 text-yellow-700',
            trialing: 'bg-blue-100 text-blue-700'
        };
        return styles[status] || 'bg-gray-100 text-gray-700';
    };

    const formatMoney = (amount: number) => `₮${amount.toLocaleString()}`;

    const filteredSubscriptions = subscriptions.filter(sub =>
        !searchTerm ||
        sub.shops?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.plans?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
                    <p className="text-gray-500 mt-1">Бүх subscription удирдах</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Дэлгүүр хайх..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="">Бүх статус</option>
                            <option value="active">Active</option>
                            <option value="trialing">Trialing</option>
                            <option value="past_due">Past Due</option>
                            <option value="canceled">Canceled</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredSubscriptions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Subscription олдсонгүй
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Дэлгүүр</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Багц</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Үнэ</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Дуусах огноо</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Үйлдэл</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredSubscriptions.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{sub.shops?.name}</p>
                                                    <p className="text-sm text-gray-500">{sub.shops?.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">{sub.plans?.name}</td>
                                            <td className="px-6 py-4 text-gray-900">
                                                {formatMoney(sub.plans?.price_monthly || 0)}/сар
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(sub.status)}`}>
                                                    {getStatusIcon(sub.status)}
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('mn-MN') : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={sub.status}
                                                    onChange={(e) => updateStatus(sub.id, e.target.value)}
                                                    className="text-sm border border-gray-200 rounded px-2 py-1"
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="trialing">Trialing</option>
                                                    <option value="past_due">Past Due</option>
                                                    <option value="canceled">Canceled</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" /> Өмнөх
                            </button>
                            <span className="text-sm text-gray-500">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                                Дараах <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
