'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import {
    Store, User, Facebook, Bot, Bell, Shield,
    Save, LogOut, Loader2, Check, AlertCircle,
    Key, Palette, Globe, CreditCard
} from 'lucide-react';

export default function SettingsPage() {
    const { user, shop, refreshShop } = useAuth();
    const router = useRouter();
    const { signOut } = useClerk();

    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Shop Settings
    const [shopName, setShopName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [phone, setPhone] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');

    // AI Settings
    const [aiEnabled, setAiEnabled] = useState(true);
    const [autoReply, setAutoReply] = useState(true);
    const [welcomeMessage, setWelcomeMessage] = useState('Сайн байна уу! Танд юугаар туслах вэ?');

    useEffect(() => {
        if (shop) {
            setShopName(shop.name || '');
            setOwnerName(shop.owner_name || '');
            setPhone(shop.phone || '');
            // @ts-ignore
            setBankName(shop.bank_name || '');
            // @ts-ignore
            setAccountNumber(shop.account_number || '');
            // @ts-ignore
            setAccountName(shop.account_name || '');
        }
    }, [shop]);

    async function handleSaveShop() {
        setLoading(true);
        setSaveStatus('saving');

        try {
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: shopName,
                    owner_name: ownerName,
                    phone: phone,
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_name: accountName
                })
            });

            if (!res.ok) throw new Error('Failed to save');

            await refreshShop();
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            setSaveStatus('error');
        } finally {
            setLoading(false);
        }
    }

    async function handleLogout() {
        await signOut({ redirectUrl: '/auth/login' });
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Тохиргоо</h1>
                <p className="text-gray-500 mt-1">Дэлгүүр болон системийн тохиргоо</p>
            </div>

            {/* Shop Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-violet-600" />
                        Дэлгүүрийн мэдээлэл
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Дэлгүүрийн нэр
                            </label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Syncly Shop"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Эзэмшигчийн нэр
                            </label>
                            <input
                                type="text"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Бат"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Утасны дугаар
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="99112233"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSaveShop} disabled={loading}>
                            {saveStatus === 'saving' ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Хадгалж байна...</>
                            ) : saveStatus === 'saved' ? (
                                <><Check className="w-4 h-4 mr-2" /> Хадгалагдлаа!</>
                            ) : (
                                <><Save className="w-4 h-4 mr-2" /> Хадгалах</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Bank Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-violet-600" />
                        Дансны мэдээлэл
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Банкны нэр
                            </label>
                            <input
                                type="text"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Хаан банк"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Дансны дугаар
                            </label>
                            <input
                                type="text"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="5000000000"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Дансны нэр
                            </label>
                            <input
                                type="text"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Эзэмшигчийн нэр"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveShop} disabled={loading}>
                            {saveStatus === 'saving' ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Хадгалж байна...</>
                            ) : saveStatus === 'saved' ? (
                                <><Check className="w-4 h-4 mr-2" /> Хадгалагдлаа!</>
                            ) : (
                                <><Save className="w-4 h-4 mr-2" /> Хадгалах</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Facebook Connection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Facebook className="w-5 h-5 text-blue-600" />
                        Facebook холболт
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {shop?.facebook_page_id ? (
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-green-900">{shop.facebook_page_name || 'Facebook Page'}</p>
                                    <p className="text-sm text-green-600">Холбогдсон</p>
                                </div>
                            </div>
                            <a
                                href="/setup"
                                className="text-sm text-green-700 hover:text-green-800 underline"
                            >
                                Өөрчлөх
                            </a>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-amber-900">Facebook холбогдоогүй</p>
                                    <p className="text-sm text-amber-600">Чатбот ажиллуулахын тулд холбоно уу</p>
                                </div>
                            </div>
                            <a href="/setup">
                                <Button variant="secondary">Холбох</Button>
                            </a>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* AI Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-violet-600" />
                        AI Чатбот тохиргоо
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* AI Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-medium text-gray-900">AI Чатбот идэвхжүүлэх</p>
                            <p className="text-sm text-gray-500">Messenger мессежүүдэд автоматаар хариулна</p>
                        </div>
                        <button
                            onClick={() => setAiEnabled(!aiEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiEnabled ? 'bg-violet-600' : 'bg-gray-200'
                                }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    {/* Auto Reply Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-medium text-gray-900">Автомат хариулт</p>
                            <p className="text-sm text-gray-500">Ажлын бус цагуудад автоматаар хариулна</p>
                        </div>
                        <button
                            onClick={() => setAutoReply(!autoReply)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoReply ? 'bg-violet-600' : 'bg-gray-200'
                                }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoReply ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    {/* Welcome Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Мэндчилгээний мессеж
                        </label>
                        <textarea
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            placeholder="Сайн байна уу! Би Syncly-ийн AI туслах..."
                        />
                    </div>

                    <a href="/dashboard/ai-settings" className="text-sm text-violet-600 hover:text-violet-700">
                        Дэлгэрэнгүй AI тохиргоо →
                    </a>
                </CardContent>
            </Card>

            {/* Account */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-violet-600" />
                        Хаяг
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 font-medium">
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{user?.email}</p>
                                <p className="text-sm text-gray-500">Email хаяг</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-red-600 hover:text-red-700"
                        >
                            <LogOut className="w-4 h-4" />
                            Гарах
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                        <Shield className="w-5 h-5" />
                        Аюултай бүс
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
                        <div>
                            <p className="font-medium text-red-900">Дэлгүүр устгах</p>
                            <p className="text-sm text-red-600">Бүх өгөгдөл устгагдана, буцаах боломжгүй</p>
                        </div>
                        <Button variant="secondary" className="text-red-600 border-red-300 hover:bg-red-50">
                            Устгах
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
