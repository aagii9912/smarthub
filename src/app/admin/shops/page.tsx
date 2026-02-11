'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
    Search, Users, ToggleLeft, ToggleRight,
    Loader2, Edit, X, Save
} from 'lucide-react';

interface Shop {
    id: string;
    name: string;
    owner_name: string | null;
    phone: string | null;
    description: string | null;
    facebook_page_id: string | null;
    is_active: boolean;
    created_at: string;
    plan_id: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
    ai_instructions: string | null;
    ai_emotion: string | null;
    // Direct plan from plan_id
    plans: {
        id: string;
        name: string;
        slug: string;
        price_monthly: number;
    } | null;
    // Subscription with nested plan
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

interface Plan {
    id: string;
    name: string;
    slug: string;
    price_monthly: number;
}

interface EditFormData {
    name: string;
    owner_name: string;
    phone: string;
    description: string;
    plan_id: string;
    subscription_plan: string;
    subscription_status: string;
    trial_ends_at: string;
    ai_instructions: string;
    ai_emotion: string;
}

export default function ShopsPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

    // Edit modal state
    const [editingShop, setEditingShop] = useState<Shop | null>(null);
    const [editForm, setEditForm] = useState<EditFormData>({
        name: '',
        owner_name: '',
        phone: '',
        description: '',
        plan_id: '',
        subscription_plan: '',
        subscription_status: '',
        trial_ends_at: '',
        ai_instructions: '',
        ai_emotion: ''
    });
    const [saving, setSaving] = useState(false);

