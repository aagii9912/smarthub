'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
    Bot, Save, Plus, Trash2, Edit2, X, Check,
    MessageSquare, Zap, Sparkles, BarChart3,
    Smile, Briefcase, Cloud, PartyPopper, AlertCircle,
    HelpCircle, MessageCircle, Quote, Bell, BookOpen, Settings2
} from 'lucide-react';

type Tab = 'general' | 'faqs' | 'quick_replies' | 'slogans' | 'notifications' | 'knowledge' | 'policies' | 'stats';
type AiEmotion = 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';

interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    is_active: boolean;
    usage_count: number;
}

interface QuickReply {
    id: string;
    name: string;
    trigger_words: string[];
    response: string;
    is_exact_match: boolean;
    is_active: boolean;
    usage_count: number;
}

interface Slogan {
    id: string;
    slogan: string;
    usage_context: string;
    is_active: boolean;
}

interface AIStats {
    total_conversations: number;
    total_messages: number;
    conversion_rate: number;
    recent_conversations: number;
    top_questions: Array<{
        question_pattern: string;
        sample_question: string;
        category: string;
        count: number;
    }>;
}

const emotionOptions: Array<{ value: AiEmotion; label: string; icon: React.ReactNode }> = [
    { value: 'friendly', label: 'Найрсаг 😊', icon: <Smile className="w-5 h-5" /> },
    { value: 'professional', label: 'Мэргэжлийн 👔', icon: <Briefcase className="w-5 h-5" /> },
    { value: 'enthusiastic', label: 'Урам зоригтой 🎉', icon: <Zap className="w-5 h-5" /> },
    { value: 'calm', label: 'Тайван 🧘', icon: <Cloud className="w-5 h-5" /> },
    { value: 'playful', label: 'Тоглоомтой 🎮', icon: <PartyPopper className="w-5 h-5" /> },
];

const tabs = [
    { id: 'general' as Tab, label: 'Үндсэн', icon: Bot },
    { id: 'faqs' as Tab, label: 'FAQ', icon: HelpCircle },
    { id: 'quick_replies' as Tab, label: 'Хурдан хариулт', icon: MessageCircle },
    { id: 'slogans' as Tab, label: 'Хэллэгүүд', icon: Quote },
    { id: 'knowledge' as Tab, label: 'Мэдлэгийн сан', icon: BookOpen },
    { id: 'policies' as Tab, label: 'Бодлогууд', icon: Settings2 },
    { id: 'notifications' as Tab, label: 'Мэдэгдэл', icon: Bell },
    { id: 'stats' as Tab, label: 'Статистик', icon: BarChart3 },
];

