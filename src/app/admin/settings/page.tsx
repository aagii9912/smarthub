'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';
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
        default_provider: 'openai' | 'gemini';
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
        } catch (error: unknown) {
            logger.error('Settings fetch error:', { error });
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
        } catch (error: unknown) {
            logger.error('Admins fetch error:', { error });
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
        } catch (error: unknown) {
            logger.error('Save error:', { error });
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
        } catch (error: unknown) {
            logger.error('Add admin error:', { error });
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
        } catch (error: unknown) {
            logger.error('Update error:', { error });
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
        } catch (error: unknown) {
            logger.error('Delete error:', { error });
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Системийн ерөнхий тохиргоо болон админууд</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-100">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`pb-4 px-1 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'general'
                        ? 'border-violet-600 text-violet-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                >
                    <Settings className="w-4.5 h-4.5" />
                    Ерөнхий тохиргоо
                </button>
                <button
                    onClick={() => setActiveTab('admins')}
                    className={`pb-4 px-1 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'admins'
                        ? 'border-violet-600 text-violet-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                >
                    <Users className="w-4.5 h-4.5" />
                    Админууд
                </button>
            </div>

            {/* General Settings Tab */}
            {activeTab === 'general' && settings && (
                <div className="grid gap-6">
                    {/* General Section */}
                    <Card className="border-gray-100 shadow-sm rounded-2xl bg-white transition-all hover:shadow-md">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                    <Shield className="w-4.5 h-4.5 text-violet-600" />
                                </span>
                                Үндсэн тохиргоо
                            </h3>
                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Сайтын нэр</label>
                                    <input
                                        type="text"
                                        value={settings.general.site_name}
                                        onChange={(e) => setSettings({ ...settings, general: { ...settings.general, site_name: e.target.value } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Тусламжийн имэйл</label>
                                    <input
                                        type="email"
                                        value={settings.general.support_email}
                                        onChange={(e) => setSettings({ ...settings, general: { ...settings.general, support_email: e.target.value } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications Section */}
                    <Card className="border-gray-100 shadow-sm rounded-2xl bg-white transition-all hover:shadow-md">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <Bell className="w-4.5 h-4.5 text-blue-600" />
                                </span>
                                Мэдэгдэл
                            </h3>
                            <div className="grid gap-4 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.email_enabled}
                                            onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, email_enabled: e.target.checked } })}
                                            className="peer sr-only"
                                        />
                                        <div className="w-10 h-5.5 bg-gray-200 rounded-full peer-checked:bg-violet-600 transition-colors"></div>
                                        <div className="absolute left-1 top-1 w-3.5 h-3.5 bg-white rounded-full transition-transform peer-checked:translate-x-4.5 shadow-sm"></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-800">Имэйл мэдэгдэл идэвхжүүлэх</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={settings.notifications.push_enabled}
                                            onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, push_enabled: e.target.checked } })}
                                            className="peer sr-only"
                                        />
                                        <div className="w-10 h-5.5 bg-gray-200 rounded-full peer-checked:bg-violet-600 transition-colors"></div>
                                        <div className="absolute left-1 top-1 w-3.5 h-3.5 bg-white rounded-full transition-transform peer-checked:translate-x-4.5 shadow-sm"></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-800">Push notification идэвхжүүлэх</span>
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Billing Section */}
                    <Card className="border-gray-100 shadow-sm rounded-2xl bg-white transition-all hover:shadow-md">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                                    <CreditCard className="w-4.5 h-4.5 text-green-600" />
                                </span>
                                Төлбөр
                            </h3>
                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Trial хоног</label>
                                    <input
                                        type="number"
                                        value={settings.billing.trial_days}
                                        onChange={(e) => setSettings({ ...settings, billing: { ...settings.billing, trial_days: parseInt(e.target.value) } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Grace period (хоног)</label>
                                    <input
                                        type="number"
                                        value={settings.billing.grace_period_days}
                                        onChange={(e) => setSettings({ ...settings, billing: { ...settings.billing, grace_period_days: parseInt(e.target.value) } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Section */}
                    <Card className="border-gray-100 shadow-sm rounded-2xl bg-white transition-all hover:shadow-md">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2.5">
                                <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                                    <Bot className="w-4.5 h-4.5 text-orange-600" />
                                </span>
                                AI тохиргоо
                            </h3>
                            <div className="grid gap-5 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">AI Provider</label>
                                    <select
                                        value={settings.ai.default_provider}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, default_provider: e.target.value as 'openai' | 'gemini' } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white cursor-pointer"
                                    >
                                        <option value="gemini">🚀 Gemini (Хямд, Хурдан)</option>
                                        <option value="openai">🤖 OpenAI GPT (Premium)</option>
                                    </select>
                                    <div className="mt-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
                                            {settings.ai.default_provider === 'gemini'
                                                ? '💰 ~97% хямд • 1M context • Үнэгүй tier боломжтой'
                                                : '⭐ Premium чанар • GPT-4o backend ашиглана'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Model</label>
                                    <select
                                        value={settings.ai.default_model}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, default_model: e.target.value } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white cursor-pointer"
                                    >
                                        {settings.ai.default_provider === 'gemini' ? (
                                            <>
                                                <option value="gemini-3.1-flash-lite-preview">⚡ Gemini 3.1 Flash Lite (Шинэ, Хурдан)</option>
                                                <option value="gemini-2.5-flash">🔥 Gemini 2.5 Flash (Тогтвортой)</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                                <option value="gpt-4o">GPT-4o</option>
                                            </>
                                        )}
                                    </select>
                                    {settings.ai.default_provider === 'gemini' && (
                                        <div className="mt-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                            <p className="text-[11px] font-medium text-gray-600">
                                                {settings.ai.default_model === 'gemini-3.1-flash-lite-preview'
                                                    ? '⚡ Хамгийн шинэ, хэмнэлттэй үнэтэй загвар'
                                                    : '🔥 Тогтвортой, батлагдсан загвар'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Max Tokens</label>
                                    <input
                                        type="number"
                                        value={settings.ai.max_tokens}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, max_tokens: parseInt(e.target.value) } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Temperature (0-2)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        value={settings.ai.temperature}
                                        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, temperature: parseFloat(e.target.value) } })}
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-gray-50 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    {isSuperAdmin && (
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={saveSettings}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Хадгалж байна...' : 'Тохиргоо хадгалах'}
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
                        <Card className="border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden">
                            <div className="bg-gray-50/50 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Шинэ Admin нэмэх</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Системд шинэ хандах эрх нэмэх</p>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-3">
                                    <input
                                        type="email"
                                        placeholder="Имэйл хаяг"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        className="w-full md:w-64 px-3.5 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all"
                                    />
                                    <select
                                        value={newAdminRole}
                                        onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'support')}
                                        className="w-full md:w-40 px-3.5 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all cursor-pointer bg-white"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="support">Support</option>
                                    </select>
                                    <button
                                        onClick={addAdmin}
                                        disabled={addingAdmin || !newAdminEmail}
                                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Нэмэх
                                    </button>
                                </div>
                            </div>

                            {/* Admins List */}
                            <CardContent className="p-0">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[600px]">
                                        <thead className="bg-white border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Имэйл</th>
                                                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Эрх</th>
                                                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Статус</th>
                                                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Нэмэгдсэн</th>
                                                {isSuperAdmin && (
                                                    <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Үйлдэл</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {admins.map((admin) => (
                                                <tr key={admin.id} className="hover:bg-gray-50/80 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-gray-900">{admin.email}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isSuperAdmin && admin.role !== 'super_admin' ? (
                                                            <select
                                                                value={admin.role}
                                                                onChange={(e) => updateAdminRole(admin.id, e.target.value)}
                                                                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none bg-white cursor-pointer hover:border-gray-300"
                                                            >
                                                                <option value="admin">Admin</option>
                                                                <option value="support">Support</option>
                                                            </select>
                                                        ) : (
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${admin.role === 'super_admin' ? 'bg-violet-100 text-violet-700 border border-violet-200/50' :
                                                                getRoleBadge(admin.role).replace('bg-', 'bg-').replace('text-', 'text-')
                                                                }`}>
                                                                {admin.role.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-transparent ${admin.is_active ? 'bg-green-50 text-green-700 border-green-200/50' : 'bg-red-50 text-red-700 border-red-200/50'
                                                            }`}>
                                                            {admin.is_active ? (
                                                                <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Идэвхтэй</>
                                                            ) : (
                                                                <><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Идэвхгүй</>
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm text-gray-500">
                                                            {new Date(admin.created_at).toLocaleDateString('mn-MN')}
                                                        </span>
                                                    </td>
                                                    {isSuperAdmin && (
                                                        <td className="px-6 py-4 text-right">
                                                            {admin.role !== 'super_admin' ? (
                                                                <button
                                                                    onClick={() => deleteAdmin(admin.id)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Устгах"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">No actions</span>
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
                    )}
                </div>
            )}
        </div>
    );
}