    // Toggle loading state
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
        fetchShops();
        fetchPlans();
    }, [pagination.page, statusFilter]);

    async function fetchPlans() {
        try {
            const res = await fetch('/api/admin/plans');
            if (res.ok) {
                const data = await res.json();
                setAvailablePlans(data.plans || []);
            }
        } catch (error) {
            console.error('Fetch plans error:', error);
        }
    }

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
            } else {
                toast.error('Дэлгүүрүүдийг татахад алдаа гарлаа');
            }
        } catch (error) {
            console.error('Fetch shops error:', error);
            toast.error('Холболтын алдаа гарлаа');
        } finally {
            setLoading(false);
        }
    }

    async function toggleShopStatus(shop: Shop) {
        // Confirmation for disabling
        if (shop.is_active) {
            const confirmed = window.confirm(`"${shop.name}" дэлгүүрийг идэвхгүй болгох уу?`);
            if (!confirmed) return;
        }

        setTogglingId(shop.id);
        try {
            const res = await fetch('/api/admin/shops', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: shop.id, is_active: !shop.is_active })
            });

            if (res.ok) {
                setShops(shops.map(s =>
                    s.id === shop.id ? { ...s, is_active: !shop.is_active } : s
                ));
                toast.success(shop.is_active ? 'Дэлгүүр идэвхгүй болголоо' : 'Дэлгүүр идэвхжүүллээ');
            } else {
                toast.error('Статус өөрчлөхөд алдаа гарлаа');
            }
        } catch (error) {
            console.error('Toggle status error:', error);
            toast.error('Холболтын алдаа гарлаа');
        } finally {
            setTogglingId(null);
        }
    }

    function openEditModal(shop: Shop) {
        setEditingShop(shop);
        setEditForm({
            name: shop.name || '',
            owner_name: shop.owner_name || '',
            phone: shop.phone || '',
            description: shop.description || '',
            plan_id: shop.plan_id || '',
            subscription_plan: shop.subscription_plan || 'starter',
            subscription_status: shop.subscription_status || 'active',
            trial_ends_at: shop.trial_ends_at ? new Date(shop.trial_ends_at).toISOString().split('T')[0] : '',
            ai_instructions: shop.ai_instructions || '',
            ai_emotion: shop.ai_emotion || ''
        });
    }

    async function handleSaveEdit() {
        if (!editingShop) return;

        if (!editForm.name.trim()) {
            toast.error('Дэлгүүрийн нэр хоосон байж болохгүй');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/shops', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingShop.id,
                    name: editForm.name.trim(),
                    owner_name: editForm.owner_name.trim() || null,
                    phone: editForm.phone.trim() || null,
                    description: editForm.description.trim() || null,
                    plan_id: editForm.plan_id,
                    subscription_plan: editForm.subscription_plan,
                    subscription_status: editForm.subscription_status,
                    trial_ends_at: editForm.trial_ends_at ? new Date(editForm.trial_ends_at).toISOString() : null,
                    ai_instructions: editForm.ai_instructions,
                    ai_emotion: editForm.ai_emotion
                })
            });

            if (res.ok) {
                const data = await res.json();
                setShops(shops.map(s =>
                    s.id === editingShop.id ? { ...s, ...data.shop } : s
                ));
                setEditingShop(null);
                toast.success('Дэлгүүрийн мэдээлэл хадгаллаа');
            } else {
                const error = await res.json();
                toast.error(error.error || 'Хадгалахад алдаа гарлаа');
            }
        } catch (error) {
            console.error('Save edit error:', error);
            toast.error('Холболтын алдаа гарлаа');
        } finally {
            setSaving(false);
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
                                                        {shop.owner_name || (shop.facebook_page_id ? 'FB Connected' : 'No owner')}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shop.plans ? (
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {shop.plans.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        ₮{shop.plans.price_monthly.toLocaleString()}/mo
                                                    </p>
                                                </div>
                                            ) : shop.subscriptions?.[0]?.plans ? (
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {shop.subscriptions[0].plans.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        ₮{shop.subscriptions[0].plans.price_monthly.toLocaleString()}/mo
                                                    </p>
                                                </div>
                                            ) : shop.subscription_plan ? (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm capitalize">
                                                    {shop.subscription_plan}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">No plan</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleShopStatus(shop)}
                                                disabled={togglingId === shop.id}
                                                className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${shop.is_active
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    } disabled:opacity-50`}
                                            >
                                                {togglingId === shop.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : shop.is_active ? (
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
                                            <button
                                                onClick={() => openEditModal(shop)}
                                                className="p-2 hover:bg-violet-100 rounded-lg text-violet-600 transition-colors"
                                                title="Edit shop"
                                            >
                                                <Edit className="w-4 h-4" />
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

            {/* Edit Shop Modal */}
            {editingShop && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0F0B2E] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Edit Shop</h2>
                            <button
                                onClick={() => setEditingShop(null)}
                                className="p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Дэлгүүрийн нэр *
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    placeholder="Shop name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Эзэмшигчийн нэр
                                </label>
                                <input
                                    type="text"
                                    value={editForm.owner_name}
                                    onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    placeholder="Owner name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Утасны дугаар
                                </label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    placeholder="Phone number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Тайлбар
                                </label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                                    placeholder="Shop description"
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">Subscription</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                                        <select
                                            value={editForm.plan_id}
                                            onChange={(e) => {
                                                const selectedPlanId = e.target.value;
                                                const selectedPlan = availablePlans.find(p => p.id === selectedPlanId);
                                                setEditForm({
                                                    ...editForm,
                                                    plan_id: selectedPlanId,
                                                    subscription_plan: selectedPlan?.slug || editForm.subscription_plan
                                                });
                                            }}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                                        >
                                            <option value="">Select Plan</option>
                                            {availablePlans.map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name} ({plan.slug})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Slug: {editForm.subscription_plan}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                        <select
                                            value={editForm.subscription_status}
                                            onChange={(e) => setEditForm({ ...editForm, subscription_status: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                                        >
                                            <option value="active">Active</option>
                                            <option value="trial">Trial</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Trial Ends At</label>
                                        <input
                                            type="date"
                                            value={editForm.trial_ends_at}
                                            onChange={(e) => setEditForm({ ...editForm, trial_ends_at: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Settings</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">System Instructions</label>
                                        <textarea
                                            value={editForm.ai_instructions}
                                            onChange={(e) => setEditForm({ ...editForm, ai_instructions: e.target.value })}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none text-sm"
                                            placeholder="Example: You are a helpful sales assistant..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Emotion / Tone</label>
                                        <input
                                            type="text"
                                            value={editForm.ai_emotion}
                                            onChange={(e) => setEditForm({ ...editForm, ai_emotion: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500"
                                            placeholder="Example: Friendly, Professional, Enthusiastic"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
                            <Button
                                variant="secondary"
                                onClick={() => setEditingShop(null)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
