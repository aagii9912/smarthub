'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Plus, Edit2, Trash2, Check, X, GripVertical,
    Loader2, Package
} from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    slug: string;
    description: string;
    price_monthly: number;
    price_yearly: number | null;
    features: Record<string, any>;
    limits: Record<string, any>;
    is_active: boolean;
    is_featured: boolean;
    sort_order: number;
}

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState<{
        name: string;
        slug: string;
        description: string;
        price_monthly: number;
        price_yearly: number;
        is_active: boolean;
        is_featured: boolean;
        features: Record<string, any>;
        limits: Record<string, any>;
    }>({
        name: '',
        slug: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        is_active: true,
        is_featured: false,
        features: {
            messages_per_month: 100,
            shops_limit: 1,
            ai_enabled: true,
            ai_model: 'gpt-4o-mini',
            sales_intelligence: false,
            ai_memory: false,
            cart_system: 'none',
            payment_integration: false,
            crm_analytics: 'basic',
            auto_tagging: false,
            appointment_booking: false,
            bulk_marketing: false,
            excel_export: false,
            custom_branding: false,
            comment_reply: false,
            priority_support: false
        },
        limits: {
            max_messages: 100,
            max_shops: 1,
            max_products: 50,
            max_customers: 100
        }
    });

    useEffect(() => {
        fetchPlans();
    }, []);

    async function fetchPlans() {
        try {
            const res = await fetch('/api/admin/plans');
            if (res.ok) {
                const data = await res.json();
                setPlans(data.plans || []);
            }
        } catch (error) {
            console.error('Fetch plans error:', error);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingPlan(null);
        setFormData({
            name: '',
            slug: '',
            description: '',
            price_monthly: 0,
            price_yearly: 0,
            is_active: true,
            is_featured: false,
            features: {
                messages_per_month: 100,
                shops_limit: 1,
                ai_enabled: true,
                ai_model: 'gpt-4o-mini',
                sales_intelligence: false,
                ai_memory: false,
                cart_system: 'none',
                payment_integration: false,
                crm_analytics: 'basic',
                auto_tagging: false,
                appointment_booking: false,
                bulk_marketing: false,
                excel_export: false,
                custom_branding: false,
                comment_reply: false,
                priority_support: false
            },
            limits: {
                max_messages: 100,
                max_shops: 1,
                max_products: 50,
                max_customers: 100
            }
        });
        setShowModal(true);
    }

    function openEditModal(plan: Plan) {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            slug: plan.slug,
            description: plan.description || '',
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly || 0,
            is_active: plan.is_active,
            is_featured: plan.is_featured,
            features: plan.features || {},
            limits: plan.limits || {}
        });
        setShowModal(true);
    }

    async function savePlan() {
        setSaving(true);
        try {
            const url = '/api/admin/plans';
            const method = editingPlan ? 'PATCH' : 'POST';
            const body = editingPlan
                ? { id: editingPlan.id, ...formData }
                : formData;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowModal(false);
                fetchPlans();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to save plan');
            }
        } catch (error) {
            console.error('Save plan error:', error);
            alert('Failed to save plan');
        } finally {
            setSaving(false);
        }
    }

    async function deletePlan(id: string) {
        if (!confirm('Are you sure you want to delete this plan?')) return;

        try {
            const res = await fetch(`/api/admin/plans?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchPlans();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to delete plan');
            }
        } catch (error) {
            console.error('Delete plan error:', error);
        }
    }

    const formatMoney = (amount: number) => `₮${amount.toLocaleString()}`;

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
                    <h1 className="text-2xl font-bold text-gray-900">Pricing Plans</h1>
                    <p className="text-gray-500 mt-1">Manage subscription plans and pricing</p>
                </div>
                <Button onClick={openCreateModal}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Plan
                </Button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <Card key={plan.id} className={`relative ${plan.is_featured ? 'ring-2 ring-violet-500' : ''}`}>
                        {plan.is_featured && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded-full">
                                Popular
                            </div>
                        )}
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Package className="w-5 h-5 text-violet-600" />
                                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => openEditModal(plan)}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                                    >
                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <button
                                        onClick={() => deletePlan(plan.id)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-4">
                                <span className="text-3xl font-bold text-gray-900">
                                    {plan.price_monthly === 0 ? 'Free' : formatMoney(plan.price_monthly)}
                                </span>
                                {plan.price_monthly > 0 && (
                                    <span className="text-gray-500">/сар</span>
                                )}
                            </div>

                            <p className="text-sm text-gray-500 mb-4">{plan.description}</p>

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{plan.features?.messages_per_month === -1 ? 'Unlimited' : plan.features?.messages_per_month} messages</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{plan.features?.shops_limit === -1 ? 'Unlimited' : plan.features?.shops_limit} shop(s)</span>
                                </div>
                                {plan.features?.comment_reply && (
                                    <div className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span>Comment reply</span>
                                    </div>
                                )}
                                {plan.features?.priority_support && (
                                    <div className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span>Priority support</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                                <span className={`px-2 py-0.5 rounded-full ${plan.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {plan.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-gray-400">#{plan.sort_order}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                        placeholder="Professional"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                        placeholder="professional"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    rows={2}
                                    placeholder="Best for growing businesses"
                                />
                            </div>

                            {/* Pricing */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Price (MNT)</label>
                                    <input
                                        type="number"
                                        value={formData.price_monthly}
                                        onChange={(e) => setFormData({ ...formData, price_monthly: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Price (MNT)</label>
                                    <input
                                        type="number"
                                        value={formData.price_yearly}
                                        onChange={(e) => setFormData({ ...formData, price_yearly: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Limits */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Limits (-1 = unlimited)</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500">Messages/month</label>
                                        <input
                                            type="number"
                                            value={formData.features.messages_per_month}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, messages_per_month: parseInt(e.target.value) },
                                                limits: { ...formData.limits, max_messages: parseInt(e.target.value) }
                                            })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Shops</label>
                                        <input
                                            type="number"
                                            value={formData.features.shops_limit}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, shops_limit: parseInt(e.target.value) },
                                                limits: { ...formData.limits, max_shops: parseInt(e.target.value) }
                                            })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">AI Features</label>
                                <div className="space-y-2 mb-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.ai_enabled}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, ai_enabled: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">AI Enabled</span>
                                    </label>
                                    <div className="flex items-center gap-2 ml-6">
                                        <span className="text-sm text-gray-500">AI Model:</span>
                                        <select
                                            value={formData.features.ai_model || 'gpt-4o-mini'}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, ai_model: e.target.value }
                                            })}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            <option value="gpt-4o-mini">GPT-4o-mini (Basic)</option>
                                            <option value="gpt-4o">GPT-4o (Advanced)</option>
                                        </select>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.sales_intelligence}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, sales_intelligence: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Sales Intelligence</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.ai_memory}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, ai_memory: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">AI Memory</span>
                                    </label>
                                </div>

                                <label className="block text-sm font-medium text-gray-700 mb-2">Business Features</label>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">Cart System:</span>
                                        <select
                                            value={formData.features.cart_system || 'none'}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, cart_system: e.target.value }
                                            })}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            <option value="none">None</option>
                                            <option value="basic">Basic</option>
                                            <option value="full">Full</option>
                                        </select>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.payment_integration}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, payment_integration: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Payment Integration (QPay/Bank)</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.auto_tagging}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, auto_tagging: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Auto Tagging</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.appointment_booking}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, appointment_booking: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Appointment Booking</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.bulk_marketing}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, bulk_marketing: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Bulk Marketing</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.excel_export}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, excel_export: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Excel Export</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.comment_reply}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, comment_reply: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Comment Auto-Reply</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.custom_branding}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, custom_branding: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Custom Branding</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.features.priority_support}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                features: { ...formData.features, priority_support: e.target.checked }
                                            })}
                                            className="rounded"
                                        />
                                        <span className="text-sm">Priority Support</span>
                                    </label>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Active</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_featured}
                                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Featured</span>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={savePlan} disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {editingPlan ? 'Save Changes' : 'Create Plan'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