export default function AISettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // General settings
    const [shopDescription, setShopDescription] = useState('');
    const [aiInstructions, setAiInstructions] = useState('');
    const [aiEmotion, setAiEmotion] = useState<AiEmotion>('friendly');
    const [notifyOnOrder, setNotifyOnOrder] = useState(true);
    const [notifyOnContact, setNotifyOnContact] = useState(true);
    const [notifyOnSupport, setNotifyOnSupport] = useState(true);

    const [notifyOnCancel, setNotifyOnCancel] = useState(true);
    const [isAiActive, setIsAiActive] = useState(true); // Added state

    // AI Features data
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
    const [slogans, setSlogans] = useState<Slogan[]>([]);
    const [stats, setStats] = useState<AIStats | null>(null);

    // NEW: Knowledge Base & Policies
    const [customKnowledge, setCustomKnowledge] = useState<Array<{ key: string; value: string }>>([]);
    const [policies, setPolicies] = useState({
        shipping_threshold: 50000,
        payment_methods: ['QPay', 'SocialPay', 'Бэлэн мөнгө'],
        delivery_areas: ['Улаанбаатар'],
        return_policy: '7 хоногийн дотор буцаах боломжтой'
    });
    const [newKnowledgeKey, setNewKnowledgeKey] = useState('');
    const [newKnowledgeValue, setNewKnowledgeValue] = useState('');

    // Edit states
    const [editingFaq, setEditingFaq] = useState<Partial<FAQ> | null>(null);
    const [editingQuickReply, setEditingQuickReply] = useState<Partial<QuickReply> | null>(null);
    const [editingSlogan, setEditingSlogan] = useState<Partial<Slogan> | null>(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    async function fetchAllData() {
        try {
            // Fetch shop data
            const shopRes = await fetch('/api/shop');
            const shopData = await shopRes.json();
            if (shopData.shop) {
                setShopDescription(shopData.shop.description || '');
                setAiInstructions(shopData.shop.ai_instructions || '');
                setAiEmotion(shopData.shop.ai_emotion || 'friendly');
                setNotifyOnOrder(shopData.shop.notify_on_order ?? true);
                setNotifyOnContact(shopData.shop.notify_on_contact ?? true);
                setNotifyOnSupport(shopData.shop.notify_on_support ?? true);
                setNotifyOnCancel(shopData.shop.notify_on_cancel ?? true);
                setIsAiActive(shopData.shop.is_ai_active ?? true); // Added

                // Load custom knowledge
                if (shopData.shop.custom_knowledge) {
                    const knowledgeArray = Object.entries(shopData.shop.custom_knowledge)
                        .map(([key, value]) => ({ key, value: String(value) }));
                    setCustomKnowledge(knowledgeArray);
                }

                // Load policies
                if (shopData.shop.policies) {
                    setPolicies(prev => ({ ...prev, ...shopData.shop.policies }));
                }
            }

            // Fetch AI settings
            const aiRes = await fetch('/api/ai-settings');
            if (aiRes.ok) {
                const aiData = await aiRes.json();
                setFaqs(aiData.faqs || []);
                setQuickReplies(aiData.quickReplies || []);
                setSlogans(aiData.slogans || []);
                setStats(aiData.stats || null);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveGeneral() {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: shopDescription,
                    ai_instructions: aiInstructions,
                    ai_emotion: aiEmotion,
                    notify_on_order: notifyOnOrder,
                    notify_on_contact: notifyOnContact,
                    notify_on_support: notifyOnSupport,
                    notify_on_cancel: notifyOnCancel,
                    is_ai_active: isAiActive, // Added
                }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // FAQ CRUD
    async function saveFaq() {
        if (!editingFaq?.question || !editingFaq?.answer) return;

        try {
            const isNew = !editingFaq.id;
            const res = await fetch('/api/ai-settings', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'faqs',
                    ...editingFaq
                }),
            });
            if (!res.ok) throw new Error('Failed to save FAQ');

            const { data } = await res.json();
            if (isNew) {
                setFaqs([...faqs, data]);
            } else {
                setFaqs(faqs.map(f => f.id === data.id ? data : f));
            }
            setEditingFaq(null);
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function deleteFaq(id: string) {
        try {
            await fetch(`/api/ai-settings?type=faqs&id=${id}`, { method: 'DELETE' });
            setFaqs(faqs.filter(f => f.id !== id));
        } catch (err: any) {
            setError(err.message);
        }
    }

    // Quick Reply CRUD
    async function saveQuickReply() {
        if (!editingQuickReply?.name || !editingQuickReply?.response) return;

        try {
            const isNew = !editingQuickReply.id;
            const res = await fetch('/api/ai-settings', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'quick_replies',
                    ...editingQuickReply,
                    trigger_words: typeof editingQuickReply.trigger_words === 'string'
                        ? editingQuickReply.trigger_words
                        : editingQuickReply.trigger_words?.join(', ')
                }),
            });
            if (!res.ok) throw new Error('Failed to save Quick Reply');

            const { data } = await res.json();
            if (isNew) {
                setQuickReplies([...quickReplies, data]);
            } else {
                setQuickReplies(quickReplies.map(q => q.id === data.id ? data : q));
            }
            setEditingQuickReply(null);
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function deleteQuickReply(id: string) {
        try {
            await fetch(`/api/ai-settings?type=quick_replies&id=${id}`, { method: 'DELETE' });
            setQuickReplies(quickReplies.filter(q => q.id !== id));
        } catch (err: any) {
            setError(err.message);
        }
    }

    // Slogan CRUD
    async function saveSlogan() {
        if (!editingSlogan?.slogan) return;

        try {
            const isNew = !editingSlogan.id;
            const res = await fetch('/api/ai-settings', {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'slogans',
                    ...editingSlogan
                }),
            });
            if (!res.ok) throw new Error('Failed to save Slogan');

            const { data } = await res.json();
            if (isNew) {
                setSlogans([...slogans, data]);
            } else {
                setSlogans(slogans.map(s => s.id === data.id ? data : s));
            }
            setEditingSlogan(null);
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function deleteSlogan(id: string) {
        try {
            await fetch(`/api/ai-settings?type=slogans&id=${id}`, { method: 'DELETE' });
            setSlogans(slogans.filter(s => s.id !== id));
        } catch (err: any) {
            setError(err.message);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Bot className="w-7 h-7 text-violet-600" />
                    AI Тохируулга
                </h1>
                <p className="text-gray-500 mt-1">Chatbot-ийн зан байдал, хариултуудыг тохируулах</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-violet-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Амжилттай хадгалагдлаа!
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'general' && (
                <div className="space-y-6">
                    {/* Main AI Toggle */}
                    <Card className={`${isAiActive ? 'bg-white' : 'bg-red-50 border-red-200'}`}>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <Zap className={`w-5 h-5 ${isAiActive ? 'text-violet-600' : 'text-gray-400'}`} />
                                    AI-г идэвхжүүлэх
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {isAiActive
                                        ? 'AI одоогоор идэвхтэй байна. Хэрэглэгчдэд хариу өгч байна.'
                                        : 'AI унтраалттай байна. Зөвхөн админ хариу өгнө.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsAiActive(!isAiActive)}
                                className={`w-14 h-8 rounded-full transition-colors relative ${isAiActive ? 'bg-violet-600' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${isAiActive ? 'left-7' : 'left-1'}`} />
                            </button>
                        </CardContent>
                    </Card>

                    {/* AI Emotion */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-4">AI Зан байдал</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {emotionOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setAiEmotion(option.value)}
                                        className={`p-4 rounded-xl border-2 transition-all ${aiEmotion === option.value
                                            ? 'border-violet-500 bg-violet-50'
                                            : 'border-gray-200 hover:border-violet-200'
                                            }`}
                                    >
                                        <div className={`mb-2 ${aiEmotion === option.value ? 'text-violet-600' : 'text-gray-400'}`}>
                                            {option.icon}
                                        </div>
                                        <p className={`font-medium text-sm ${aiEmotion === option.value ? 'text-violet-700' : 'text-gray-900'}`}>{option.label}</p>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Shop Description */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-2">Бизнесийн тайлбар</h2>
                            <p className="text-sm text-gray-500 mb-4">AI энэ мэдээллийг ашиглан бизнесийн талаар хариулна</p>
                            <Textarea
                                value={shopDescription}
                                onChange={(e) => setShopDescription(e.target.value)}
                                placeholder="Жишээ: Манай компани бол орон сууцны хороолол хөгжүүлэгч..."
                                rows={4}
                            />
                        </CardContent>
                    </Card>

                    {/* AI Instructions */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-2">AI Заавар</h2>
                            <p className="text-sm text-gray-500 mb-4">AI хэрхэн ярих, ямар хэв маягтай байхыг заана</p>
                            <Textarea
                                value={aiInstructions}
                                onChange={(e) => setAiInstructions(e.target.value)}
                                placeholder="Жишээ: Хэрэглэгчтэй найрсаг, дотно харилцаарай..."
                                rows={6}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSaveGeneral} disabled={saving}>
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                        </Button>
                    </div>
                </div>
            )}

            {activeTab === 'faqs' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Түгээмэл асуултууд (FAQ)</h2>
                        <Button onClick={() => setEditingFaq({ question: '', answer: '', category: 'general' })}>
                            <Plus className="w-4 h-4 mr-2" />
                            Нэмэх
                        </Button>
                    </div>

                    {/* FAQ Edit Form */}
                    {editingFaq && (
                        <Card className="border-violet-200 bg-violet-50">
                            <CardContent className="p-4 space-y-4">
                                <Input
                                    placeholder="Асуулт"
                                    value={editingFaq.question || ''}
                                    onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                                />
                                <Textarea
                                    placeholder="Хариулт"
                                    value={editingFaq.answer || ''}
                                    onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                                    rows={3}
                                />
                                <div className="flex gap-2">
                                    <Button onClick={saveFaq} size="sm">
                                        <Check className="w-4 h-4 mr-1" />
                                        Хадгалах
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setEditingFaq(null)}>
                                        <X className="w-4 h-4 mr-1" />
                                        Цуцлах
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* FAQ List */}
                    {faqs.length === 0 && !editingFaq ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                <HelpCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>FAQ байхгүй байна. Түгээмэл асуултуудаа нэмнэ үү.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {faqs.map((faq) => (
                                <Card key={faq.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{faq.question}</p>
                                                <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    Ашиглагдсан: {faq.usage_count}x
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingFaq(faq)}
                                                    className="p-2 text-gray-400 hover:text-violet-600"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteFaq(faq.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'quick_replies' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Хурдан хариултууд</h2>
                        <Button onClick={() => setEditingQuickReply({ name: '', trigger_words: [], response: '' })}>
                            <Plus className="w-4 h-4 mr-2" />
                            Нэмэх
                        </Button>
                    </div>

                    {/* Quick Reply Edit Form */}
                    {editingQuickReply && (
                        <Card className="border-violet-200 bg-violet-50">
                            <CardContent className="p-4 space-y-4">
                                <Input
                                    placeholder="Нэр (жишээ: Үнэ асуулт)"
                                    value={editingQuickReply.name || ''}
                                    onChange={(e) => setEditingQuickReply({ ...editingQuickReply, name: e.target.value })}
                                />
                                <Input
                                    placeholder="Trigger үгс (таслалаар: үнэ, хэд вэ, price)"
                                    value={
                                        Array.isArray(editingQuickReply.trigger_words)
                                            ? editingQuickReply.trigger_words.join(', ')
                                            : editingQuickReply.trigger_words || ''
                                    }
                                    onChange={(e) => setEditingQuickReply({
                                        ...editingQuickReply,
                                        trigger_words: e.target.value as any
                                    })}
                                />
                                <Textarea
                                    placeholder="Хариулт"
                                    value={editingQuickReply.response || ''}
                                    onChange={(e) => setEditingQuickReply({ ...editingQuickReply, response: e.target.value })}
                                    rows={3}
                                />
                                <div className="flex gap-2">
                                    <Button onClick={saveQuickReply} size="sm">
                                        <Check className="w-4 h-4 mr-1" />
                                        Хадгалах
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setEditingQuickReply(null)}>
                                        <X className="w-4 h-4 mr-1" />
                                        Цуцлах
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick Reply List */}
                    {quickReplies.length === 0 && !editingQuickReply ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Хурдан хариулт байхгүй. Trigger үгс + хариулт нэмнэ үү.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {quickReplies.map((qr) => (
                                <Card key={qr.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{qr.name}</p>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {qr.trigger_words.map((word, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded">
                                                            {word}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-sm text-gray-600 mt-2">{qr.response}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingQuickReply(qr)}
                                                    className="p-2 text-gray-400 hover:text-violet-600"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteQuickReply(qr.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'slogans' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Тусгай хэллэгүүд</h2>
                        <Button onClick={() => setEditingSlogan({ slogan: '', usage_context: 'any' })}>
                            <Plus className="w-4 h-4 mr-2" />
                            Нэмэх
                        </Button>
                    </div>

                    {/* Slogan Edit Form */}
                    {editingSlogan && (
                        <Card className="border-violet-200 bg-violet-50">
                            <CardContent className="p-4 space-y-4">
                                <Textarea
                                    placeholder="Хэллэг (жишээ: Манайхаар хэзээ ч тавтай морилно уу!)"
                                    value={editingSlogan.slogan || ''}
                                    onChange={(e) => setEditingSlogan({ ...editingSlogan, slogan: e.target.value })}
                                    rows={2}
                                />
                                <select
                                    value={editingSlogan.usage_context || 'any'}
                                    onChange={(e) => setEditingSlogan({ ...editingSlogan, usage_context: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                                >
                                    <option value="any">Дурын үед</option>
                                    <option value="greeting">Мэндчилгээнд</option>
                                    <option value="closing">Баяртай хэлэхэд</option>
                                    <option value="promotion">Хямдрал дурдахад</option>
                                </select>
                                <div className="flex gap-2">
                                    <Button onClick={saveSlogan} size="sm">
                                        <Check className="w-4 h-4 mr-1" />
                                        Хадгалах
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={() => setEditingSlogan(null)}>
                                        <X className="w-4 h-4 mr-1" />
                                        Цуцлах
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Slogan List */}
                    {slogans.length === 0 && !editingSlogan ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                <Quote className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Хэллэг байхгүй. Брэндийн хэллэгүүдээ нэмнэ үү.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {slogans.map((slogan) => (
                                <Card key={slogan.id}>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">"{slogan.slogan}"</p>
                                                <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${slogan.usage_context === 'greeting' ? 'bg-green-100 text-green-700' :
                                                    slogan.usage_context === 'closing' ? 'bg-blue-100 text-blue-700' :
                                                        slogan.usage_context === 'promotion' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {slogan.usage_context === 'greeting' ? 'Мэндчилгээ' :
                                                        slogan.usage_context === 'closing' ? 'Баяртай' :
                                                            slogan.usage_context === 'promotion' ? 'Хямдрал' : 'Дурын'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingSlogan(slogan)}
                                                    className="p-2 text-gray-400 hover:text-violet-600"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteSlogan(slogan.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="space-y-6">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-3xl font-bold text-violet-600">{stats?.total_conversations || 0}</p>
                                <p className="text-sm text-gray-500">Нийт яриа</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-3xl font-bold text-violet-600">{stats?.recent_conversations || 0}</p>
                                <p className="text-sm text-gray-500">Сүүлийн 7 хоног</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-3xl font-bold text-violet-600">{stats?.total_messages || 0}</p>
                                <p className="text-sm text-gray-500">Нийт мессеж</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-3xl font-bold text-emerald-600">{stats?.conversion_rate?.toFixed(1) || 0}%</p>
                                <p className="text-sm text-gray-500">Захиалга болсон</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Questions */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-4">Түгээмэл асуултууд</h2>
                            {stats?.top_questions?.length ? (
                                <div className="space-y-3">
                                    {stats.top_questions.map((q, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="text-sm text-gray-900">{q.sample_question}</p>
                                                <span className="text-xs text-gray-500">{q.category}</span>
                                            </div>
                                            <span className="px-2 py-1 bg-violet-100 text-violet-700 text-sm font-medium rounded">
                                                {q.count}x
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">
                                    Статистик цуглаагүй байна. AI ашиглагдсаны дараа энд харагдана.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'notifications' && (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-2">Push Мэдэгдлийн тохиргоо</h2>
                            <p className="text-sm text-gray-500 mb-6">AI ямар тохиолдолд танд болон операторууд руу мэдэгдэл илгээхийг сонгоно уу.</p>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-medium text-gray-900">Шинэ захиалга</p>
                                        <p className="text-xs text-gray-500">AI амжилттай захиалга бүртгэх үед</p>
                                    </div>
                                    <button
                                        onClick={() => setNotifyOnOrder(!notifyOnOrder)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${notifyOnOrder ? 'bg-violet-600' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifyOnOrder ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-medium text-gray-900">Холбоо барих мэдээлэл</p>
                                        <p className="text-xs text-gray-500">Хэрэглэгч утас, хаягаа AI-д үлдээх үед</p>
                                    </div>
                                    <button
                                        onClick={() => setNotifyOnContact(!notifyOnContact)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${notifyOnContact ? 'bg-violet-600' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifyOnContact ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-medium text-gray-900">Оператортой холбогдох</p>
                                        <p className="text-xs text-gray-500">Хэрэглэгч хүнээс тусламж хүсэх үед</p>
                                    </div>
                                    <button
                                        onClick={() => setNotifyOnSupport(!notifyOnSupport)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${notifyOnSupport ? 'bg-violet-600' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifyOnSupport ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-medium text-gray-900">Захиалга цуцлалт</p>
                                        <p className="text-xs text-gray-500">Хэрэглэгч чатаар захиалгаа цуцлах үед</p>
                                    </div>
                                    <button
                                        onClick={() => setNotifyOnCancel(!notifyOnCancel)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${notifyOnCancel ? 'bg-violet-600' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifyOnCancel ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSaveGeneral} disabled={saving}>
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Knowledge Base Tab */}
            {activeTab === 'knowledge' && (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-2">Мэдлэгийн сан</h2>
                            <p className="text-sm text-gray-500 mb-4">AI-д ашиглуулах нэмэлт мэдээлэл (буцаалтын бодлого, ажлын цаг г.м)</p>

                            {/* Add new knowledge item */}
                            <div className="flex gap-2 mb-4">
                                <Input
                                    placeholder="Талбарын нэр (жишээ: Буцаалт)"
                                    value={newKnowledgeKey}
                                    onChange={(e) => setNewKnowledgeKey(e.target.value)}
                                    className="flex-1"
                                />
                                <Input
                                    placeholder="Утга (жишээ: 7 хоногийн дотор)"
                                    value={newKnowledgeValue}
                                    onChange={(e) => setNewKnowledgeValue(e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={() => {
                                        if (newKnowledgeKey && newKnowledgeValue) {
                                            setCustomKnowledge([...customKnowledge, { key: newKnowledgeKey, value: newKnowledgeValue }]);
                                            setNewKnowledgeKey('');
                                            setNewKnowledgeValue('');
                                        }
                                    }}
                                    disabled={!newKnowledgeKey || !newKnowledgeValue}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Knowledge list */}
                            {customKnowledge.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                    <p>Мэдээлэл байхгүй. AI-д зааж өгөх мэдээлэл нэмнэ үү.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {customKnowledge.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                            <span className="font-medium text-violet-700 min-w-[120px]">{item.key}:</span>
                                            <span className="flex-1 text-gray-900">{item.value}</span>
                                            <button
                                                onClick={() => setCustomKnowledge(customKnowledge.filter((_, i) => i !== index))}
                                                className="p-1 text-gray-400 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={async () => {
                            setSaving(true);
                            try {
                                const knowledgeObject = customKnowledge.reduce((acc, item) => {
                                    acc[item.key] = item.value;
                                    return acc;
                                }, {} as Record<string, string>);

                                await fetch('/api/shop', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ custom_knowledge: knowledgeObject }),
                                });
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                            } catch (err: any) {
                                setError(err.message);
                            } finally {
                                setSaving(false);
                            }
                        }} disabled={saving}>
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
                <div className="space-y-6">
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="font-semibold text-gray-900 mb-4">Дэлгүүрийн бодлогууд</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Үнэгүй хүргэлтийн босго (₮)
                                    </label>
                                    <Input
                                        type="number"
                                        value={policies.shipping_threshold}
                                        onChange={(e) => setPolicies({ ...policies, shipping_threshold: Number(e.target.value) })}
                                        placeholder="50000"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Энэ дүнгээс дээш захиалгад хүргэлт үнэгүй</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Төлбөрийн аргууд
                                    </label>
                                    <Input
                                        value={policies.payment_methods.join(', ')}
                                        onChange={(e) => setPolicies({ ...policies, payment_methods: e.target.value.split(',').map(s => s.trim()) })}
                                        placeholder="QPay, SocialPay, Бэлэн мөнгө"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Таслалаар тусгаарла</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Хүргэлтийн бүс нутаг
                                    </label>
                                    <Input
                                        value={policies.delivery_areas.join(', ')}
                                        onChange={(e) => setPolicies({ ...policies, delivery_areas: e.target.value.split(',').map(s => s.trim()) })}
                                        placeholder="Улаанбаатар, Дархан"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Буцаалтын бодлого
                                    </label>
                                    <Textarea
                                        value={policies.return_policy}
                                        onChange={(e) => setPolicies({ ...policies, return_policy: e.target.value })}
                                        placeholder="7 хоногийн дотор буцаах боломжтой"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={async () => {
                            setSaving(true);
                            try {
                                await fetch('/api/shop', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ policies }),
                                });
                                setSuccess(true);
                                setTimeout(() => setSuccess(false), 3000);
                            } catch (err: any) {
                                setError(err.message);
                            } finally {
                                setSaving(false);
                            }
                        }} disabled={saving}>
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
