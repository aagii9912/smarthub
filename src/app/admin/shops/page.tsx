'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { logger } from '@/lib/utils/logger';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getOnboarding } from '@/lib/admin/onboarding';
import { toast } from 'sonner';
import {
    Search, Users, ToggleLeft, ToggleRight,
    Loader2, Edit, X, Save, Clock, Crown,
    Phone, Mail, Zap
} from 'lucide-react';

interface PlanSyncResult {
    attempted: boolean;
    plan_slug: string | null;
    owner_user_id: string | null;
    owner_user_id_valid_uuid: boolean;
    subscription_upsert_by_user_id: 'ok' | 'failed' | 'skipped';
    subscription_upsert_by_user_id_error: string | null;
    subscription_legacy_by_shop_id: 'updated' | 'inserted' | 'failed' | 'skipped';
    subscription_legacy_error: string | null;
    user_profiles_snapshot: 'ok' | 'failed' | 'skipped';
    user_profiles_error: string | null;
    all_user_shops_mirror: 'ok' | 'failed' | 'skipped';
    all_user_shops_error: string | null;
}

function describePlanSync(s: PlanSyncResult | undefined | null): string {
    if (!s || !s.attempted) return '';
    const parts: string[] = [];
    if (s.subscription_upsert_by_user_id === 'ok') parts.push('subscriptions(user_id)✓');
    else if (s.subscription_upsert_by_user_id === 'failed') parts.push(`subscriptions(user_id)✗ ${s.subscription_upsert_by_user_id_error ?? ''}`);
    if (s.subscription_legacy_by_shop_id !== 'skipped') {
        parts.push(`subscriptions(shop_id)=${s.subscription_legacy_by_shop_id}${s.subscription_legacy_error ? ` (${s.subscription_legacy_error})` : ''}`);
    }
    if (s.user_profiles_snapshot === 'ok') parts.push('user_profiles✓');
    else if (s.user_profiles_snapshot === 'failed') parts.push(`user_profiles✗ ${s.user_profiles_error ?? ''}`);
    if (s.all_user_shops_mirror === 'ok') parts.push('all_shops✓');
    else if (s.all_user_shops_mirror === 'failed') parts.push(`all_shops✗ ${s.all_user_shops_error ?? ''}`);
    if (!s.owner_user_id_valid_uuid) parts.unshift(`⚠️ shop.user_id буруу/хоосон=${s.owner_user_id ?? 'null'}`);
    return parts.join(' · ');
}

interface Shop {
    id: string;
    name: string;
    owner_name: string | null;
    owner_email: string | null;
    phone: string | null;
    description: string | null;
    facebook_page_id: string | null;
    is_active: boolean;
    setup_completed: boolean | null;
    ai_setup_completed_at: string | null;
    token_usage_total: number | null;
    product_count: number;
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
    const searchParams = useSearchParams();
    const initialStatus = searchParams?.get('status') ?? '';

