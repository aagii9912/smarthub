'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bot, Save, Plus, Trash2, Edit2, X, MessageSquare, Bell, BookOpen, Shield, BarChart3, Settings, Zap, Smile, Globe, Check, Loader2, ChevronRight, Hash, Cpu, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { EMOTIONS } from '@/lib/constants/ai-setup';
import { logger } from '@/lib/utils/logger';

const TABS = [
    { id: 'persona', label: 'AI Persona', icon: Settings },
    { id: 'knowledge', label: 'Мэдлэг', icon: BookOpen },
    { id: 'automation', label: 'Автоматжуулалт', icon: Zap },
    { id: 'notifications', label: 'Мэдэгдэл', icon: Bell },
];

const MODELS = [
    { id: 'flash-lite', name: 'Gemini Flash Lite', icon: Zap, req: 'lite', desc: 'Хурдан, энгийн хариулт' },
    { id: 'flash', name: 'Gemini Flash', icon: Cpu, req: 'standard', desc: 'Хэвийн харилцан яриа' },
    { id: 'pro', name: 'Gemini Pro', icon: Sparkles, req: 'pro', desc: 'Ухаалаг, борлуулалт сайтай' }
];

const LANGUAGES = [
    { id: 'mn', name: 'Монгол' },
    { id: 'en', name: 'English' },
    { id: 'ru', name: 'Русский' }
];

