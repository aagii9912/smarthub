'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
    Settings, Users, Save, Plus, Trash2,
    Shield, Bell, CreditCard, Bot
} from 'lucide-react';

interface Admin {
    id: string;
    email: string;
    role: 'super_admin' | 'admin' | 'support';
    is_active: boolean;
    created_at: string;
}

interface SettingsData {
    general: {
        site_name: string;
        support_email: string;
        default_currency: string;
    };
    notifications: {
        email_enabled: boolean;
        push_enabled: boolean;
        sms_enabled: boolean;
    };
    billing: {
        trial_days: number;
        grace_period_days: number;
        auto_suspend: boolean;
    };
    ai: {
        default_model: string;
        max_tokens: number;
        temperature: number;
    };
}

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'admins'>('general');
    const [currentAdmin, setCurrentAdmin] = useState<{ email: string; role: string } | null>(null);

    // New admin form
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'support'>('admin');
    const [addingAdmin, setAddingAdmin] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchAdmins();
    }, []);

    async function fetchSettings() {
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(data.settings);
                setCurrentAdmin(data.admin);
            }
        } catch (error) {
            console.error('Settings fetch error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchAdmins() {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setAdmins(data.admins || []);
            }
        } catch (error) {
            console.error('Admins fetch error:', error);
        }
    }

    async function saveSettings() {
        if (!settings) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                alert('Тохиргоо амжилттай хадгалагдлаа!');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function addAdmin() {
        if (!newAdminEmail) return;
        setAddingAdmin(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newAdminEmail, role: newAdminRole })
            });
            if (res.ok) {
                setNewAdminEmail('');
                fetchAdmins();
            } else {
                const error = await res.json();
                alert(error.error || 'Алдаа гарлаа');
            }
        } catch (error) {
            console.error('Add admin error:', error);
        } finally {
            setAddingAdmin(false);
        }
    }

    async function updateAdminRole(adminId: string, role: string) {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: adminId, role })
            });
            if (res.ok) {
                fetchAdmins();
            }
        } catch (error) {
            console.error('Update error:', error);
        }
    }

    async function deleteAdmin(adminId: string) {
        if (!confirm('Энэ admin-г устгах уу?')) return;
        try {
            const res = await fetch(`/api/admin/users?admin_id=${adminId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchAdmins();
            } else {
                const error = await res.json();
                alert(error.error || 'Алдаа гарлаа');
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    }

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            super_admin: 'bg-violet-100 text-violet-700',
            admin: 'bg-blue-100 text-blue-700',
            support: 'bg-green-100 text-green-700'
        };
        return styles[role] || 'bg-gray-100 text-gray-700';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    const isSuperAdmin = currentAdmin?.role === 'super_admin';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500 mt-1">Системийн тохиргоо</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general'
                            ? 'border-violet-600 text-violet-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Settings className="w-4 h-4 inline mr-2" />
                    Ерөнхий
                </button>
                <button
                    onClick={() => setActiveTab('admins')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'admins'
                            ? 'border-violet-600 text-violet-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Users className="w-4 h-4 inline mr-2" />
                    Админууд
                </button>
            </div>

            {/* General Settings Tab */}
            {activeTab === 'general' && settings && (
                <div className="grid gap-6">
                    {/* General Section */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-violet-600" />
                                Ерөнхий тохиргоо
                            </h3>
                            <div className="grid gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Сайтын нэр</label>
                                    <input
                                        type="text"
                                        value={settings.general.site_name}
                                        onChange={(e) => setSettings({ ...settings, general: { ...settings.general, site_name: e.target.value } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Тусламжийн имэйл</label>
                                    <input
                                        type="email"
                                        value={settings.general.support_email}
                                        onChange={(e) => setSettings({ ...settings, general: { ...settings.general, support_email: e.target.value } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications Section */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-violet-600" />
                                Мэдэгдэл
                            </h3>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={settings.notifications.email_enabled}
                                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, email_enabled: e.target.checked } })}
                                        className="w-4 h-4 text-violet-600 rounded"
                                    />
                                    <span className="text-gray-700">Имэйл мэдэгдэл идэвхжүүлэх</span>
                                </label>
                                <label className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={settings.notifications.push_enabled}
                                        onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, push_enabled: e.target.checked } })}
                                        className="w-4 h-4 text-violet-600 rounded"
                                    />
                                    <span className="text-gray-700">Push notification идэвхжүүлэх</span>
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Billing Section */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-violet-600" />
                                Төлбөр
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Trial хоног</label>
                                    <input
                                        type="number"
                                        value={settings.billing.trial_days}
                                        onChange={(e) => setSettings({ ...settings, billing: { ...settings.billing, trial_days: parseInt(e.target.value) } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Grace period (хоног)</label>
                                    <input
                                        type="number"
                                        value={settings.billing.grace_period_days}
                                        onChange={(e) => setSettings({ ...settings, billing: { ...settings.billing, grace_period_days: parseInt(e.target.value) } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Section */}
                    <Card>
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Bot className="w-5 h-5 text-violet-600" />
                                AI тохиргоо
                            </h3>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                    <select
                                        value={settings.ai.default_model}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, default_model: e.target.value } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    >
                                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                                    <input
                                        type="number"
                                        value={settings.ai.max_tokens}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, max_tokens: parseInt(e.target.value) } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        value={settings.ai.temperature}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, temperature: parseFloat(e.target.value) } })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    {isSuperAdmin && (
                        <div className="flex justify-end">
                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Admins Tab */}
            {activeTab === 'admins' && (
                <div className="space-y-6">
                    {/* Add Admin Form - Super Admin Only */}
                    {isSuperAdmin && (
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Шинэ Admin нэмэх</h3>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <input
                                        type="email"
                                        placeholder="Имэйл хаяг"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                    <select
                                        value={newAdminRole}
                                        onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'support')}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="support">Support</option>
                                    </select>
                                    <button
                                        onClick={addAdmin}
                                        disabled={addingAdmin || !newAdminEmail}
                                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Нэмэх
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Admins List */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Имэйл</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Эрх</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                                            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Нэмэгдсэн</th>
                                            {isSuperAdmin && (
                                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Үйлдэл</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {admins.map((admin) => (
                                            <tr key={admin.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{admin.email}</td>
                                                <td className="px-6 py-4">
                                                    {isSuperAdmin && admin.role !== 'super_admin' ? (
                                                        <select
                                                            value={admin.role}
                                                            onChange={(e) => updateAdminRole(admin.id, e.target.value)}
                                                            className="text-sm border border-gray-200 rounded px-2 py-1"
                                                        >
                                                            <option value="admin">Admin</option>
                                                            <option value="support">Support</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(admin.role)}`}>
                                                            {admin.role.replace('_', ' ')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${admin.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {admin.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(admin.created_at).toLocaleDateString('mn-MN')}
                                                </td>
                                                {isSuperAdmin && (
                                                    <td className="px-6 py-4">
                                                        {admin.role !== 'super_admin' && (
                                                            <button
                                                                onClick={() => deleteAdmin(admin.id)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
