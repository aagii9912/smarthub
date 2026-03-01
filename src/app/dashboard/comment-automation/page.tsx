'use client';

import { useState, useEffect } from 'react';
import {
    MessageSquareMore,
    Plus,
    Trash2,
    Save,
    Loader2,
    ToggleLeft,
    ToggleRight,
    Zap,
    Send,
    MessageCircle,
    Hash,
    Globe,
    Target,
    X,
    TrendingUp,
    Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface Automation {
    id: string;
    name: string;
    is_active: boolean;
    post_id: string | null;
    post_url: string | null;
    trigger_keywords: string[];
    match_type: 'contains' | 'exact';
    action_type: 'send_dm' | 'reply_comment' | 'both';
    dm_message: string;
    reply_message: string | null;
    platform: 'facebook' | 'instagram' | 'both';
    trigger_count: number;
    last_triggered_at: string | null;
    created_at: string;
}

const PLATFORM_OPTIONS = [
    { value: 'both', label: 'Facebook + Instagram', icon: '🌐' },
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'instagram', label: 'Instagram', icon: '📸' },
];

const ACTION_OPTIONS = [
    { value: 'send_dm', label: 'DM илгээх', desc: 'Хэрэглэгч рүү шууд мессеж' },
    { value: 'reply_comment', label: 'Comment хариулах', desc: 'Comment-д хариу бичих' },
    { value: 'both', label: 'DM + Comment', desc: 'Хоёуланг нь хийх' },
];