export default function AISettingsPage() {
    const [activeTab, setActiveTab] = useState('persona');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // General
    const [aiEnabled, setAiEnabled] = useState(true);
    const [emotion, setEmotion] = useState('friendly');
    const [description, setDescription] = useState('');
    const [aiInstructions, setAiInstructions] = useState('');
    const [aiModel, setAiModel] = useState('flash-lite');
    const [aiLanguage, setAiLanguage] = useState('mn');
    const [shopPlan, setShopPlan] = useState('lite');
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
                setAiEnabled(s.is_ai_active !== false);
                setEmotion(s.ai_emotion || 'friendly');
                setDescription(s.description || '');
                setAiInstructions(s.ai_instructions || '');
                setAiModel(s.ai_model || 'flash-lite');
                setAiLanguage(s.ai_language || 'mn');
                setShopPlan(s.subscription_plan || 'lite');

                setNotifyOnOrder(s.notify_on_order !== false);
                setNotifyOnContact(s.notify_on_contact !== false);
                setNotifyOnSupport(s.notify_on_support !== false);
                if (s.custom_knowledge) setKnowledge(Object.entries(s.custom_knowledge).map(([key, value]) => ({ key, value: value as string })));
                if (s.policies) setPolicies({ ...policies, ...s.policies });
            }
            if (faqRes?.ok) { const d = await faqRes.json(); setFaqs(d.faqs || []); }
            if (repRes?.ok) { const d = await repRes.json(); setReplies(d.replies || []); }
            if (sloRes?.ok) { const d = await sloRes.json(); setSlogans(d.slogans || []); }
        } catch (e) { logger.error('Алдаа гарлаа', { error: e }); } finally { setLoading(false); }
    }

    async function saveGeneral() {
        setSaving(true);
        try {
            await fetch('/api/shop', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ 
                    is_ai_active: aiEnabled, ai_emotion: emotion, description, 
                    ai_instructions: aiInstructions, ai_model: aiModel, ai_language: aiLanguage,
                    notify_on_order: notifyOnOrder, notify_on_contact: notifyOnContact, notify_on_support: notifyOnSupport 
                })
            });
            toast.success('Ерөнхий тохиргоо хадгалагдлаа');
        } catch { toast.error('Алдаа гарлаа'); } finally { setSaving(false); }
    }

    async function saveKnowledge() {
        setSaving(true);
        try {
            const obj = knowledge.reduce((a, i) => { if (i.key && i.value) a[i.key] = i.value; return a; }, {} as Record<string, string>);
            await fetch('/api/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId }, body: JSON.stringify({ custom_knowledge: obj }) });
            toast.success('Мэдлэгийн сан хадгалагдлаа');
        } catch { toast.error('Алдаа гарлаа'); } finally { setSaving(false); }
    }

    async function savePolicies() {
        setSaving(true);
        try {
            await fetch('/api/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId }, body: JSON.stringify({ policies }) });
            toast.success('Бодлого хадгалагдлаа');
        } catch { toast.error('Алдаа гарлаа'); } finally { setSaving(false); }
    }

    const inputCls = "w-full px-3 py-2 border border-white/[0.08] rounded-md text-[13px] text-foreground bg-transparent focus:outline-none focus:border-white/[0.2] transition-colors";
    const labelCls = "block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-1.5";
    const cardCls = "bg-[#0F0B2E] rounded-lg border border-white/[0.08] p-6 shadow-sm";
    const toggleCls = (on: boolean) => `relative w-11 h-6 rounded-full transition-colors cursor-pointer ${on ? 'bg-[#4A7CE7]' : 'bg-[#1C1650]'}`;
    const toggleDot = (on: boolean) => `absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${on ? 'left-6' : 'left-1'}`;
    const saveBtnCls = "flex items-center gap-1.5 px-4 py-2 bg-[#4A7CE7] text-white rounded-md text-[12px] font-medium hover:bg-[#3A6BD4] transition-colors disabled:opacity-50 focus:ring-2 focus:ring-[#4A7CE7] focus:ring-offset-2 focus:ring-offset-[#0A0220]";

    if (loading) return <div className="flex items-center justify-center h-96"><div className="w-5 h-5 border-2 border-[#4A7CE7] border-t-white/40 rounded-full animate-spin" /></div>;

    const isModelAllowed = (req: string) => {
        if (shopPlan === 'pro' || shopPlan === 'premium') return true;
        if (shopPlan === 'standard' && (req === 'lite' || req === 'standard')) return true;
        if (shopPlan === 'lite' && req === 'lite') return true;
        return false; // Free/others can only use lite if they get AI access
    };

    return (
        <div className="space-y-5">
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-[#4A7CE7]/10 text-[#4A7CE7]' : 'text-white/40 hover:text-white hover:bg-[#0F0B2E]'}`}>
                        <t.icon className="w-3.5 h-3.5" strokeWidth={1.5} />{t.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB: AI Persona (General + Emotion + Language + Model) ═══ */}
            {activeTab === 'persona' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-5">AI Persona тохиргоо</h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-[#0D0928] rounded-xl border border-white/[0.04]">
                            <div><p className="text-[13px] font-medium text-foreground">AI Чатбот идэвхжүүлэх</p><p className="text-[11px] text-white/40 mt-0.5">Чатны автомат хариултыг асаах эсвэл унтраах</p></div>
                            <button onClick={() => setAiEnabled(!aiEnabled)} className={toggleCls(aiEnabled)}><div className={toggleDot(aiEnabled)} /></button>
                        </div>
                        
                        {/* Language Selection */}
                        <div>
                            <label className={labelCls}>Харилцах хэл</label>
                            <div className="flex flex-wrap gap-2">
                                {LANGUAGES.map(l => (
                                    <button key={l.id} onClick={() => setAiLanguage(l.id)} 
                                    className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all flex items-center gap-2 border ${aiLanguage === l.id ? 'bg-[#4A7CE7]/10 border-[#4A7CE7]/50 text-[#4A7CE7]' : 'bg-transparent border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white'}`}>
                                        <Globe className="w-3.5 h-3.5" strokeWidth={1.5} /> {l.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Model Selection */}
                        <div>
                            <label className={labelCls}>AI Model Сонгох</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {MODELS.map(m => {
                                    const allowed = isModelAllowed(m.req);
                                    return (
                                        <button key={m.id} 
                                            onClick={() => { if (allowed) setAiModel(m.id); else toast.info('Энэ моделийг ашиглахын тулд План-аа ахиулна уу'); }} 
                                            className={`relative p-4 rounded-xl border text-left transition-all ${aiModel === m.id ? 'border-[#4A7CE7] bg-[#4A7CE7]/5 ring-1 ring-[#4A7CE7]/30' : allowed ? 'border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.02]' : 'border-white/[0.04] opacity-50 cursor-not-allowed bg-[#0D0928]'}`}>
                                            {!allowed && <span className="absolute top-2 right-2 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Upgrade</span>}
                                            <m.icon className={`w-5 h-5 mb-2 ${aiModel === m.id ? 'text-[#4A7CE7]' : 'text-white/40'}`} strokeWidth={1.5} />
                                            <p className="text-[13px] font-medium text-foreground">{m.name}</p>
                                            <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{m.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div><label className={labelCls}>AI Зан төлөв</label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {EMOTIONS.map(e => (
                                    <button key={e.value} onClick={() => setEmotion(e.value)} className={`p-4 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${emotion === e.value ? 'border-[#4A7CE7] bg-[#4A7CE7]/5 shadow-sm' : 'border-white/[0.08] hover:border-[#4A7CE7]/30 hover:bg-white/[0.02]'}`}>
                                        <e.icon className={`w-6 h-6 mb-2 ${emotion === e.value ? 'text-[#4A7CE7]' : 'text-white/40'}`} strokeWidth={1.5} />
                                        <span className="text-[11px] font-medium text-foreground text-center leading-tight">{e.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div><label className={labelCls}>Дэлгүүрийн тайлбар (Context)</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none min-h-[80px] bg-[#0D0928]`} placeholder="Бид ямар үйл ажиллагаа явуулдаг вэ? Онцлог нь юу вэ?" /></div>
                        <div><label className={labelCls}>Нарийвчилсан заавар (System Prompt)</label><textarea value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} className={`${inputCls} resize-none min-h-[120px] font-mono text-[12px] bg-[#0D0928]/50`} placeholder="Зөвхөн тусгай шаардлага байгаа үед л бичнэ үү (Optional)" /></div>
                        
                        <div className="flex justify-end pt-4 border-t border-white/[0.04]"><button onClick={saveGeneral} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={2} />} Тохиргоог хадгалах</button></div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Knowledge (FAQ + Knowledge Base + Policies) ═══ */}
            {activeTab === 'knowledge' && (
                <div className="space-y-5">
                    {/* FAQ Section */}
                    <div className={cardCls}>
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-white/30" strokeWidth={1.5} />Түгээмэл асуулт хариулт (FAQ)</h3>
                        <div className="flex gap-2 mb-4">
                            <input value={newFaqQ} onChange={(e) => setNewFaqQ(e.target.value)} className={`${inputCls} flex-1`} placeholder="Асуулт" />
                            <input value={newFaqA} onChange={(e) => setNewFaqA(e.target.value)} className={`${inputCls} flex-1`} placeholder="Хариулт" />
                            <button onClick={() => { if (newFaqQ && newFaqA) { setFaqs([...faqs, { q: newFaqQ, a: newFaqA }]); setNewFaqQ(''); setNewFaqA(''); } }} disabled={!newFaqQ || !newFaqA} className="px-3 py-2 bg-white/10 text-white rounded-md hover:bg-[#4A7CE7] disabled:opacity-30 transition-all"><Plus className="w-4 h-4" strokeWidth={2} /></button>
                        </div>
                        <div className="space-y-2">
                            {faqs.length === 0 ? <div className="text-center py-6 text-[13px] text-white/30">FAQ байхгүй байна</div>
                                : faqs.map((f, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.04] group hover:border-white/[0.08] hover:bg-white/[0.01] transition-all">
                                        <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[11px] font-bold text-white/40 flex-shrink-0 mt-0.5">{i + 1}</div>
                                        <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground truncate">{f.q}</p><p className="text-[12px] text-white/40 mt-1 line-clamp-2">{f.a}</p></div>
                                        <button onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} className="p-1.5 rounded-md text-white/20 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Knowledge Base Section */}
                    <div className={cardCls}>
                        <div className="mb-5">
                            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-1 flex items-center gap-2"><BookOpen className="w-4 h-4 text-white/30" strokeWidth={1.5} />Мэдлэгийн сан</h3>
                            <p className="text-[12px] text-white/40">AI-д танай бизнесийн түлхүүр мэдээллийг контекст байдлаар зааж өгөн ухаажуулах</p>
                        </div>
                        <div className="flex gap-2 mb-5">
                            <input value={newKKey} onChange={(e) => setNewKKey(e.target.value)} className={`${inputCls} flex-1`} placeholder="Түлхүүр (жишээ: Хаяг)" />
                            <input value={newKVal} onChange={(e) => setNewKVal(e.target.value)} className={`${inputCls} flex-[2]`} placeholder="Нарийвчилсан утга" />
                            <button onClick={() => { if (newKKey && newKVal) { setKnowledge([...knowledge, { key: newKKey, value: newKVal }]); setNewKKey(''); setNewKVal(''); } }} disabled={!newKKey || !newKVal} className="px-3 py-2 bg-white/10 text-white rounded-md hover:bg-[#4A7CE7] disabled:opacity-30 transition-all"><Plus className="w-4 h-4" strokeWidth={2} /></button>
                        </div>
                        <div className="space-y-2">
                            {knowledge.length === 0 ? <div className="text-center py-10 text-[13px] text-white/30"><BookOpen className="w-8 h-8 mx-auto mb-3 text-white/10" strokeWidth={1.5} />Мэдээлэл байхгүй байна</div>
                                : knowledge.map((k, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.04] bg-[#0D0928] group hover:border-[#4A7CE7]/30 transition-all">
                                        <div className="w-7 h-7 rounded-lg bg-[#4A7CE7]/10 flex items-center justify-center text-[11px] font-bold text-[#4A7CE7] flex-shrink-0">{i + 1}</div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0"><p className="font-semibold text-[13px] text-white col-span-1 truncate tracking-[-0.01em]">{k.key}</p><p className="text-[12px] text-white/60 col-span-1 md:col-span-2 truncate">{k.value}</p></div>
                                        <button onClick={() => setKnowledge(knowledge.filter((_, j) => j !== i))} className="p-1.5 rounded-md text-white/20 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                                    </div>
                                ))}
                        </div>
                        <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.04]"><button onClick={saveKnowledge} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={2} />}Хадгалах</button></div>
                    </div>

                    {/* Policies Section */}
                    <div className={cardCls}>
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-5 flex items-center gap-2"><Shield className="w-4 h-4 text-white/30" strokeWidth={1.5} />Дэлгүүрийн бодлого</h3>
                        <div className="space-y-5 bg-[#0D0928]/50 p-5 rounded-xl border border-white/[0.04]">
                            <div><label className={labelCls}>Үнэгүй хүргэлтийн босго (₮)</label><input type="number" value={policies.shipping_threshold} onChange={(e) => setPolicies({ ...policies, shipping_threshold: Number(e.target.value) })} className={inputCls} placeholder="50000" /><p className="text-[11px] text-[#4A7CE7] mt-1.5">Энэ дүнгээс дээш захиалгад хүргэлт үнэгүй</p></div>
                            <div><label className={labelCls}>Төлбөрийн аргууд</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {['QPay', 'SocialPay', 'Бэлэн мөнгө', 'Дансаар', 'StorePay', 'Pocket', 'Khaan'].map(m => (
                                        <button key={m} onClick={() => { const c = policies.payment_methods || []; setPolicies({ ...policies, payment_methods: c.includes(m) ? c.filter(x => x !== m) : [...c, m] }); }}
                                            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${policies.payment_methods?.includes(m) ? 'border-[#4A7CE7] bg-[#4A7CE7]/10 text-[#4A7CE7] ring-1 ring-[#4A7CE7]/30' : 'border-white/[0.08] bg-transparent text-white/40 hover:border-white/[0.2] hover:text-white'}`}>
                                            {m}{policies.payment_methods?.includes(m) && <Check className="w-3.5 h-3.5 ml-1.5 inline" strokeWidth={2} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div><label className={labelCls}>Хүргэлтийн бүс</label><input value={policies.delivery_areas?.join(', ')} onChange={(e) => setPolicies({ ...policies, delivery_areas: e.target.value.split(',').map(s => s.trim()) })} className={inputCls} placeholder="Улаанбаатар, Дархан" /></div>
                            <div><label className={labelCls}>Буцаалтын нөхцөл</label><textarea value={policies.return_policy} onChange={(e) => setPolicies({ ...policies, return_policy: e.target.value })} className={`${inputCls} resize-none min-h-[60px]`} placeholder="Жишээ: 7 хоногийн дотор сав баглаа боодолтойгоо буцаах боломжтой" /></div>
                        </div>
                        <div className="flex justify-end mt-5"><button onClick={savePolicies} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={2} />} Бодлого хадгалах</button></div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Automation (Quick Replies + Slogans) ═══ */}
            {activeTab === 'automation' && (
                <div className="space-y-5">
                    {/* Quick Replies */}
                    <div className={cardCls}>
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-white/30" strokeWidth={1.5} />Хурдан хариултууд</h3>
                        <div className="flex gap-2 mb-4">
                            <input value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} className={`${inputCls} flex-1`} placeholder="Гаралт (trigger үг)" />
                            <input value={newResponse} onChange={(e) => setNewResponse(e.target.value)} className={`${inputCls} flex-1`} placeholder="Урьдчилан бэлтгэсэн хариулт" />
                            <button onClick={() => { if (newTrigger && newResponse) { setReplies([...replies, { trigger: newTrigger, response: newResponse }]); setNewTrigger(''); setNewResponse(''); } }} disabled={!newTrigger || !newResponse} className="px-3 py-2 bg-white/10 text-white rounded-md hover:bg-[#4A7CE7] disabled:opacity-30 transition-all"><Plus className="w-4 h-4" strokeWidth={2} /></button>
                        </div>
                        <div className="space-y-2">
                            {replies.length === 0 ? <div className="text-center py-8 text-[13px] text-white/30">Хурдан хариулт байхгүй байна</div>
                                : replies.map((r, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.04] group hover:border-white/[0.08] hover:bg-white/[0.01] transition-all">
                                        <Zap className="w-5 h-5 text-[#4A7CE7] flex-shrink-0" strokeWidth={1.5} />
                                        <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-foreground truncate">{r.trigger}</p><p className="text-[12px] text-white/40 truncate mt-0.5">{r.response}</p></div>
                                        <button onClick={() => setReplies(replies.filter((_, j) => j !== i))} className="p-1.5 rounded-md text-white/20 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Slogans */}
                    <div className={cardCls}>
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4 flex items-center gap-2"><Hash className="w-4 h-4 text-white/30" strokeWidth={1.5} />Слоган / Уриа</h3>
                        <div className="flex gap-2 mb-4">
                            <input value={newSlogan} onChange={(e) => setNewSlogan(e.target.value)} className={`${inputCls} flex-1`} placeholder="Борлуулалтын шинэ слоган" />
                            <button onClick={() => { if (newSlogan) { setSlogans([...slogans, newSlogan]); setNewSlogan(''); } }} disabled={!newSlogan} className="px-3 py-2 bg-white/10 text-white rounded-md hover:bg-[#4A7CE7] disabled:opacity-30 transition-all"><Plus className="w-4 h-4" strokeWidth={2} /></button>
                        </div>
                        <div className="space-y-2">
                            {slogans.length === 0 ? <div className="text-center py-6 text-[13px] text-white/30">Слоган байхгүй байна</div>
                                : slogans.map((s, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.04] group hover:border-white/[0.08] hover:bg-white/[0.01] transition-all">
                                        <Hash className="w-4 h-4 text-white/30 flex-shrink-0" strokeWidth={1.5} />
                                        <p className="flex-1 text-[13px] text-foreground font-medium truncate">{s}</p>
                                        <button onClick={() => setSlogans(slogans.filter((_, j) => j !== i))} className="p-1.5 rounded-md text-white/20 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Notifications ═══ */}
            {activeTab === 'notifications' && (
                <div className={cardCls}>
                    <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-5">Мэдэгдлийн тохиргоо</h3>
                    <div className="space-y-3">
                        {[{ l: 'Шинэ захиалга бүртгэгдэхэд', d: 'AI амжилттай захиалга бүртгэх үед утсанд дуугарах', v: notifyOnOrder, s: setNotifyOnOrder }, { l: 'Холбогдох дугаар үлдээхэд', d: 'Хэрэглэгч утсаа үлдээх үед түлхүү мэдэгдэх', v: notifyOnContact, s: setNotifyOnContact }, { l: 'Тусламж хүсэхэд (Оператор руу шилжих)', d: 'Хэрэглэгч амьд хүнтэй холбогдохыг шаардах үед', v: notifyOnSupport, s: setNotifyOnSupport }].map(n => (
                            <div key={n.l} className="flex items-center justify-between p-4 bg-[#0D0928] rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                                <div><p className="text-[13px] font-medium text-foreground">{n.l}</p><p className="text-[11px] text-white/40 mt-0.5">{n.d}</p></div>
                                <button onClick={() => n.s(!n.v)} className={toggleCls(n.v)}><div className={toggleDot(n.v)} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.04]"><button onClick={saveGeneral} disabled={saving} className={saveBtnCls}>{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={2} />} Тохиргоог хадгалах</button></div>
                </div>
            )}
        </div>
    );
}
