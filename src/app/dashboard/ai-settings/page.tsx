'use client';
import { useState, useEffect } from 'react';
import {
    Save,
    Plus,
    Trash2,
    MessageSquare,
    Bell,
    BookOpen,
    Shield,
    Settings,
    Zap,
    Globe,
    Check,
    Loader2,
    Hash,
    Cpu,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { EMOTIONS } from '@/lib/constants/ai-setup';
import { logger } from '@/lib/utils/logger';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { cn } from '@/lib/utils';
import { AgentWizard } from './components/AgentWizard';
import { AgentOverview } from './components/AgentOverview';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { BusinessType } from '@/lib/constants/business-types';

const TABS = [
    { id: 'persona', label: 'AI Persona', icon: Settings },
    { id: 'knowledge', label: 'Мэдлэг', icon: BookOpen },
    { id: 'automation', label: 'Автоматжуулалт', icon: Zap },
    { id: 'notifications', label: 'Мэдэгдэл', icon: Bell },
] as const;

const MODELS = [
    { id: 'flash-lite', name: 'Хурдан туслах', icon: Zap, req: 'lite', desc: 'Хурдан, энгийн хариулт' },
    { id: 'flash', name: 'Нийтлэг хэрэглээний AI', icon: Cpu, req: 'standard', desc: 'Хэвийн харилцан яриа' },
    { id: 'pro', name: 'Борлуулалтын ур чадвар', icon: Sparkles, req: 'pro', desc: 'Ухаалаг, борлуулалт сайтай' },
];

const LANGUAGES = [
    { id: 'mn', name: 'Монгол' },
    { id: 'en', name: 'English' },
    { id: 'ru', name: 'Русский' },
];

const PAYMENT_METHODS = [
    'QPay',
    'SocialPay',
    'Бэлэн мөнгө',
    'Дансаар',
    'StorePay',
    'Pocket',
    'Khaan',
];

const labelCls = 'block text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] mb-1.5';
const inputCls =
    'w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--border-accent)] focus:bg-white/[0.04] transition-colors placeholder:text-white/30';

function ToggleRow({
    title,
    description,
    value,
    onChange,
}: {
    title: string;
    description?: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.06] hover:border-white/[0.08] transition-colors">
            <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground tracking-[-0.01em]">{title}</p>
                {description && (
                    <p className="text-[11.5px] text-white/45 mt-0.5 tracking-[-0.01em]">{description}</p>
                )}
            </div>
            <button
                onClick={() => onChange(!value)}
                className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    value ? 'bg-[var(--brand-indigo)]' : 'bg-white/[0.1]'
                )}
                aria-label={title}
            >
                <div
                    className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                        value ? 'left-[22px]' : 'left-0.5'
                    )}
                />
            </button>
        </div>
    );
}

interface AdvancedSettingsProps {
    initialTab?: 'persona' | 'knowledge' | 'automation' | 'notifications';
    onBack?: () => void;
}

