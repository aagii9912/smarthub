'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bot, Save, Plus, Trash2, Edit2, X, MessageSquare, Bell, BookOpen, Shield, BarChart3, Settings, Zap, Smile, Globe, Check, Loader2, ChevronRight, Hash } from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
    { id: 'general', label: 'Ерөнхий', icon: Settings },
    { id: 'faq', label: 'FAQ', icon: MessageSquare },
    { id: 'replies', label: 'Хурдан хариу', icon: Zap },
    { id: 'slogans', label: 'Слоган', icon: Hash },
    { id: 'notifications', label: 'Мэдэгдэл', icon: Bell },
    { id: 'knowledge', label: 'Мэдлэг', icon: BookOpen },
    { id: 'policies', label: 'Бодлого', icon: Shield },
    { id: 'stats', label: 'Статистик', icon: BarChart3 }
];

export default function AISettingsPage() {
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // General
    const [aiEnabled, setAiEnabled] = useState(true);
    const [emotion, setEmotion] = useState('friendly');
    const [greeting, setGreeting] = useState('');
    // Notifications
    const [notifyOnOrder, setNotifyOnOrder] = useState(true);
    const [notifyOnContact, setNotifyOnContact] = useState(true);
    const [notifyOnSupport, setNotifyOnSupport] = useState(true);
    // FAQ
    const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
    const [newFaqQ, setNewFaqQ] = useState('');
    const [newFaqA, setNewFaqA] = useState('');
    // Quick Replies
    const [replies, setReplies] = useState<{ trigger: string; response: string }[]>([]);
    const [newTrigger, setNewTrigger] = useState('');
    const [newResponse, setNewResponse] = useState('');
    // Slogans
    const [slogans, setSlogans] = useState<string[]>([]);
    const [newSlogan, setNewSlogan] = useState('');
    // Knowledge
    const [knowledge, setKnowledge] = useState<{ key: string; value: string }[]>([]);
    const [newKKey, setNewKKey] = useState('');
    const [newKVal, setNewKVal] = useState('');
    // Policies
    const [policies, setPolicies] = useState({ shipping_threshold: 0, return_policy: '', payment_methods: [] as string[], delivery_areas: [] as string[] });
    // Stats
    const [stats, setStats] = useState({ total_conversations: 0, total_messages: 0, avg_response_time: 0, satisfaction_rate: 0 });

    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        try {
            setLoading(true);
            const [shopRes, faqRes, repRes, sloRes] = await Promise.all([
                fetch('/api/shop', { headers: { 'x-shop-id': shopId } }),
                fetch('/api/dashboard/faqs', { headers: { 'x-shop-id': shopId } }).catch(() => null),
                fetch('/api/dashboard/quick-replies', { headers: { 'x-shop-id': shopId } }).catch(() => null),
                fetch('/api/dashboard/slogans', { headers: { 'x-shop-id': shopId } }).catch(() => null)
            ]);
            const shopData = await shopRes.json();
            if (shopData.shop) {
                const s = shopData.shop;
                setAiEnabled(s.ai_enabled !== false);
                setEmotion(s.ai_emotion || 'friendly');
                setGreeting(s.greeting_message || '');
                setNotifyOnOrder(s.notify_on_order !== false);
                setNotifyOnContact(s.notify_on_contact !== false);
                setNotifyOnSupport(s.notify_on_support !== false);
                if (s.custom_knowledge) setKnowledge(Object.entries(s.custom_knowledge).map(([key, value]) => ({ key, value: value as string })));
                if (s.policies) setPolicies({ ...policies, ...s.policies });
            }
            if (faqRes?.ok) { const d = await faqRes.json(); setFaqs(d.faqs || []); }
            if (repRes?.ok) { const d = await repRes.json(); setReplies(d.replies || []); }
            if (sloRes?.ok) { const d = await sloRes.json(); setSlogans(d.slogans || []); }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }

    async function saveGeneral() {
        setSaving(true);
        try {
            await fetch('/api/shop', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ ai_enabled: aiEnabled, ai_emotion: emotion, greeting_message: greeting, notify_on_order: notifyOnOrder, notify_on_contact: notifyOnContact, notify_on_support: notifyOnSupport })
            });
            toast.success('Хадгалагдлаа');
        } catch { toast.error('Алдаа гарлаа'); } finally { setSaving(false); }
    }

    async function saveKnowledge() {
        setSaving(true);
        try {
            const obj = knowledge.reduce((a, i) => { if (i.key && i.value) a[i.key] = i.value; return a; }, {} as Record<string, string>);
            await fetch('/api/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId }, body: JSON.stringify({ custom_knowledge: obj }) });
            toast.success('Хадгалагдлаа');
        } catch { toast.error('Алдаа'); } finally { setSaving(false); }
    }

    async function savePolicies() {
        setSaving(true);
        try {
            await fetch('/api/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId }, body: JSON.stringify({ policies }) });
            toast.success('Хадгалагдлаа');
        } catch { toast.error('Алдаа'); } finally { setSaving(false); }
    }

    const inputCls = "w-full px-3 py-2 border border-white/[0.08] rounded-md text-[13px] text-foreground bg-transparent focus:outline-none focus:border-white/[0.2] transition-colors";
    const labelCls = "block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-1.5";
    const cardCls = "bg-[#0F0B2E] rounded-lg border border-white/[0.08] p-6";
    const toggleCls = (on: boolean) => `relative w-11 h-6 rounded-full transition-colors cursor-pointer ${on ? 'bg-[#4A7CE7]' : 'bg-[#1C1650]'}`;
    const toggleDot = (on: boolean) => `absolute top-1 w-4 h-4 bg-[#0F0B2E] rounded-full transition-all ${on ? 'left-6' : 'left-1'}`;
    const saveBtnCls = "flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-md text-[12px] font-medium hover:opacity-80 transition-opacity disabled:opacity-50";

    if (loading) return <div className="flex items-center justify-center h-96"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-5">
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? 'bg-foreground text-background' : 'text-white/40 hover:text-foreground hover:bg-[#0F0B2E]'}`}>
                        <t.icon className="w-3.5 h-3.5" strokeWidth={1.5} />{t.label}
                    </button>
                ))}
            </div>

            {/* General */}
            {activeTab === 'general' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-5">AI Ерөнхий тохиргоо</h3>
                    <div className="space-y-5">
                        <div className="flex items-center justify-between p-4 bg-[#0D0928] rounded-md border border-white/[0.04]">
                            <div><p className="text-[13px] font-medium text-foreground">AI Чатбот идэвхжүүлэх</p><p className="text-[11px] text-white/40">Автомат хариулт өгөх</p></div>
                            <button onClick={() => setAiEnabled(!aiEnabled)} className={toggleCls(aiEnabled)}><div className={toggleDot(aiEnabled)} /></button>
                        </div>
                        <div><label className={labelCls}>AI Зан төлөв</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[{ v: 'friendly', l: 'Найрсаг', e: '😊' }, { v: 'professional', l: 'Мэргэжлийн', e: '💼' }, { v: 'casual', l: 'Энгийн', e: '😎' }].map(e => (
                                    <button key={e.v} onClick={() => setEmotion(e.v)} className={`p-3 rounded-md border text-center transition-colors ${emotion === e.v ? 'border-[#4A7CE7] bg-[#4A7CE7]/5' : 'border-white/[0.08] hover:border-[#4A7CE7]/30'}`}>
                                        <span className="text-lg block mb-1">{e.e}</span><span className="text-[11px] text-foreground">{e.l}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div><label className={labelCls}>Угтах мессеж</label><textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="Сайн байна уу! Танд юугаар туслах вэ?" /></div>
                        <div className="flex justify-end"><button onClick={saveGeneral} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}Хадгалах</button></div>
                    </div>
                </div>
            )}

            {/* FAQ */}
            {activeTab === 'faq' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4">Түгээмэл асуулт хариулт</h3>
                    <div className="flex gap-2 mb-4">
                        <input value={newFaqQ} onChange={(e) => setNewFaqQ(e.target.value)} className={`${inputCls} flex-1`} placeholder="Асуулт" />
                        <input value={newFaqA} onChange={(e) => setNewFaqA(e.target.value)} className={`${inputCls} flex-1`} placeholder="Хариулт" />
                        <button onClick={() => { if (newFaqQ && newFaqA) { setFaqs([...faqs, { q: newFaqQ, a: newFaqA }]); setNewFaqQ(''); setNewFaqA(''); } }} disabled={!newFaqQ || !newFaqA} className="px-3 py-2 bg-foreground text-background rounded-md hover:opacity-80 disabled:opacity-30 transition-opacity"><Plus className="w-4 h-4" strokeWidth={1.5} /></button>
                    </div>
                    <div className="space-y-2">
                        {faqs.length === 0 ? <div className="text-center py-8 text-[13px] text-white/30">FAQ байхгүй</div>
                            : faqs.map((f, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-md border border-white/[0.04] group hover:border-white/[0.08] transition-colors">
                                    <div className="w-6 h-6 rounded bg-[#0F0B2E] flex items-center justify-center text-[10px] font-bold text-white/30 flex-shrink-0 mt-0.5">{i + 1}</div>
                                    <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground truncate">{f.q}</p><p className="text-[12px] text-white/40 truncate mt-0.5">{f.a}</p></div>
                                    <button onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} className="p-1 text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Quick Replies */}
            {activeTab === 'replies' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4">Хурдан хариултууд</h3>
                    <div className="flex gap-2 mb-4">
                        <input value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} className={`${inputCls} flex-1`} placeholder="Гаралт (trigger)" />
                        <input value={newResponse} onChange={(e) => setNewResponse(e.target.value)} className={`${inputCls} flex-1`} placeholder="Хариулт" />
                        <button onClick={() => { if (newTrigger && newResponse) { setReplies([...replies, { trigger: newTrigger, response: newResponse }]); setNewTrigger(''); setNewResponse(''); } }} disabled={!newTrigger || !newResponse} className="px-3 py-2 bg-foreground text-background rounded-md hover:opacity-80 disabled:opacity-30 transition-opacity"><Plus className="w-4 h-4" strokeWidth={1.5} /></button>
                    </div>
                    <div className="space-y-2">
                        {replies.length === 0 ? <div className="text-center py-8 text-[13px] text-white/30">Хурдан хариулт байхгүй</div>
                            : replies.map((r, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-md border border-white/[0.04] group hover:border-white/[0.08] transition-colors">
                                    <Zap className="w-4 h-4 text-[#4A7CE7] flex-shrink-0" strokeWidth={1.5} />
                                    <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground truncate">{r.trigger}</p><p className="text-[12px] text-white/40 truncate mt-0.5">{r.response}</p></div>
                                    <button onClick={() => setReplies(replies.filter((_, j) => j !== i))} className="p-1 text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Slogans */}
            {activeTab === 'slogans' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4">Слоган / Уриа</h3>
                    <div className="flex gap-2 mb-4">
                        <input value={newSlogan} onChange={(e) => setNewSlogan(e.target.value)} className={`${inputCls} flex-1`} placeholder="Шинэ слоган" />
                        <button onClick={() => { if (newSlogan) { setSlogans([...slogans, newSlogan]); setNewSlogan(''); } }} disabled={!newSlogan} className="px-3 py-2 bg-foreground text-background rounded-md hover:opacity-80 disabled:opacity-30 transition-opacity"><Plus className="w-4 h-4" strokeWidth={1.5} /></button>
                    </div>
                    <div className="space-y-2">
                        {slogans.length === 0 ? <div className="text-center py-8 text-[13px] text-white/30">Слоган байхгүй</div>
                            : slogans.map((s, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-md border border-white/[0.04] group hover:border-white/[0.08] transition-colors">
                                    <Hash className="w-4 h-4 text-white/20 flex-shrink-0" strokeWidth={1.5} />
                                    <p className="flex-1 text-[13px] text-foreground truncate">{s}</p>
                                    <button onClick={() => setSlogans(slogans.filter((_, j) => j !== i))} className="p-1 text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4">Мэдэгдлийн тохиргоо</h3>
                    <div className="space-y-3">
                        {[{ l: 'Шинэ захиалга', d: 'AI амжилттай захиалга бүртгэх үед', v: notifyOnOrder, s: setNotifyOnOrder }, { l: 'Холбогдох хүсэлт', d: 'Хэрэглэгч дугаараа үлдээх үед', v: notifyOnContact, s: setNotifyOnContact }, { l: 'Тусламж хүсэх', d: 'Хэрэглэгч оператортой холбогдох үед', v: notifyOnSupport, s: setNotifyOnSupport }].map(n => (
                            <div key={n.l} className="flex items-center justify-between p-4 bg-[#0D0928] rounded-md border border-white/[0.04]">
                                <div><p className="text-[13px] font-medium text-foreground">{n.l}</p><p className="text-[11px] text-white/40">{n.d}</p></div>
                                <button onClick={() => n.s(!n.v)} className={toggleCls(n.v)}><div className={toggleDot(n.v)} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end mt-4"><button onClick={saveGeneral} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}Хадгалах</button></div>
                </div>
            )}

            {/* Knowledge */}
            {activeTab === 'knowledge' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-1">Мэдлэгийн сан</h3>
                    <p className="text-[12px] text-white/40 mb-4">AI-д танай бизнесийн мэдээллийг зааж өгөх</p>
                    <div className="flex gap-2 mb-4">
                        <input value={newKKey} onChange={(e) => setNewKKey(e.target.value)} className={`${inputCls} flex-1`} placeholder="Түлхүүр (жишээ: Хаяг)" />
                        <input value={newKVal} onChange={(e) => setNewKVal(e.target.value)} className={`${inputCls} flex-[2]`} placeholder="Утга" />
                        <button onClick={() => { if (newKKey && newKVal) { setKnowledge([...knowledge, { key: newKKey, value: newKVal }]); setNewKKey(''); setNewKVal(''); } }} disabled={!newKKey || !newKVal} className="px-3 py-2 bg-foreground text-background rounded-md hover:opacity-80 disabled:opacity-30 transition-opacity"><Plus className="w-4 h-4" strokeWidth={1.5} /></button>
                    </div>
                    <div className="space-y-2">
                        {knowledge.length === 0 ? <div className="text-center py-8 text-[13px] text-white/30"><BookOpen className="w-8 h-8 mx-auto mb-2 text-white/10" strokeWidth={1.5} />Мэдээлэл байхгүй</div>
                            : knowledge.map((k, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-md border border-white/[0.04] group hover:border-white/[0.08] transition-colors">
                                    <div className="w-6 h-6 rounded bg-[#4A7CE7]/10 flex items-center justify-center text-[10px] font-bold text-[#4A7CE7] flex-shrink-0">{i + 1}</div>
                                    <div className="flex-1 grid grid-cols-3 gap-3 min-w-0"><p className="font-medium text-[13px] text-foreground col-span-1 truncate">{k.key}</p><p className="text-[12px] text-white/50 col-span-2 truncate">{k.value}</p></div>
                                    <button onClick={() => setKnowledge(knowledge.filter((_, j) => j !== i))} className="p-1 text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
                                </div>
                            ))}
                    </div>
                    <div className="flex justify-end mt-4 pt-4 border-t border-white/[0.04]"><button onClick={saveKnowledge} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}Хадгалах</button></div>
                </div>
            )}

            {/* Policies */}
            {activeTab === 'policies' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4">Дэлгүүрийн бодлого</h3>
                    <div className="space-y-4">
                        <div><label className={labelCls}>Үнэгүй хүргэлтийн босго (₮)</label><input type="number" value={policies.shipping_threshold} onChange={(e) => setPolicies({ ...policies, shipping_threshold: Number(e.target.value) })} className={inputCls} placeholder="50000" /><p className="text-[11px] text-white/30 mt-1">Энэ дүнгээс дээш захиалгад хүргэлт үнэгүй</p></div>
                        <div><label className={labelCls}>Төлбөрийн аргууд</label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {['QPay', 'SocialPay', 'Бэлэн мөнгө', 'Дансаар', 'StorePay', 'Pocket'].map(m => (
                                    <button key={m} onClick={() => { const c = policies.payment_methods || []; setPolicies({ ...policies, payment_methods: c.includes(m) ? c.filter(x => x !== m) : [...c, m] }); }}
                                        className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${policies.payment_methods?.includes(m) ? 'border-[#4A7CE7] bg-[#4A7CE7]/10 text-[#4A7CE7]' : 'border-white/[0.08] text-white/40 hover:border-[#4A7CE7]/30'}`}>
                                        {m}{policies.payment_methods?.includes(m) && <Check className="w-3 h-3 ml-1 inline" strokeWidth={1.5} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div><label className={labelCls}>Хүргэлтийн бүс</label><input value={policies.delivery_areas?.join(', ')} onChange={(e) => setPolicies({ ...policies, delivery_areas: e.target.value.split(',').map(s => s.trim()) })} className={inputCls} placeholder="Улаанбаатар, Дархан" /></div>
                        <div><label className={labelCls}>Буцаалтын бодлого</label><textarea value={policies.return_policy} onChange={(e) => setPolicies({ ...policies, return_policy: e.target.value })} className={`${inputCls} resize-none`} rows={2} placeholder="7 хоногийн дотор буцаах боломжтой" /></div>
                    </div>
                    <div className="flex justify-end mt-4"><button onClick={savePolicies} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}Хадгалах</button></div>
                </div>
            )}

            {/* Stats */}
            {activeTab === 'stats' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[{ l: 'Нийт харилцаа', v: stats.total_conversations, i: MessageSquare }, { l: 'Нийт мессеж', v: stats.total_messages, i: Zap }, { l: 'Дундаж хариулт', v: `${stats.avg_response_time}с`, i: Bot }, { l: 'Сэтгэл ханамж', v: `${stats.satisfaction_rate}%`, i: Smile }].map(s => (
                        <div key={s.l} className={cardCls + ' text-center'}>
                            <s.i className="w-5 h-5 text-white/20 mx-auto mb-2" strokeWidth={1.5} />
                            <p className="text-[22px] font-bold text-foreground tabular-nums">{s.v}</p>
                            <p className="text-[11px] text-white/40 mt-1">{s.l}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
