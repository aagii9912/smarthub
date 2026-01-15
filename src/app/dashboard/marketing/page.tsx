'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
    Send, Users, Tag, Filter, Loader2, CheckCircle,
    AlertCircle, MessageSquare
} from 'lucide-react';

interface Customer {
    id: string;
    name: string | null;
    facebook_id: string;
    tags: string[];
    last_contact_at: string | null;
}

const PREDEFINED_TAGS = ['VIP', 'New', 'Lead', 'Inactive', 'Problem', 'Regular'];

export default function MarketingPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    async function fetchCustomers() {
        try {
            const res = await fetch('/api/dashboard/customers', {
                headers: {
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || ''
                }
            });
            const data = await res.json();
            setCustomers(data.customers || []);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setLoading(false);
        }
    }

    // Filter customers based on selected tag and 24hr window
    const eligibleCustomers = customers.filter(c => {
        // Must have facebook_id
        if (!c.facebook_id) return false;

        // Check 24hr window
        if (c.last_contact_at) {
            const lastContact = new Date(c.last_contact_at);
            const now = new Date();
            const hoursDiff = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
            if (hoursDiff > 24) return false; // Outside 24hr window
        } else {
            return false; // No contact history
        }

        // Filter by tag
        if (selectedTag !== 'all') {
            return (c.tags || []).includes(selectedTag);
        }
        return true;
    });

    async function sendMassMessage() {
        if (!message.trim() || eligibleCustomers.length === 0) return;

        setSending(true);
        setResult(null);

        try {
            const res = await fetch('/api/marketing/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || ''
                },
                body: JSON.stringify({
                    message: message.trim(),
                    customerIds: eligibleCustomers.map(c => c.id),
                    tag: selectedTag !== 'all' ? selectedTag : undefined
                })
            });

            const data = await res.json();

            if (res.ok) {
                setResult({ success: true, message: `${data.sent || 0} хэрэглэгч рүү илгээгдлээ!` });
                setMessage('');
            } else {
                setResult({ success: false, message: data.error || 'Алдаа гарлаа' });
            }
        } catch (error) {
            setResult({ success: false, message: 'Сүлжээний алдаа' });
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Маркетинг</h1>
                <p className="text-gray-500 mt-1">Харилцагчдад зэрэг мессеж илгээх</p>
            </div>

            {/* Warning */}
            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <p className="font-medium">Facebook 24 цагийн дүрэм</p>
                            <p className="mt-1">
                                Зөвхөн сүүлийн 24 цагт тантай харьцсан хэрэглэгчид рүү л үнэгүй мессеж илгээх боломжтой.
                                Бусад руу илгээхэд Facebook Sponsored Message шаардлагатай.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Message Composer */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-violet-600" />
                                Мессеж бичих
                            </h3>

                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Таны мессеж..."
                                rows={5}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            />

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">
                                    {message.length}/500 тэмдэгт
                                </span>
                                <button
                                    onClick={sendMassMessage}
                                    disabled={sending || !message.trim() || eligibleCustomers.length === 0}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {sending ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                    Илгээх
                                </button>
                            </div>

                            {result && (
                                <div className={`flex items-center gap-2 p-3 rounded-xl ${result.success
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-700'
                                    }`}>
                                    {result.success ? (
                                        <CheckCircle className="w-5 h-5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5" />
                                    )}
                                    {result.message}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recipients Selection */}
                <div>
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Users className="w-5 h-5 text-violet-600" />
                                Хүлээн авагчид
                            </h3>

                            {/* Tag Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Filter className="w-4 h-4 inline mr-1" />
                                    Tag-аар шүүх
                                </label>
                                <select
                                    value={selectedTag}
                                    onChange={(e) => setSelectedTag(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="all">Бүгд (24 цагийн дотор)</option>
                                    {PREDEFINED_TAGS.map(tag => (
                                        <option key={tag} value={tag}>{tag}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Stats */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Нийт харилцагч:</span>
                                    <span className="font-medium">{customers.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">24 цагийн дотор:</span>
                                    <span className="font-medium text-green-600">
                                        {eligibleCustomers.length}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Илгээгдэх:</span>
                                    <span className="font-bold text-violet-600 text-lg">
                                        {eligibleCustomers.length}
                                    </span>
                                </div>
                            </div>

                            {eligibleCustomers.length === 0 && (
                                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl">
                                    Сүүлийн 24 цагт харьцсан харилцагч байхгүй байна.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