function AdvancedSettings({ initialTab, onBack }: AdvancedSettingsProps = {}) {
    const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>(initialTab ?? 'persona');
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
    const [notifyOnCancel, setNotifyOnCancel] = useState(true);
    const [notifyOnComplaints, setNotifyOnComplaints] = useState(true);
    const [notifyOnPaymentReceived, setNotifyOnPaymentReceived] = useState(true);
    const [notifyOnPaymentFailed, setNotifyOnPaymentFailed] = useState(true);
    const [notifyOnRefund, setNotifyOnRefund] = useState(true);
    const [notifyOnNewCustomer, setNotifyOnNewCustomer] = useState(true);
    const [notifyOnSubscription, setNotifyOnSubscription] = useState(true);
    const [notifyOnAutomation, setNotifyOnAutomation] = useState(true);
    const [notifyOnPlanLimit, setNotifyOnPlanLimit] = useState(true);
    const [notifyOnLowStock, setNotifyOnLowStock] = useState(true);
    const [notifyOnImport, setNotifyOnImport] = useState(true);
    // Push diagnostic
    const [testingPush, setTestingPush] = useState(false);
    const [pushTestResult, setPushTestResult] = useState<unknown>(null);
    // FAQ
    const [faqs, setFaqs] = useState<{ id: string; q: string; a: string }[]>([]);
    const [newFaqQ, setNewFaqQ] = useState('');
    const [newFaqA, setNewFaqA] = useState('');
    // Quick Replies
    const [replies, setReplies] = useState<{ id: string; trigger: string; response: string }[]>([]);
    const [newTrigger, setNewTrigger] = useState('');
    const [newResponse, setNewResponse] = useState('');
    // Slogans
    const [slogans, setSlogans] = useState<{ id: string; text: string }[]>([]);
    const [newSlogan, setNewSlogan] = useState('');
    // Knowledge
    const [knowledge, setKnowledge] = useState<{ key: string; value: string }[]>([]);
    const [newKKey, setNewKKey] = useState('');
    const [newKVal, setNewKVal] = useState('');
    // Policies
    const [policies, setPolicies] = useState({
        shipping_threshold: 0,
        return_policy: '',
        payment_methods: [] as string[],
        delivery_areas: [] as string[],
    });
    // Contact info + AI sharing toggles (#5b/#5c)
    const [shopAddress, setShopAddress] = useState('');
    const [shopBusinessHours, setShopBusinessHours] = useState('');
    const [aiSharePhone, setAiSharePhone] = useState(false);
    const [aiShareAddress, setAiShareAddress] = useState(false);
    const [aiShareHours, setAiShareHours] = useState(false);
    const [aiSharePolicies, setAiSharePolicies] = useState(true);
    const [aiShareDescription, setAiShareDescription] = useState(true);
    const [savingShare, setSavingShare] = useState(false);
    // Read-only: the shop's phone number (edited on settings page) so the
    // toggle can show whether we have anything to share.
    const [shopPhone, setShopPhone] = useState('');
    // AI Instruction Generator
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiPreview, setAiPreview] = useState('');
    const [shopName, setShopName] = useState('');

    const shopId =
        typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchAll() {
        try {
            setLoading(true);
            const [shopRes, aiRes] = await Promise.all([
                fetch('/api/shop', { headers: { 'x-shop-id': shopId } }),
                fetch('/api/ai-settings', { headers: { 'x-shop-id': shopId } }).catch(() => null),
            ]);
            const shopData = await shopRes.json();
            if (shopData.shop) {
                const s = shopData.shop;
                setAiEnabled(s.is_ai_active !== false);
                setEmotion(s.ai_emotion || 'friendly');
                setDescription(s.description || '');
                setAiInstructions(s.ai_instructions || '');
                setShopName(s.name || '');
                setAiModel(s.ai_model || 'flash-lite');
                setAiLanguage(s.ai_language || 'mn');
                setShopPlan(s.subscription_plan || 'lite');

                setNotifyOnOrder(s.notify_on_order !== false);
                setNotifyOnContact(s.notify_on_contact !== false);
                setNotifyOnSupport(s.notify_on_support !== false);
                setNotifyOnCancel(s.notify_on_cancel !== false);
                setNotifyOnComplaints(s.notify_on_complaints !== false);
                setNotifyOnPaymentReceived(s.notify_on_payment_received !== false);
                setNotifyOnPaymentFailed(s.notify_on_payment_failed !== false);
                setNotifyOnRefund(s.notify_on_refund !== false);
                setNotifyOnNewCustomer(s.notify_on_new_customer !== false);
                setNotifyOnSubscription(s.notify_on_subscription !== false);
                setNotifyOnAutomation(s.notify_on_automation !== false);
                setNotifyOnPlanLimit(s.notify_on_plan_limit !== false);
                setNotifyOnLowStock(s.notify_on_low_stock !== false);
                setNotifyOnImport(s.notify_on_import !== false);
                if (s.custom_knowledge)
                    setKnowledge(
                        Object.entries(s.custom_knowledge).map(([key, value]) => ({
                            key,
                            value: value as string,
                        }))
                    );
                if (s.policies) setPolicies((p) => ({ ...p, ...s.policies }));
                // Contact info + AI sharing (#5b/#5c)
                setShopPhone(s.phone || '');
                setShopAddress(s.address || '');
                setShopBusinessHours(s.business_hours || '');
                setAiSharePhone(!!s.ai_share_phone);
                setAiShareAddress(!!s.ai_share_address);
                setAiShareHours(!!s.ai_share_hours);
                // description + policies sharing default ON for backwards compat.
                setAiSharePolicies(s.ai_share_policies !== false);
                setAiShareDescription(s.ai_share_description !== false);
            }
            if (aiRes?.ok) {
                const d = await aiRes.json();
                setFaqs(
                    (d.faqs || []).map((f: { id: string; question: string; answer: string }) => ({
                        id: f.id,
                        q: f.question,
                        a: f.answer,
                    }))
                );
                setReplies(
                    (d.quickReplies || []).map(
                        (r: { id: string; trigger_words: string[]; response: string }) => ({
                            id: r.id,
                            trigger: Array.isArray(r.trigger_words)
                                ? r.trigger_words.join(', ')
                                : String(r.trigger_words || ''),
                            response: r.response,
                        })
                    )
                );
                setSlogans(
                    (d.slogans || []).map((s: { id: string; slogan: string }) => ({
                        id: s.id,
                        text: s.slogan,
                    }))
                );
            }
        } catch (e) {
            logger.error('Алдаа гарлаа', { error: e });
        } finally {
            setLoading(false);
        }
    }

    // ───── FAQ CRUD ─────
    async function addFaq() {
        if (!newFaqQ.trim() || !newFaqA.trim()) return;
        try {
            const res = await fetch('/api/ai-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ type: 'faqs', question: newFaqQ, answer: newFaqA }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Алдаа гарлаа');
            setFaqs([
                ...faqs,
                { id: d.data.id, q: d.data.question, a: d.data.answer },
            ]);
            setNewFaqQ('');
            setNewFaqA('');
            toast.success('FAQ нэмэгдлээ');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
    }

    async function removeFaq(id: string) {
        try {
            const res = await fetch(`/api/ai-settings?type=faqs&id=${id}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': shopId },
            });
            if (!res.ok) throw new Error('Устгахад алдаа гарлаа');
            setFaqs(faqs.filter((f) => f.id !== id));
            toast.success('FAQ устгагдлаа');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
    }

    // ───── Quick Reply CRUD ─────
    async function addReply() {
        if (!newTrigger.trim() || !newResponse.trim()) return;
        try {
            const res = await fetch('/api/ai-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({
                    type: 'quick_replies',
                    name: newTrigger.slice(0, 40),
                    trigger_words: newTrigger,
                    response: newResponse,
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Алдаа гарлаа');
            setReplies([
                ...replies,
                {
                    id: d.data.id,
                    trigger: Array.isArray(d.data.trigger_words)
                        ? d.data.trigger_words.join(', ')
                        : String(d.data.trigger_words || ''),
                    response: d.data.response,
                },
            ]);
            setNewTrigger('');
            setNewResponse('');
            toast.success('Хурдан хариулт нэмэгдлээ');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
    }

    async function removeReply(id: string) {
        try {
            const res = await fetch(`/api/ai-settings?type=quick_replies&id=${id}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': shopId },
            });
            if (!res.ok) throw new Error('Устгахад алдаа гарлаа');
            setReplies(replies.filter((r) => r.id !== id));
            toast.success('Устгагдлаа');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
    }

    // ───── Slogan CRUD ─────
    async function addSlogan() {
        if (!newSlogan.trim()) return;
        try {
            const res = await fetch('/api/ai-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ type: 'slogans', slogan: newSlogan }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Алдаа гарлаа');
            setSlogans([...slogans, { id: d.data.id, text: d.data.slogan }]);
            setNewSlogan('');
            toast.success('Слоган нэмэгдлээ');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
    }

    async function removeSlogan(id: string) {
        try {
            const res = await fetch(`/api/ai-settings?type=slogans&id=${id}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': shopId },
            });
            if (!res.ok) throw new Error('Устгахад алдаа гарлаа');
            setSlogans(slogans.filter((s) => s.id !== id));
            toast.success('Устгагдлаа');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        }
    }

    async function saveGeneral() {
        setSaving(true);
        try {
            await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({
                    is_ai_active: aiEnabled,
                    ai_emotion: emotion,
                    description,
                    ai_instructions: aiInstructions,
                    notify_on_order: notifyOnOrder,
                    notify_on_contact: notifyOnContact,
                    notify_on_support: notifyOnSupport,
                    notify_on_cancel: notifyOnCancel,
                    notify_on_complaints: notifyOnComplaints,
                    notify_on_payment_received: notifyOnPaymentReceived,
                    notify_on_payment_failed: notifyOnPaymentFailed,
                    notify_on_refund: notifyOnRefund,
                    notify_on_new_customer: notifyOnNewCustomer,
                    notify_on_subscription: notifyOnSubscription,
                    notify_on_automation: notifyOnAutomation,
                    notify_on_plan_limit: notifyOnPlanLimit,
                    notify_on_low_stock: notifyOnLowStock,
                    notify_on_import: notifyOnImport,
                }),
            });
            toast.success('Ерөнхий тохиргоо хадгалагдлаа');
        } catch {
            toast.error('Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function handleTestPush() {
        setTestingPush(true);
        setPushTestResult(null);
        try {
            const res = await fetch('/api/push/test', {
                method: 'POST',
                headers: { 'x-shop-id': shopId },
            });
            const data = await res.json();
            setPushTestResult(data);
            if (data.succeeded > 0) {
                toast.success('Илгээгдлээ — утсан дээрх notification-оо шалгана уу');
            } else if (data.reason === 'no_subscriptions') {
                toast.warning('Энэ дэлгүүрт идэвхтэй subscription байхгүй. Header дэх Bell товчийг дарж идэвхжүүлнэ үү.');
            } else if (data.reason === 'vapid_not_configured') {
                toast.error('VAPID түлхүүр тохируулаагүй байна (server env)');
            } else if (data.failed > 0) {
                toast.error('Бүх subscription амжилтгүй боллоо. Дэлгэрэнгүйг доороос харна уу.');
            } else {
                toast.error('Тодорхойгүй алдаа');
            }
        } catch (err) {
            toast.error('Сүлжээний алдаа');
            setPushTestResult({ error: err instanceof Error ? err.message : String(err) });
        } finally {
            setTestingPush(false);
        }
    }

    async function saveKnowledge() {
        setSaving(true);
        try {
            const obj = knowledge.reduce(
                (a, i) => {
                    if (i.key && i.value) a[i.key] = i.value;
                    return a;
                },
                {} as Record<string, string>
            );
            await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ custom_knowledge: obj }),
            });
            toast.success('Мэдлэгийн сан хадгалагдлаа');
        } catch {
            toast.error('Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function savePolicies() {
        setSaving(true);
        try {
            await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ policies }),
            });
            toast.success('Бодлого хадгалагдлаа');
        } catch {
            toast.error('Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    /**
     * Persist contact info (address/business hours) + the per-field "AI may
     * share with customer" toggles. Single PATCH so flag and value land
     * atomically. (#5b/#5c)
     */
    async function saveSharingSettings() {
        setSavingShare(true);
        try {
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({
                    address: shopAddress,
                    business_hours: shopBusinessHours,
                    ai_share_phone: aiSharePhone,
                    ai_share_address: aiShareAddress,
                    ai_share_hours: aiShareHours,
                    ai_share_policies: aiSharePolicies,
                    ai_share_description: aiShareDescription,
                }),
            });
            if (!res.ok) {
                throw new Error(`PATCH /api/shop returned ${res.status}`);
            }
            toast.success('AI хуваалцах тохиргоо хадгалагдлаа');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
        } finally {
            setSavingShare(false);
        }
    }

    async function handleGenerateInstructions() {
        setAiGenerating(true);
        setAiPreview('');
        try {
            const res = await fetch('/api/dashboard/ai-generate-instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({
                    mode: 'generate',
                    shopName,
                    shopDescription: description,
                    emotion,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'AI error');
            setAiPreview(data.instructions);
            toast.success('AI заавар бэлэн боллоо! Шалгаад хэрэглэх дарна уу');
        } catch (err) {
            toast.error(`AI алдаа: ${err instanceof Error ? err.message : 'Тодорхойгүй'}`);
        } finally {
            setAiGenerating(false);
        }
    }

    async function handleImproveInstructions() {
        setAiGenerating(true);
        setAiPreview('');
        try {
            const res = await fetch('/api/dashboard/ai-generate-instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({
                    mode: 'improve',
                    currentInstructions: aiInstructions,
                    shopName,
                    shopDescription: description,
                    emotion,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'AI error');
            setAiPreview(data.instructions);
            toast.success('Сайжруулсан хувилбар бэлэн! Шалгаад хэрэглэх дарна уу');
        } catch (err) {
            toast.error(`AI алдаа: ${err instanceof Error ? err.message : 'Тодорхойгүй'}`);
        } finally {
            setAiGenerating(false);
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="h-96 card-outlined animate-pulse" />
            </div>
        );
    }

    const isModelAllowed = (req: string) => {
        if (shopPlan === 'pro' || shopPlan === 'premium') return true;
        if (shopPlan === 'standard' && (req === 'lite' || req === 'standard')) return true;
        if (shopPlan === 'lite' && req === 'lite') return true;
        return false;
    };

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="AI АГЕНТ"
                live
                title="AI Sales agent ажиллаж байна"
                subtitle="AI-ийн зан төлөв, мэдлэгийн сан, автоматжуулсан хариултыг тохируулаарай."
                actions={
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/70">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                        <span className="font-medium tracking-[-0.01em]">
                            {MODELS.find((m) => m.id === aiModel)?.name || 'AI Sales agent'}
                        </span>
                    </div>
                }
            />

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar bg-white/[0.03] border border-white/[0.06] rounded-full p-1 w-fit">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all tracking-[-0.01em]',
                            activeTab === tab.id
                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-foreground shadow-[inset_0_0_0_1px_var(--border-accent)]'
                                : 'text-white/50 hover:text-foreground'
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB: AI Persona ═══ */}
            {activeTab === 'persona' && (
                <div className="card-featured p-6 space-y-7">
                    <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                        AI Persona тохиргоо
                    </h3>

                    <ToggleRow
                        title="AI Чатбот идэвхжүүлэх"
                        description="Чатны автомат хариултыг асаах эсвэл унтраах"
                        value={aiEnabled}
                        onChange={setAiEnabled}
                    />

                    {/* Language */}
                    <div>
                        <label className={labelCls}>Харилцах хэл</label>
                        <div className="flex flex-wrap gap-2">
                            {LANGUAGES.map((l) => (
                                <button
                                    key={l.id}
                                    onClick={() => setAiLanguage(l.id)}
                                    className={cn(
                                        'px-4 py-2 rounded-xl text-[12px] font-medium transition-all flex items-center gap-2 border tracking-[-0.01em]',
                                        aiLanguage === l.id
                                            ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-foreground'
                                            : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.15] hover:text-white'
                                    )}
                                >
                                    <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    {l.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Models */}
                    <div>
                        <label className={labelCls}>AI Model сонгох</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {MODELS.map((m) => {
                                const allowed = isModelAllowed(m.req);
                                const selected = aiModel === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            if (allowed) setAiModel(m.id);
                                            else toast.info('Энэ моделийг ашиглахын тулд План-аа ахиулна уу');
                                        }}
                                        className={cn(
                                            'relative p-4 rounded-xl border text-left transition-all',
                                            selected
                                                ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] shadow-[inset_0_0_0_1px_var(--border-accent)]'
                                                : allowed
                                                  ? 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
                                                  : 'border-white/[0.04] bg-white/[0.015] opacity-60 cursor-not-allowed'
                                        )}
                                    >
                                        {!allowed && (
                                            <span
                                                className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-[0.08em]"
                                                style={{
                                                    background:
                                                        'color-mix(in oklab, var(--destructive) 20%, transparent)',
                                                    color: 'var(--destructive)',
                                                }}
                                            >
                                                Upgrade
                                            </span>
                                        )}
                                        <m.icon
                                            className={cn(
                                                'w-5 h-5 mb-2',
                                                selected
                                                    ? 'text-[var(--brand-indigo-400)]'
                                                    : 'text-white/45'
                                            )}
                                            strokeWidth={1.5}
                                        />
                                        <p className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">
                                            {m.name}
                                        </p>
                                        <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                                            {m.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Emotion */}
                    <div>
                        <label className={labelCls}>AI зан төлөв</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {EMOTIONS.map((e) => {
                                const selected = emotion === e.value;
                                return (
                                    <button
                                        key={e.value}
                                        onClick={() => setEmotion(e.value)}
                                        className={cn(
                                            'p-4 rounded-xl border text-center flex flex-col items-center justify-center transition-all',
                                            selected
                                                ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)]'
                                                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
                                        )}
                                    >
                                        <e.icon
                                            className={cn(
                                                'w-6 h-6 mb-2',
                                                selected
                                                    ? 'text-[var(--brand-indigo-400)]'
                                                    : 'text-white/45'
                                            )}
                                            strokeWidth={1.5}
                                        />
                                        <span className="text-[11px] font-medium text-foreground text-center leading-tight tracking-[-0.01em]">
                                            {e.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Дэлгүүрийн тайлбар (Context)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={cn(inputCls, 'resize-none min-h-[80px]')}
                            placeholder="Бид ямар үйл ажиллагаа явуулдаг вэ? Онцлог нь юу вэ?"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className={labelCls} style={{ marginBottom: 0 }}>Нарийвчилсан заавар (System Prompt)</label>
                            <div className="flex items-center gap-1.5">
                                {aiInstructions.trim() ? (
                                    <button
                                        onClick={handleImproveInstructions}
                                        disabled={aiGenerating}
                                        className={cn(
                                            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border',
                                            aiGenerating
                                                ? 'border-white/[0.06] bg-white/[0.02] text-white/30 cursor-not-allowed'
                                                : 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_12%,transparent)] text-[var(--brand-indigo-400)] hover:bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)]'
                                        )}
                                    >
                                        {aiGenerating ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3 h-3" strokeWidth={2} />
                                        )}
                                        Сайжруулах
                                    </button>
                                ) : null}
                                <button
                                    onClick={handleGenerateInstructions}
                                    disabled={aiGenerating}
                                    className={cn(
                                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border',
                                        aiGenerating
                                            ? 'border-white/[0.06] bg-white/[0.02] text-white/30 cursor-not-allowed'
                                            : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:border-white/[0.15] hover:text-white'
                                    )}
                                >
                                    {aiGenerating ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-3 h-3" strokeWidth={2} />
                                    )}
                                    AI-аар бичүүлэх
                                </button>
                            </div>
                        </div>

                        {/* AI Generated Preview */}
                        {aiPreview && (
                            <div className="mb-3 p-4 rounded-xl border border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_6%,transparent)] animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-semibold text-[var(--brand-indigo-400)] uppercase tracking-[0.08em] flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3" strokeWidth={2} />
                                        AI Үр дүн
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => {
                                                setAiInstructions(aiPreview);
                                                setAiPreview('');
                                                toast.success('Заавар хэрэглэгдлээ');
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--brand-indigo)] text-white hover:opacity-90 transition-opacity"
                                        >
                                            <Check className="w-3 h-3" strokeWidth={2} />
                                            Хэрэглэх
                                        </button>
                                        <button
                                            onClick={() => setAiPreview('')}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-white/[0.08] text-white/50 hover:text-white/80 transition-colors"
                                        >
                                            Болих
                                        </button>
                                    </div>
                                </div>
                                <pre className="text-[12px] text-white/70 whitespace-pre-wrap font-mono leading-relaxed max-h-[200px] overflow-y-auto">{aiPreview}</pre>
                            </div>
                        )}

                        <textarea
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            className={cn(inputCls, 'resize-none min-h-[120px] font-mono text-[12px]')}
                            placeholder="Зөвхөн тусгай шаардлага байгаа үед л бичнэ үү (Optional)"
                        />
                        <p className="text-[11px] text-white/30 mt-1.5">
                            AI-аар автоматаар бичүүлэх эсвэл одоогийн зааврыг сайжруулах боломжтой
                        </p>
                    </div>

                    <div className="flex justify-end pt-5 border-t border-white/[0.06]">
                        <Button
                            onClick={saveGeneral}
                            disabled={saving}
                            variant="primary"
                            size="md"
                            leftIcon={
                                saving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" strokeWidth={2} />
                                )
                            }
                        >
                            Тохиргоог хадгалах
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Knowledge ═══ */}
            {activeTab === 'knowledge' && (
                <div className="space-y-5">
                    {/* FAQ */}
                    <div className="card-outlined p-6">
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-4 flex items-center gap-2">
                            <MessageSquare
                                className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                strokeWidth={1.5}
                            />
                            Түгээмэл асуулт хариулт (FAQ)
                        </h3>
                        <div className="flex flex-col md:flex-row gap-2 mb-4">
                            <input
                                value={newFaqQ}
                                onChange={(e) => setNewFaqQ(e.target.value)}
                                className={cn(inputCls, 'flex-1')}
                                placeholder="Асуулт"
                            />
                            <input
                                value={newFaqA}
                                onChange={(e) => setNewFaqA(e.target.value)}
                                className={cn(inputCls, 'flex-1')}
                                placeholder="Хариулт"
                            />
                            <Button
                                variant="primary"
                                size="icon"
                                disabled={!newFaqQ || !newFaqA}
                                onClick={addFaq}
                                aria-label="Нэмэх"
                            >
                                <Plus className="w-4 h-4" strokeWidth={2} />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {faqs.length === 0 ? (
                                <div className="text-center py-6 text-[13px] text-white/35">
                                    FAQ байхгүй байна
                                </div>
                            ) : (
                                faqs.map((f, i) => (
                                    <div
                                        key={f.id}
                                        className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
                                    >
                                        <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center text-[11px] font-semibold text-white/60 flex-shrink-0 mt-0.5">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-foreground truncate tracking-[-0.01em]">
                                                {f.q}
                                            </p>
                                            <p className="text-[12px] text-white/55 mt-1 line-clamp-2">
                                                {f.a}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeFaq(f.id)}
                                            className="p-1.5 rounded-md text-white/30 hover:text-[var(--destructive)] hover:bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                            aria-label="Устгах"
                                        >
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Knowledge Base */}
                    <div className="card-outlined p-6">
                        <div className="mb-5">
                            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-1 flex items-center gap-2">
                                <BookOpen
                                    className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                    strokeWidth={1.5}
                                />
                                Мэдлэгийн сан
                            </h3>
                            <p className="text-[12px] text-white/45">
                                AI-д танай бизнесийн түлхүүр мэдээллийг контекстоор зааж өгч ухаажуулна
                            </p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2 mb-5">
                            <input
                                value={newKKey}
                                onChange={(e) => setNewKKey(e.target.value)}
                                className={cn(inputCls, 'flex-1')}
                                placeholder="Түлхүүр (жишээ: Хаяг)"
                            />
                            <input
                                value={newKVal}
                                onChange={(e) => setNewKVal(e.target.value)}
                                className={cn(inputCls, 'flex-[2]')}
                                placeholder="Нарийвчилсан утга"
                            />
                            <Button
                                variant="primary"
                                size="icon"
                                disabled={!newKKey || !newKVal}
                                onClick={() => {
                                    if (newKKey && newKVal) {
                                        setKnowledge([...knowledge, { key: newKKey, value: newKVal }]);
                                        setNewKKey('');
                                        setNewKVal('');
                                    }
                                }}
                                aria-label="Нэмэх"
                            >
                                <Plus className="w-4 h-4" strokeWidth={2} />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {knowledge.length === 0 ? (
                                <div className="text-center py-10 text-[13px] text-white/35">
                                    <BookOpen
                                        className="w-8 h-8 mx-auto mb-3 text-white/15"
                                        strokeWidth={1.5}
                                    />
                                    Мэдээлэл байхгүй байна
                                </div>
                            ) : (
                                knowledge.map((k, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:border-[var(--border-accent)] transition-all"
                                    >
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                                            style={{
                                                background:
                                                    'color-mix(in oklab, var(--brand-indigo) 18%, transparent)',
                                                color: 'var(--brand-indigo-400)',
                                            }}
                                        >
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
                                            <p className="font-semibold text-[13px] text-foreground col-span-1 truncate tracking-[-0.01em]">
                                                {k.key}
                                            </p>
                                            <p className="text-[12px] text-white/60 col-span-1 md:col-span-2 truncate">
                                                {k.value}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() =>
                                                setKnowledge(knowledge.filter((_, j) => j !== i))
                                            }
                                            className="p-1.5 rounded-md text-white/30 hover:text-[var(--destructive)] hover:bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                            aria-label="Устгах"
                                        >
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.06]">
                            <Button
                                variant="primary"
                                size="md"
                                onClick={saveKnowledge}
                                disabled={saving}
                                leftIcon={
                                    saving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" strokeWidth={2} />
                                    )
                                }
                            >
                                Хадгалах
                            </Button>
                        </div>
                    </div>

                    {/* Policies */}
                    <div className="card-outlined p-6">
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-5 flex items-center gap-2">
                            <Shield
                                className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                strokeWidth={1.5}
                            />
                            Дэлгүүрийн бодлого
                        </h3>
                        <div className="space-y-5 bg-white/[0.02] p-5 rounded-xl border border-white/[0.06]">
                            <div>
                                <label className={labelCls}>Үнэгүй хүргэлтийн босго (₮)</label>
                                <input
                                    type="number"
                                    value={policies.shipping_threshold}
                                    onChange={(e) =>
                                        setPolicies({
                                            ...policies,
                                            shipping_threshold: Number(e.target.value),
                                        })
                                    }
                                    className={inputCls}
                                    placeholder="50000"
                                />
                                <p className="text-[11px] text-[var(--brand-indigo-400)] mt-1.5 tracking-[-0.01em]">
                                    Энэ дүнгээс дээш захиалгад хүргэлт үнэгүй
                                </p>
                            </div>
                            <div>
                                <label className={labelCls}>Төлбөрийн аргууд</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {PAYMENT_METHODS.map((m) => {
                                        const on = policies.payment_methods?.includes(m);
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => {
                                                    const c = policies.payment_methods || [];
                                                    setPolicies({
                                                        ...policies,
                                                        payment_methods: on
                                                            ? c.filter((x) => x !== m)
                                                            : [...c, m],
                                                    });
                                                }}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all tracking-[-0.01em]',
                                                    on
                                                        ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_16%,transparent)] text-foreground'
                                                        : 'border-white/[0.08] bg-transparent text-white/55 hover:border-white/[0.15] hover:text-white'
                                                )}
                                            >
                                                {m}
                                                {on && (
                                                    <Check
                                                        className="w-3.5 h-3.5 ml-1.5 inline"
                                                        strokeWidth={2}
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Хүргэлтийн бүс</label>
                                <input
                                    value={policies.delivery_areas?.join(', ') || ''}
                                    onChange={(e) =>
                                        setPolicies({
                                            ...policies,
                                            delivery_areas: e.target.value
                                                .split(',')
                                                .map((s) => s.trim()),
                                        })
                                    }
                                    className={inputCls}
                                    placeholder="Улаанбаатар, Дархан"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Буцаалтын нөхцөл</label>
                                <textarea
                                    value={policies.return_policy}
                                    onChange={(e) =>
                                        setPolicies({ ...policies, return_policy: e.target.value })
                                    }
                                    className={cn(inputCls, 'resize-none min-h-[60px]')}
                                    placeholder="Жишээ: 7 хоногийн дотор сав баглаа боодолтойгоо буцаах боломжтой"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-5">
                            <Button
                                variant="primary"
                                size="md"
                                onClick={savePolicies}
                                disabled={saving}
                                leftIcon={
                                    saving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" strokeWidth={2} />
                                    )
                                }
                            >
                                Бодлого хадгалах
                            </Button>
                        </div>
                    </div>

                    {/* AI хуваалцах хяналт (#5b/#5c) */}
                    <div className="card-outlined p-6">
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-2 flex items-center gap-2">
                            <Shield
                                className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                strokeWidth={1.5}
                            />
                            AI юуг хэрэглэгчид хуваалцаж болох вэ?
                        </h3>
                        <p className="text-[12px] text-white/50 mb-5 tracking-[-0.01em]">
                            Хэрэглэгч асуухад AI зөвхөн доорх ON болсон мэдээллийг өгнө. Бусад дотоод мэдээллийг бүү задал гэж заавал тохирно.
                        </p>

                        <div className="space-y-4 bg-white/[0.02] p-5 rounded-xl border border-white/[0.06]">
                            {/* Phone */}
                            <ToggleRow
                                value={aiSharePhone && !!shopPhone}
                                onChange={(v) => setAiSharePhone(v && !!shopPhone)}
                                title="📞 Утасны дугаар"
                                description={
                                    shopPhone
                                        ? `Хуваалцана: ${shopPhone}`
                                        : 'Утас тохируулагдаагүй — Settings хуудаснаас оруулна уу'
                                }
                            />

                            {/* Address */}
                            <div>
                                <label className={labelCls}>Хаяг</label>
                                <input
                                    value={shopAddress}
                                    onChange={(e) => setShopAddress(e.target.value)}
                                    className={inputCls}
                                    placeholder="Жнь: УБ, СБД, 1-р хороо, Сүхбаатарын талбай 5"
                                />
                                <div className="mt-2">
                                    <ToggleRow
                                        value={aiShareAddress && !!shopAddress}
                                        onChange={(v) => setAiShareAddress(v && !!shopAddress)}
                                        title="📍 Хаягийг AI хуваалцах"
                                        description="Орох газар асуувал хариу болгоно"
                                    />
                                </div>
                            </div>

                            {/* Business hours */}
                            <div>
                                <label className={labelCls}>Цагийн хуваарь</label>
                                <input
                                    value={shopBusinessHours}
                                    onChange={(e) => setShopBusinessHours(e.target.value)}
                                    className={inputCls}
                                    placeholder="Жнь: Дав-Баа 09:00-18:00, Ням амарна"
                                />
                                <div className="mt-2">
                                    <ToggleRow
                                        value={aiShareHours && !!shopBusinessHours}
                                        onChange={(v) => setAiShareHours(v && !!shopBusinessHours)}
                                        title="🕐 Цагийг AI хуваалцах"
                                        description="Хэдээс хэдэн цагт нээлттэй гэж асуувал"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <ToggleRow
                                value={aiShareDescription}
                                onChange={setAiShareDescription}
                                title="📝 Бизнесийн тайлбар"
                                description="Бид юу хийдэг гэж асуувал description-ыг өгнө"
                            />

                            {/* Policies */}
                            <ToggleRow
                                value={aiSharePolicies}
                                onChange={setAiSharePolicies}
                                title="📋 Бодлого"
                                description="Хүргэлт, буцаах, төлбөрийн арга гэх мэт"
                            />
                        </div>

                        <div className="flex justify-end mt-5">
                            <Button
                                variant="primary"
                                onClick={saveSharingSettings}
                                disabled={savingShare}
                                leftIcon={
                                    savingShare ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" strokeWidth={2} />
                                    )
                                }
                            >
                                Хадгалах
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Automation ═══ */}
            {activeTab === 'automation' && (
                <div className="space-y-5">
                    {/* Quick Replies */}
                    <div className="card-outlined p-6">
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-4 flex items-center gap-2">
                            <Zap
                                className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                strokeWidth={1.5}
                            />
                            Хурдан хариултууд
                        </h3>
                        <div className="flex flex-col md:flex-row gap-2 mb-4">
                            <input
                                value={newTrigger}
                                onChange={(e) => setNewTrigger(e.target.value)}
                                className={cn(inputCls, 'flex-1')}
                                placeholder="Гаралт (trigger үг)"
                            />
                            <input
                                value={newResponse}
                                onChange={(e) => setNewResponse(e.target.value)}
                                className={cn(inputCls, 'flex-1')}
                                placeholder="Урьдчилан бэлтгэсэн хариулт"
                            />
                            <Button
                                variant="primary"
                                size="icon"
                                disabled={!newTrigger || !newResponse}
                                onClick={addReply}
                                aria-label="Нэмэх"
                            >
                                <Plus className="w-4 h-4" strokeWidth={2} />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {replies.length === 0 ? (
                                <div className="text-center py-8 text-[13px] text-white/35">
                                    Хурдан хариулт байхгүй байна
                                </div>
                            ) : (
                                replies.map((r) => (
                                    <div
                                        key={r.id}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
                                    >
                                        <Zap
                                            className="w-5 h-5 text-[var(--brand-indigo-400)] flex-shrink-0"
                                            strokeWidth={1.5}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-foreground truncate tracking-[-0.01em]">
                                                {r.trigger}
                                            </p>
                                            <p className="text-[12px] text-white/55 truncate mt-0.5">
                                                {r.response}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeReply(r.id)}
                                            className="p-1.5 rounded-md text-white/30 hover:text-[var(--destructive)] hover:bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                            aria-label="Устгах"
                                        >
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Slogans */}
                    <div className="card-outlined p-6">
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-4 flex items-center gap-2">
                            <Hash
                                className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                strokeWidth={1.5}
                            />
                            Слоган / Уриа
                        </h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                value={newSlogan}
                                onChange={(e) => setNewSlogan(e.target.value)}
                                className={cn(inputCls, 'flex-1')}
                                placeholder="Борлуулалтын шинэ слоган"
                            />
                            <Button
                                variant="primary"
                                size="icon"
                                disabled={!newSlogan}
                                onClick={addSlogan}
                                aria-label="Нэмэх"
                            >
                                <Plus className="w-4 h-4" strokeWidth={2} />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {slogans.length === 0 ? (
                                <div className="text-center py-6 text-[13px] text-white/35">
                                    Слоган байхгүй байна
                                </div>
                            ) : (
                                slogans.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] group hover:border-white/[0.12] hover:bg-white/[0.04] transition-all"
                                    >
                                        <Hash
                                            className="w-4 h-4 text-white/45 flex-shrink-0"
                                            strokeWidth={1.5}
                                        />
                                        <p className="flex-1 text-[13px] text-foreground font-medium truncate tracking-[-0.01em]">
                                            {s.text}
                                        </p>
                                        <button
                                            onClick={() => removeSlogan(s.id)}
                                            className="p-1.5 rounded-md text-white/30 hover:text-[var(--destructive)] hover:bg-[color-mix(in_oklab,var(--destructive)_14%,transparent)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                            aria-label="Устгах"
                                        >
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Notifications ═══ */}
            {activeTab === 'notifications' && (
                <div className="space-y-4">
                    <div className="card-outlined p-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">
                                    Push notification шалгах
                                </h3>
                                <p className="text-[11.5px] text-white/45 mt-1">
                                    Туршилтын мэдэгдэл илгээж тохиргоо зөв байгаа эсэхийг шалгана.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={handleTestPush}
                                disabled={testingPush}
                                leftIcon={
                                    testingPush ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Bell className="w-3.5 h-3.5" />
                                    )
                                }
                            >
                                Туршилтын мэдэгдэл илгээх
                            </Button>
                        </div>
                        {pushTestResult ? (
                            <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-black/40 p-3 text-[11px] text-slate-300 font-mono">
                                {JSON.stringify(pushTestResult, null, 2)}
                            </pre>
                        ) : null}
                    </div>

                    <div className="card-outlined p-6">
                        <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-5">
                            Мэдэгдлийн тохиргоо
                        </h3>
                        <div className="space-y-3">
                            {[
                                {
                                    l: 'Шинэ захиалга бүртгэгдэхэд',
                                    d: 'AI амжилттай захиалга бүртгэх үед утсанд дуугарах',
                                    v: notifyOnOrder,
                                    s: setNotifyOnOrder,
                                },
                                {
                                    l: 'Холбогдох дугаар үлдээхэд',
                                    d: 'Хэрэглэгч утсаа үлдээх үед түлхүү мэдэгдэх',
                                    v: notifyOnContact,
                                    s: setNotifyOnContact,
                                },
                                {
                                    l: 'Тусламж хүсэхэд (Оператор руу шилжих)',
                                    d: 'Хэрэглэгч амьд хүнтэй холбогдохыг шаардах үед',
                                    v: notifyOnSupport,
                                    s: setNotifyOnSupport,
                                },
                                {
                                    l: 'Захиалга цуцлах хүсэлт',
                                    d: 'Хэрэглэгч захиалгаа цуцлахыг хүссэн үед',
                                    v: notifyOnCancel,
                                    s: setNotifyOnCancel,
                                },
                                {
                                    l: 'Гомдол хүлээн авах',
                                    d: 'Үйлчлүүлэгчийн гомдол, санал хүлээн авсан үед',
                                    v: notifyOnComplaints,
                                    s: setNotifyOnComplaints,
                                },
                                {
                                    l: 'Төлбөр төлөгдөх',
                                    d: 'Захиалгын төлбөр амжилттай хүлээн авагдсан үед',
                                    v: notifyOnPaymentReceived,
                                    s: setNotifyOnPaymentReceived,
                                },
                                {
                                    l: 'Төлбөр амжилтгүй болох',
                                    d: 'Төлбөр амжилтгүй болсон гэж тэмдэглэгдсэн үед',
                                    v: notifyOnPaymentFailed,
                                    s: setNotifyOnPaymentFailed,
                                },
                                {
                                    l: 'Буцаалт',
                                    d: 'Төлбөрийн буцаалт хийгдсэн үед',
                                    v: notifyOnRefund,
                                    s: setNotifyOnRefund,
                                },
                                {
                                    l: 'Шинэ хэрэглэгч',
                                    d: 'Messenger/Instagram-аас анх удаа мессеж бичсэн үед',
                                    v: notifyOnNewCustomer,
                                    s: setNotifyOnNewCustomer,
                                },
                                {
                                    l: 'Захиалга / туршилтын төлөв',
                                    d: 'Subscription идэвхжих, trial эхлэх, дуусах үед',
                                    v: notifyOnSubscription,
                                    s: setNotifyOnSubscription,
                                },
                                {
                                    l: 'Сэтгэгдлийн автомат хариу',
                                    d: 'Comment automation амжилттай эсвэл амжилтгүй ажилласан үед',
                                    v: notifyOnAutomation,
                                    s: setNotifyOnAutomation,
                                },
                                {
                                    l: 'Планы хязгаар дүүрэх',
                                    d: 'Одоогийн планы limit-д хүрэх үед',
                                    v: notifyOnPlanLimit,
                                    s: setNotifyOnPlanLimit,
                                },
                                {
                                    l: 'Бараа дуусах / нөөц багадах',
                                    d: 'Барааны үлдэгдэл 0 эсвэл бага үед',
                                    v: notifyOnLowStock,
                                    s: setNotifyOnLowStock,
                                },
                                {
                                    l: 'Бараа импорт',
                                    d: 'Excel импорт амжилттай дууссан үед',
                                    v: notifyOnImport,
                                    s: setNotifyOnImport,
                                },
                            ].map((n) => (
                                <ToggleRow
                                    key={n.l}
                                    title={n.l}
                                    description={n.d}
                                    value={n.v}
                                    onChange={n.s}
                                />
                            ))}
                        </div>
                        <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.06]">
                            <Button
                                variant="primary"
                                size="md"
                                onClick={saveGeneral}
                                disabled={saving}
                                leftIcon={
                                    saving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" strokeWidth={2} />
                                    )
                                }
                            >
                                Тохиргоог хадгалах
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Default export: routes between Wizard / Overview / Advanced
// ============================================================

type ViewMode = 'overview' | 'wizard' | 'advanced';

interface AgentShopState {
    is_ai_active?: boolean | null;
    ai_agent_role?: AgentRole | null;
    ai_agent_capabilities?: AgentCapability[] | null;
    ai_agent_name?: string | null;
    ai_emotion?: string | null;
    ai_instructions?: string | null;
    ai_setup_completed_at?: string | null;
    business_type?: BusinessType | null;
    description?: string | null;
}

export default function AISettingsPage() {
    const [view, setView] = useState<ViewMode>('overview');
    const [advancedTab, setAdvancedTab] = useState<'persona' | 'knowledge' | 'automation' | 'notifications'>('persona');
    const [shopState, setShopState] = useState<AgentShopState | null>(null);
    const [bootstrapLoading, setBootstrapLoading] = useState(true);

    const shopId =
        typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    const fetchShop = async () => {
        try {
            const res = await fetch('/api/shop', { headers: { 'x-shop-id': shopId } });
            const data = await res.json();
            if (data?.shop) {
                const s = data.shop as AgentShopState;
                setShopState(s);
                // Auto-open wizard for new users.
                if (!s.ai_setup_completed_at) {
                    setView('wizard');
                }
            }
        } catch (err) {
            logger.error('AI settings page bootstrap failed', { error: err });
        } finally {
            setBootstrapLoading(false);
        }
    };

    useEffect(() => {
        fetchShop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggleAi = async () => {
        if (!shopState) return;
        const next = !(shopState.is_ai_active !== false);
        try {
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ is_ai_active: next }),
            });
            if (!res.ok) throw new Error('Failed');
            setShopState({ ...shopState, is_ai_active: next });
            toast.success(next ? 'AI идэвхжлээ' : 'AI зогссон');
        } catch {
            toast.error('Алдаа гарлаа');
        }
    };

    if (bootstrapLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            </div>
        );
    }

    if (view === 'wizard') {
        return (
            <AgentWizard
                initial={{
                    businessType: shopState?.business_type ?? null,
                    agentRole: shopState?.ai_agent_role ?? null,
                    capabilities: shopState?.ai_agent_capabilities ?? null,
                    agentName: shopState?.ai_agent_name ?? null,
                    emotion: (shopState?.ai_emotion as 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful' | null) ?? null,
                    instructions: shopState?.ai_instructions ?? null,
                    description: shopState?.description ?? null,
                }}
                onClose={shopState?.ai_setup_completed_at ? () => setView('overview') : undefined}
                onComplete={() => {
                    fetchShop();
                    setView('overview');
                }}
            />
        );
    }

    if (view === 'advanced') {
        return <AdvancedSettings initialTab={advancedTab} onBack={() => setView('overview')} />;
    }

    // overview (default)
    return (
        <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
            <PageHero
                eyebrow="AI Agent"
                title="AI тохиргоо"
                subtitle="Бизнестээ тохирсон AI agent-аа удирдаарай"
            />
            <div className="mt-6">
                <AgentOverview
                    shop={shopState ?? {}}
                    onWizardOpen={() => setView('wizard')}
                    onAdvancedClick={() => {
                        setAdvancedTab('persona');
                        setView('advanced');
                    }}
                    onTabClick={(tab) => {
                        setAdvancedTab(tab);
                        setView('advanced');
                    }}
                    onToggleAi={handleToggleAi}
                />
            </div>
        </div>
    );
}
