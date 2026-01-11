'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Search, Filter, Users, ToggleLeft, ToggleRight,
    Loader2, ExternalLink, MoreVertical
} from 'lucide-react';

interface Shop {
    id: string;
    name: string;
    description: string | null;
    facebook_page_id: string | null;
    is_active: boolean;
    created_at: string;
    subscriptions: Array<{
        id: string;
        status: string;
        billing_cycle: string;
        current_period_end: string;
        plans: {
            id: string;
            name: string;
            price_monthly: number;
        };
    }>;
}

export default function ShopsPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

    useEffect(() => {
        fetchShops();
    }, [pagination.page, statusFilter]);

    async function fetchShops() {
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: '20'
            });
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);

            const res = await fetch(`/api/admin/shops?${params}`);
            if (res.ok) {
                const data = await res.json();
                setShops(data.shops || []);
                setPagination(p => ({
                    ...p,
                    total: data.pagination.total,
                    pages: data.pagination.pages
                }));
            }
        } catch (error) {
            console.error('Fetch shops error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function toggleShopStatus(id: string, currentStatus: boolean) {
        try {
            const res = await fetch('/api/admin/shops', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentStatus })
            });

            if (res.ok) {
                setShops(shops.map(s =>
                    s.id === id ? { ...s, is_active: !currentStatus } : s
                ));
            }
        } catch (error) {
            console.error('Toggle status error:', error);
        }
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPagination(p => ({ ...p, page: 1 }));
        fetchShops();
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('mn-MN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Shops</h1>
                    <p className="text-gray-500 mt-1">Manage all registered shops</p>
                </div>
                <div className="text-sm text-gray-500">
                    Total: {pagination.total} shops
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search shops..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                />
                            </div>
                        </form>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Shops Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {shops.map((shop) => (
                                    <tr key={shop.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                                                    <Users className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{shop.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {shop.facebook_page_id ? 'FB Connected' : 'No FB'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shop.subscriptions?.[0]?.plans ? (
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {shop.subscriptions[0].plans.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        ₮{shop.subscriptions[0].plans.price_monthly.toLocaleString()}/mo
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">No plan</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleShopStatus(shop.id, shop.is_active)}
                                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${shop.is_active
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                    }`}
                                            >
                                                {shop.is_active ? (
                                                    <ToggleRight className="w-4 h-4" />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4" />
                                                )}
                                                {shop.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {formatDate(shop.created_at)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 hover:bg-gray-100 rounded-lg">
                                                <MoreVertical className="w-4 h-4 text-gray-500" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Page {pagination.page} of {pagination.pages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