export default function CommentAutomationPage() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [triggerKeywords, setTriggerKeywords] = useState('');
    const [dmMessage, setDmMessage] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [matchType, setMatchType] = useState<'contains' | 'exact'>('contains');
    const [actionType, setActionType] = useState<'send_dm' | 'reply_comment' | 'both'>('send_dm');
    const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'both'>('both');
    const [postUrl, setPostUrl] = useState('');

    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    useEffect(() => {
        fetchAutomations();
    }, []);

    async function fetchAutomations() {
        try {
            setLoading(true);
            const res = await fetch('/api/dashboard/comment-automations', {
                headers: { 'x-shop-id': shopId },
            });
            const data = await res.json();
            setAutomations(data.automations || []);
        } catch {
            toast.error('Алдаа гарлаа');
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setName('');
        setTriggerKeywords('');
        setDmMessage('');
        setReplyMessage('');
        setMatchType('contains');
        setActionType('send_dm');
        setPlatform('both');
        setPostUrl('');
        setEditingId(null);
        setShowForm(false);
    }

    function startEdit(a: Automation) {
        setName(a.name);
        setTriggerKeywords(a.trigger_keywords.join(', '));
        setDmMessage(a.dm_message);
        setReplyMessage(a.reply_message || '');
        setMatchType(a.match_type);
        setActionType(a.action_type);
        setPlatform(a.platform);
        setPostUrl(a.post_url || '');
        setEditingId(a.id);
        setShowForm(true);
    }

    async function handleSave() {
        if (!name || !triggerKeywords || !dmMessage) {
            toast.error('Нэр, түлхүүр үг, мессеж шаардлагатай');
            return;
        }

        setSaving(true);
        try {
            const keywords = triggerKeywords.split(',').map(k => k.trim()).filter(Boolean);
            const body = {
                ...(editingId ? { id: editingId } : {}),
                name,
                trigger_keywords: keywords,
                dm_message: dmMessage,
                match_type: matchType,
                action_type: actionType,
                reply_message: replyMessage || undefined,
                platform,
                post_url: postUrl || undefined,
            };

            const res = await fetch('/api/dashboard/comment-automations', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                toast.success(editingId ? 'Шинэчлэгдлээ' : 'Automation үүслээ!');
                resetForm();
                fetchAutomations();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Алдаа');
            }
        } catch {
            toast.error('Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(id: string, currentState: boolean) {
        try {
            await fetch('/api/dashboard/comment-automations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ id, is_active: !currentState }),
            });
            setAutomations(prev =>
                prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a)
            );
            toast.success(!currentState ? 'Идэвхжүүлсэн' : 'Зогсоосон');
        } catch {
            toast.error('Алдаа');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Энэ automation-ыг устгах уу?')) return;
        try {
            await fetch(`/api/dashboard/comment-automations?id=${id}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': shopId },
            });
            setAutomations(prev => prev.filter(a => a.id !== id));
            toast.success('Устгагдлаа');
        } catch {
            toast.error('Алдаа');
        }
    }

    const inputCls = "w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-transparent focus:outline-none focus:border-blue-500/40 transition-colors placeholder:text-white/20";
    const labelCls = "block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-1.5";

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-bold text-foreground tracking-[-0.03em] flex items-center gap-2">
                        <MessageSquareMore className="w-5 h-5 text-blue-400" />
                        Comment Удирдлага
                    </h1>
                    <p className="text-[13px] text-white/40 mt-1">
                        Comment дээр түлхүүр үг бичвэл автомат DM илгээнэ
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold rounded-lg text-[13px] hover:from-blue-400 hover:to-violet-400 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Шинэ Automation
                </button>
            </div>

            {/* How it works */}
            {automations.length === 0 && !showForm && (
                <div className="bg-[#0F0B2E] rounded-xl border border-white/[0.08] p-8 text-center">
                    <MessageSquareMore className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-[15px] font-semibold text-foreground mb-2">Яаж ажилладаг?</h3>
                    <div className="max-w-md mx-auto space-y-3 text-[13px] text-white/40">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0">1</div>
                            <span>Та түлхүүр үг тохируулна (жишээ: &quot;DM&quot;, &quot;үнэ&quot;)</span>
                        </div>
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0">2</div>
                            <span>Хэрэглэгч пост дээр тэр үгийг comment бичнэ</span>
                        </div>
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[11px] font-bold shrink-0">3</div>
                            <span>Тэр хэрэглэгч рүү автомат DM очно 🚀</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-6 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold rounded-lg text-[13px] hover:from-blue-400 hover:to-violet-400 transition-all"
                    >
                        Эхлэх →
                    </button>
                </div>
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <div className="bg-[#0F0B2E] rounded-xl border border-blue-500/20 p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-semibold text-foreground">
                            {editingId ? 'Automation засах' : 'Шинэ Automation'}
                        </h3>
                        <button onClick={resetForm} className="p-1 text-white/30 hover:text-white/60 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Name */}
                        <div>
                            <label className={labelCls}>Нэр</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={inputCls}
                                placeholder="Хямдралын DM, Шинэ бүтээгдэхүүн..."
                            />
                        </div>

                        {/* Platform */}
                        <div>
                            <label className={labelCls}>Платформ</label>
                            <div className="flex gap-2">
                                {PLATFORM_OPTIONS.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setPlatform(p.value as typeof platform)}
                                        className={`flex-1 px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-colors ${platform === p.value
                                                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                                : 'border-white/[0.08] text-white/40 hover:border-blue-500/20'
                                            }`}
                                    >
                                        {p.icon} {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Keywords */}
                        <div>
                            <label className={labelCls}>
                                <Hash className="w-3 h-3 inline mr-1" />
                                Түлхүүр үгс (таслалаар тусгаарлах)
                            </label>
                            <input
                                value={triggerKeywords}
                                onChange={e => setTriggerKeywords(e.target.value)}
                                className={inputCls}
                                placeholder="DM, үнэ, info, мэдээлэл"
                            />
                        </div>

                        {/* Match Type */}
                        <div>
                            <label className={labelCls}>
                                <Target className="w-3 h-3 inline mr-1" />
                                Тааруулах арга
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMatchType('contains')}
                                    className={`flex-1 px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-colors ${matchType === 'contains'
                                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                            : 'border-white/[0.08] text-white/40 hover:border-blue-500/20'
                                        }`}
                                >
                                    Агуулсан (contains)
                                </button>
                                <button
                                    onClick={() => setMatchType('exact')}
                                    className={`flex-1 px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-colors ${matchType === 'exact'
                                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                            : 'border-white/[0.08] text-white/40 hover:border-blue-500/20'
                                        }`}
                                >
                                    Яг таарах (exact)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Action Type */}
                    <div>
                        <label className={labelCls}>
                            <Zap className="w-3 h-3 inline mr-1" />
                            Үйлдэл
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {ACTION_OPTIONS.map(a => (
                                <button
                                    key={a.value}
                                    onClick={() => setActionType(a.value as typeof actionType)}
                                    className={`px-3 py-3 rounded-lg border text-left transition-colors ${actionType === a.value
                                            ? 'border-blue-500/50 bg-blue-500/10'
                                            : 'border-white/[0.08] hover:border-blue-500/20'
                                        }`}
                                >
                                    <p className={`text-[12px] font-medium ${actionType === a.value ? 'text-blue-400' : 'text-white/60'}`}>{a.label}</p>
                                    <p className="text-[10px] text-white/30 mt-0.5">{a.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DM Message */}
                    {(actionType === 'send_dm' || actionType === 'both') && (
                        <div>
                            <label className={labelCls}>
                                <Send className="w-3 h-3 inline mr-1" />
                                DM Мессеж
                            </label>
                            <textarea
                                value={dmMessage}
                                onChange={e => setDmMessage(e.target.value)}
                                className={`${inputCls} resize-none`}
                                rows={3}
                                placeholder="Сайн байна уу! 😊 Манай хямдрал 50% хүртэл. Дэлгэрэнгүй мэдээлэл..."
                            />
                        </div>
                    )}

                    {/* Reply Message */}
                    {(actionType === 'reply_comment' || actionType === 'both') && (
                        <div>
                            <label className={labelCls}>
                                <MessageCircle className="w-3 h-3 inline mr-1" />
                                Comment хариу
                            </label>
                            <textarea
                                value={replyMessage}
                                onChange={e => setReplyMessage(e.target.value)}
                                className={`${inputCls} resize-none`}
                                rows={2}
                                placeholder="Баярлалаа! DM-ээр мэдээлэл илгээлээ 📩"
                            />
                        </div>
                    )}

                    {/* Post URL (optional) */}
                    <div>
                        <label className={labelCls}>
                            <Globe className="w-3 h-3 inline mr-1" />
                            Пост URL (сонголттой — хоосон бол бүх пост)
                        </label>
                        <input
                            value={postUrl}
                            onChange={e => setPostUrl(e.target.value)}
                            className={inputCls}
                            placeholder="https://facebook.com/... (хоосон = бүх пост)"
                        />
                    </div>

                    {/* Preview */}
                    {dmMessage && (
                        <div className="bg-[#0D0928] rounded-lg border border-white/[0.04] p-4">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">DM Preview</p>
                            <div className="bg-blue-500/10 rounded-lg px-4 py-3 text-[13px] text-blue-200 max-w-sm">
                                {dmMessage}
                            </div>
                        </div>
                    )}

                    {/* Save */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={resetForm} className="px-4 py-2 text-[12px] text-white/40 hover:text-white/60 transition-colors">
                            Цуцлах
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !name || !triggerKeywords || !dmMessage}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold rounded-lg text-[12px] hover:from-blue-400 hover:to-violet-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {editingId ? 'Шинэчлэх' : 'Үүсгэх'}
                        </button>
                    </div>
                </div>
            )}

            {/* Automation List */}
            {automations.length > 0 && (
                <div className="space-y-3">
                    {automations.map(a => (
                        <div
                            key={a.id}
                            className={`bg-[#0F0B2E] rounded-xl border p-5 transition-colors ${a.is_active ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {/* Name & Status */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            onClick={() => toggleActive(a.id, a.is_active)}
                                            className="shrink-0"
                                            title={a.is_active ? 'Зогсоох' : 'Идэвхжүүлэх'}
                                        >
                                            {a.is_active ? (
                                                <ToggleRight className="w-6 h-6 text-emerald-400" />
                                            ) : (
                                                <ToggleLeft className="w-6 h-6 text-white/20" />
                                            )}
                                        </button>
                                        <h3 className="text-[14px] font-semibold text-foreground truncate">
                                            {a.name}
                                        </h3>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${a.platform === 'facebook' ? 'bg-blue-500/10 text-blue-400' :
                                                a.platform === 'instagram' ? 'bg-pink-500/10 text-pink-400' :
                                                    'bg-violet-500/10 text-violet-400'
                                            }`}>
                                            {a.platform === 'both' ? 'FB+IG' : a.platform === 'facebook' ? 'FB' : 'IG'}
                                        </span>
                                    </div>

                                    {/* Keywords */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {a.trigger_keywords.map((kw, i) => (
                                            <span
                                                key={i}
                                                className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/50 border border-white/[0.06]"
                                            >
                                                {kw}
                                            </span>
                                        ))}
                                        <span className="text-[10px] text-white/20 self-center ml-1">
                                            ({a.match_type === 'contains' ? 'агуулсан' : 'яг таарах'})
                                        </span>
                                    </div>

                                    {/* DM Preview */}
                                    <p className="text-[12px] text-white/40 truncate max-w-lg">
                                        💬 {a.dm_message}
                                    </p>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 mt-3 text-[11px] text-white/30">
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            {a.trigger_count} удаа
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Zap className="w-3 h-3" />
                                            {a.action_type === 'send_dm' ? 'DM' : a.action_type === 'reply_comment' ? 'Reply' : 'DM+Reply'}
                                        </span>
                                        {a.last_triggered_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(a.last_triggered_at).toLocaleDateString('mn-MN')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => startEdit(a)}
                                        className="p-2 text-white/20 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                        title="Засах"
                                    >
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(a.id)}
                                        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Устгах"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