    const [shops, setShops] = useState<Shop[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
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

    // Dedicated "Change Plan" quick-action (focused single-purpose dialog)
    const [planChangingShop, setPlanChangingShop] = useState<Shop | null>(null);
    const [pickedPlanId, setPickedPlanId] = useState<string>('');
    const [changingPlan, setChangingPlan] = useState(false);

    useEffect(() => {
        fetchShops();
        fetchPlans();
    }, [pagination.page, statusFilter]);

    async function fetchPlans() {
        try {
            const res = await fetch('/api/admin/plans');
            if (res.ok) {
                const data = await res.json();
                const plans = data.plans || [];
                setAvailablePlans(plans);
                if (plans.length === 0) {
                    toast.error('Идэвхтэй төлөвлөгөө олдсонгүй. plans хүснэгтийг шалгана уу.');
                    logger.error('Fetch plans returned empty array');
                }
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(`Төлөвлөгөөнүүдийг татахад алдаа гарлаа (HTTP ${res.status})`);
                logger.error('Fetch plans HTTP error:', { status: res.status, body: err });
            }
        } catch (error: unknown) {
            logger.error('Fetch plans error:', { error });
            toast.error('Төлөвлөгөөнүүдийг татах сүлжээний алдаа гарлаа');
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
        } catch (error: unknown) {
            logger.error('Fetch shops error:', { error });
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
        } catch (error: unknown) {
            logger.error('Toggle status error:', { error });
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
                const sync = data.plan_sync as PlanSyncResult | undefined;
                const desc = describePlanSync(sync);
                if (sync?.attempted) {
                    const okAll = sync.subscription_upsert_by_user_id === 'ok' &&
                                  sync.user_profiles_snapshot === 'ok' &&
                                  sync.all_user_shops_mirror === 'ok';
                    if (okAll) {
                        toast.success(`План шилжүүлэв → ${sync.plan_slug}. Хэрэглэгч /dashboard/subscription дээр шинэчилсэн харагдана.`);
                    } else {
                        toast.warning(`Хэсэгчлэн хадгаллаа. ${desc}`, { duration: 8000 });
                    }
                } else {
                    toast.success('Дэлгүүрийн мэдээлэл хадгаллаа');
                }
            } else {
                const error = await res.json().catch(() => ({}));
                toast.error(error.error || 'Хадгалахад алдаа гарлаа');
                const desc = describePlanSync(error.plan_sync);
                if (desc) toast.error(`Sync details: ${desc}`, { duration: 10000 });
            }
        } catch (error: unknown) {
            logger.error('Save edit error:', { error });
            toast.error('Холболтын алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    function openPlanChangeDialog(shop: Shop) {
        setPlanChangingShop(shop);
        setPickedPlanId(shop.plan_id || '');
    }

    async function handleQuickChangePlan() {
        if (!planChangingShop) return;
        if (!pickedPlanId) {
            toast.error('Шинэ плэн сонгоно уу');
            return;
        }
        if (pickedPlanId === planChangingShop.plan_id) {
            toast.error('Сонгосон плэн одоогийнхтой ижил байна');
            return;
        }

        setChangingPlan(true);
        try {
            const res = await fetch('/api/admin/shops', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: planChangingShop.id,
                    plan_id: pickedPlanId,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                toast.error(data.error || `HTTP ${res.status}`);
                const desc = describePlanSync(data.plan_sync);
                if (desc) toast.error(`Sync details: ${desc}`, { duration: 10000 });
                return;
            }

            const sync = data.plan_sync as PlanSyncResult | undefined;
            const newPlan = availablePlans.find(p => p.id === pickedPlanId);
            // Update local row
            setShops(shops.map(s =>
                s.id === planChangingShop.id
                    ? {
                        ...s,
                        ...data.shop,
                        plans: newPlan
                            ? { id: newPlan.id, name: newPlan.name, slug: newPlan.slug, price_monthly: newPlan.price_monthly }
                            : s.plans,
                    }
                    : s
            ));
            setPlanChangingShop(null);

            const desc = describePlanSync(sync);
            const okAll = sync?.subscription_upsert_by_user_id === 'ok' &&
                          sync?.user_profiles_snapshot === 'ok' &&
                          sync?.all_user_shops_mirror === 'ok';
            if (okAll) {
                toast.success(`План → ${sync?.plan_slug}. Бүх хүснэгт шинэчлэгдлээ.`);
            } else {
                toast.warning(`План хэсэгчлэн шилжсэн. ${desc}`, { duration: 12000 });
            }
        } catch (error: unknown) {
            logger.error('Quick change plan error:', { error });
            toast.error('Холболтын алдаа гарлаа');
        } finally {
            setChangingPlan(false);
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shops Directory</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and monitor all registered shops on the platform.</p>
                </div>
                <div className="text-sm font-medium text-gray-600 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-gray-400 mr-2">Total Shops:</span>
                    {pagination.total}
                </div>
            </div>

            {/* Filters */}
            <Card className="border-gray-100 shadow-sm rounded-2xl bg-white">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <form onSubmit={handleSearch} className="flex-1 w-full md:w-auto">
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name, owner, or phone..."
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                                />
                            </div>
                        </form>

                        <div className="w-full md:w-48 relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="w-full appearance-none px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white transition-all outline-none"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active Only</option>
                                <option value="inactive">Inactive Only</option>
                                <option value="trial">Trial</option>
                                <option value="expired_trial">Expired Trial</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Shops Table */}
            <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop Details</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subscription Plan</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Onboarding / Tokens</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {shops.map((shop) => (
                                    <tr key={shop.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center font-medium text-gray-600 shadow-sm">
                                                    {shop.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-900 text-sm">{shop.name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {shop.owner_name || (shop.facebook_page_id ? 'FB Connected' : 'No owner')}
                                                    </p>
                                                    {shop.phone && (
                                                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                            <Phone className="w-3 h-3 text-gray-400" /> {shop.phone}
                                                        </p>
                                                    )}
                                                    {shop.owner_email && (
                                                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate" title={shop.owner_email}>
                                                            <Mail className="w-3 h-3 text-gray-400 shrink-0" /> <span className="truncate">{shop.owner_email}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shop.plans ? (
                                                <div>
                                                    <p className="font-medium text-gray-900 text-sm">
                                                        {shop.plans.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        ₮{shop.plans.price_monthly.toLocaleString()}/mo
                                                    </p>
                                                </div>
                                            ) : shop.subscriptions?.[0]?.plans ? (
                                                <div>
                                                    <p className="font-medium text-gray-900 text-sm">
                                                        {shop.subscriptions[0].plans.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        ₮{shop.subscriptions[0].plans.price_monthly.toLocaleString()}/mo
                                                    </p>
                                                </div>
                                            ) : shop.subscription_plan ? (
                                                <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium capitalize border border-gray-200">
                                                    {shop.subscription_plan}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">No Active Plan</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleShopStatus(shop)}
                                                disabled={togglingId === shop.id}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${shop.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                                    } disabled:opacity-50`}
                                            >
                                                {togglingId === shop.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : shop.is_active ? (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                                                ) : (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1" />
                                                )}
                                                {shop.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const ob = getOnboarding(shop);
                                                return (
                                                    <div className="space-y-1.5 min-w-[150px]">
                                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                                            <span className="font-medium text-gray-700 truncate">{ob.label}</span>
                                                            <span className="text-gray-400 tabular-nums shrink-0">{ob.completed}/{ob.total}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${ob.percent >= 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                                                                style={{ width: `${ob.percent}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                                            <Zap className="w-3 h-3 text-amber-500" /> {Number(shop.token_usage_total || 0).toLocaleString()} token
                                                        </p>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                {formatDate(shop.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    onClick={() => openPlanChangeDialog(shop)}
                                                    disabled={availablePlans.length === 0}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Change plan (per-user, propagates to /dashboard/subscription)"
                                                >
                                                    <Crown className="w-3.5 h-3.5" />
                                                    Change Plan
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(shop)}
                                                    className="inline-flex p-2 bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 rounded-lg text-gray-500 hover:text-violet-600 transition-colors shadow-sm"
                                                    title="Edit shop details"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-gray-500 font-medium">
                                Showing Page <span className="text-gray-900">{pagination.page}</span> of <span className="text-gray-900">{pagination.pages}</span>
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setEditingShop(null)} />

                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Edit Shop Details</h2>
                                <p className="text-xs text-gray-500 mt-1">ID: {editingShop.id}</p>
                            </div>
                            <button
                                onClick={() => setEditingShop(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Basic Info</h3>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Дэлгүүрийн нэр *
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                        placeholder="Enter shop name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Эзэмшигчийн нэр
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.owner_name}
                                            onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                            placeholder="Owner's full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Утасны дугаар
                                        </label>
                                        <input
                                            type="tel"
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                            placeholder="+976 00000000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Тайлбар
                                    </label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        rows={2}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white resize-none"
                                        placeholder="Brief description of the shop..."
                                    />
                                </div>
                            </div>

                            {/* Subscription Info */}
                            <div className="space-y-4 pt-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Subscription Info</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Plan</label>
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
                                            disabled={availablePlans.length === 0}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <option value="">
                                                {availablePlans.length === 0 ? 'Plans loading / not available...' : 'Select Plan...'}
                                            </option>
                                            {availablePlans.map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name} ({plan.slug})
                                                </option>
                                            ))}
                                        </select>
                                        {availablePlans.length === 0 && (
                                            <p className="mt-1.5 text-xs text-red-600">
                                                ⚠️ Plans дуудагдаагүй байна. Browser console болон /api/admin/plans-ийг шалгана уу.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                                        <select
                                            value={editForm.subscription_status}
                                            onChange={(e) => setEditForm({ ...editForm, subscription_status: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                        >
                                            <option value="active">Active</option>
                                            <option value="trial">Trial</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trial Ends At</label>
                                        <input
                                            type="date"
                                            value={editForm.trial_ends_at}
                                            onChange={(e) => setEditForm({ ...editForm, trial_ends_at: e.target.value })}
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* AI Settings */}
                            <div className="space-y-4 pt-4">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">AI Preferences</h3>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">System Instructions</label>
                                    <textarea
                                        value={editForm.ai_instructions}
                                        onChange={(e) => setEditForm({ ...editForm, ai_instructions: e.target.value })}
                                        rows={3}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white resize-none"
                                        placeholder="Example: You are a helpful sales assistant..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Emotion & Tone</label>
                                    <input
                                        type="text"
                                        value={editForm.ai_emotion}
                                        onChange={(e) => setEditForm({ ...editForm, ai_emotion: e.target.value })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                        placeholder="e.g. Friendly, Professional, Enthusiastic"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                            <Button
                                variant="outline"
                                onClick={() => setEditingShop(null)}
                                disabled={saving}
                                className="bg-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="bg-violet-600 hover:bg-violet-700 text-white border-0 shadow-sm"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Change Plan Dialog (focused, single-purpose) */}
            {planChangingShop && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                        onClick={() => !changingPlan && setPlanChangingShop(null)}
                    />

                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between p-5 border-b border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-violet-50 text-violet-600 rounded-xl ring-1 ring-violet-100">
                                    <Crown className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Change Plan</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">{planChangingShop.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => !changingPlan && setPlanChangingShop(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                disabled={changingPlan}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
                                <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">Current</p>
                                <p className="text-gray-900 font-medium">
                                    {planChangingShop.plans?.name
                                        ?? planChangingShop.subscription_plan
                                        ?? 'No plan'}
                                </p>
                                {planChangingShop.subscription_status && (
                                    <p className="text-xs text-gray-500 mt-1">Status: {planChangingShop.subscription_status}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">New plan</label>
                                <select
                                    value={pickedPlanId}
                                    onChange={(e) => setPickedPlanId(e.target.value)}
                                    disabled={availablePlans.length === 0 || changingPlan}
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-white disabled:opacity-60"
                                >
                                    <option value="">Select plan...</option>
                                    {availablePlans.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.slug}) — ₮{p.price_monthly.toLocaleString()}/mo
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-2 text-xs text-gray-500">
                                    Save дарахад: <code className="bg-gray-100 px-1 rounded">subscriptions(user_id)</code>,
                                    <code className="bg-gray-100 px-1 rounded">user_profiles</code>,
                                    бүх <code className="bg-gray-100 px-1 rounded">shops</code> зэрэг шинэчлэгдэнэ.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                            <Button
                                variant="outline"
                                onClick={() => setPlanChangingShop(null)}
                                disabled={changingPlan}
                                className="bg-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleQuickChangePlan}
                                disabled={changingPlan || !pickedPlanId || pickedPlanId === planChangingShop.plan_id}
                                className="bg-violet-600 hover:bg-violet-700 text-white border-0 shadow-sm"
                            >
                                {changingPlan ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Switching...
                                    </>
                                ) : (
                                    <>
                                        <Crown className="w-4 h-4 mr-2" />
                                        Apply Plan
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
