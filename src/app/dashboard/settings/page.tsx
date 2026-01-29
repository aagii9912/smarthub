'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { canUseInstagram } from '@/lib/plan-limits';
import {
    Store, User, Facebook, Bot, Bell, Shield,
    Save, LogOut, Loader2, Check, AlertCircle,
    Key, Palette, Globe, CreditCard, Instagram,
    Unlink, Crown, ExternalLink
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

    // Platform disconnect state
    const [disconnecting, setDisconnecting] = useState<'facebook' | 'instagram' | null>(null);

    // Check if Instagram is available for this plan
    const instagramAvailable = canUseInstagram((shop as any)?.subscription_plan);

    useEffect(() => {
        if (shop) {
            setShopName(shop.name || '');
            setOwnerName(shop.owner_name || '');
            setPhone(shop.phone || '');
            setBankName(shop.bank_name || '');
            setAccountNumber(shop.account_number || '');
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

    async function handleDisconnect(platform: 'facebook' | 'instagram') {
        if (!confirm(`${platform === 'facebook' ? 'Facebook' : 'Instagram'}-г салгах уу? Чатбот энэ платформд ажиллахгүй болно.`)) {
            return;
        }

        setDisconnecting(platform);
        try {
            const res = await fetch('/api/shop/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform })
            });

            if (!res.ok) throw new Error('Failed to disconnect');
            await refreshShop();
        } catch (error) {
            console.error('Disconnect error:', error);
            alert('Салгахад алдаа гарлаа');
        } finally {
            setDisconnecting(null);
        }
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
                        Facebook Messenger
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {shop?.facebook_page_id ? (
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Check className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-blue-900">{shop.facebook_page_name || 'Facebook Page'}</p>
                                    <p className="text-sm text-blue-600">Messenger чатбот идэвхтэй</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href="/api/auth/facebook"
                                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                                >
                                    Өөрчлөх
                                </a>
                                <button
                                    onClick={() => handleDisconnect('facebook')}
                                    disabled={disconnecting === 'facebook'}
                                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
                                >
                                    {disconnecting === 'facebook' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Unlink className="w-4 h-4" />
                                    )}
                                    Салгах
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-amber-900">Facebook холбогдоогүй</p>
                                    <p className="text-sm text-amber-600">Messenger чатбот идэвхжүүлэхийн тулд холбоно уу</p>
                                </div>
                            </div>
                            <a href="/api/auth/facebook">
                                <Button variant="secondary" className="gap-2">
                                    <Facebook className="w-4 h-4" />
                                    Холбох
                                </Button>
                            </a>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Instagram Connection */}
            <Card className={!instagramAvailable ? 'opacity-75' : ''}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded flex items-center justify-center">
                            <Instagram className="w-3.5 h-3.5 text-white" />
                        </div>
                        Instagram DM
                        {!instagramAvailable && (
                            <span className="ml-2 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                Pro+
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!instagramAvailable ? (
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                    <Crown className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Pro план шаардлагатай</p>
                                    <p className="text-sm text-gray-500">Instagram DM чатбот Pro+ планд багтсан</p>
                                </div>
                            </div>
                            <a href="/dashboard/subscription">
                                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 gap-2">
                                    <Crown className="w-4 h-4" />
                                    Шинэчлэх
                                </Button>
                            </a>
                        </div>
                    ) : (shop as any)?.instagram_business_account_id ? (
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                    <Check className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-medium text-purple-900">@{(shop as any).instagram_username || 'Instagram'}</p>
                                    <p className="text-sm text-purple-600">DM чатбот идэвхтэй</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href="/api/auth/instagram"
                                    className="text-sm text-purple-600 hover:text-purple-700 underline"
                                >
                                    Өөрчлөх
                                </a>
                                <button
                                    onClick={() => handleDisconnect('instagram')}
                                    disabled={disconnecting === 'instagram'}
                                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
                                >
                                    {disconnecting === 'instagram' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Unlink className="w-4 h-4" />
                                    )}
                                    Салгах
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-amber-900">Instagram холбогдоогүй</p>
                                    <p className="text-sm text-amber-600">DM чатбот идэвхжүүлэхийн тулд холбоно уу</p>
                                </div>
                            </div>
                            <a href="/api/auth/instagram">
                                <Button variant="secondary" className="gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 border-0">
                                    <Instagram className="w-4 h-4" />
                                    Холбох
                                </Button>
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
