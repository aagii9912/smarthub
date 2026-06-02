'use client';

/**
 * Business Template — хэрэглэгч бизнесийнхээ төрөлд тохирсон загвар сонгоод
 * AI agent-ийнхаа нэр, өнгө аяс, role/чадвар, FAQ, слоган, зааврыг нэг товшилтоор
 * тохируулна. Сонгохын өмнө юу өөрчлөгдөхийг preview-ээр харж, баталгаажуулна.
 *
 * Бэлэн дэд бүтэц дээр түшиглэнэ:
 *   - AGENT_TEMPLATES (src/lib/ai/agents/templates.ts)
 *   - POST /api/ai-settings/apply-template
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Sparkles, MessageCircleQuestion, Quote, Bot } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal';
import { AGENT_TEMPLATES } from '@/lib/ai/agents';
import type { AgentTemplate, AgentRole, AgentCapability } from '@/lib/ai/agents';
import { BUSINESS_TYPES, type BusinessType } from '@/lib/constants/business-types';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const ROLE_LABEL_MN: Record<AgentRole, string> = {
    sales: 'Борлуулалт',
    booking: 'Цаг захиалга',
    information: 'Мэдээлэл',
    support: 'Дэмжлэг',
    lead_capture: 'Лид цуглуулах',
    hybrid: 'Олон үүрэг',
};

const CAPABILITY_LABEL_MN: Record<AgentCapability, string> = {
    sales: 'Борлуулалт',
    booking: 'Цаг захиалга',
    information: 'Мэдээлэл',
    support: 'Дэмжлэг',
    lead_capture: 'Лид цуглуулах',
};

const EMOTION_LABEL_MN: Record<string, string> = {
    friendly: 'Найрсаг',
    professional: 'Мэргэжлийн',
    enthusiastic: 'Урам зоригтой',
    calm: 'Тайван',
    playful: 'Хөгжилтэй',
    luxurious: 'Тансаг',
};

export default function BusinessTemplatesPage() {
    const { locale } = useLanguage();
    const [shopId, setShopId] = useState<string | null>(null);
    const [currentBusinessType, setCurrentBusinessType] = useState<BusinessType | null>(null);
    const [currentAgentName, setCurrentAgentName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [selected, setSelected] = useState<AgentTemplate | null>(null);
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        const id = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
        setShopId(id);
        if (!id) {
            setLoading(false);
            return;
        }
        fetch('/api/shop', { headers: { 'x-shop-id': id } })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const shop = data?.shop ?? data;
                if (shop) {
                    setCurrentBusinessType(shop.business_type ?? null);
                    setCurrentAgentName(shop.ai_agent_name ?? null);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const text = (s: { mn: string; en: string }) => (locale === 'en' ? s.en : s.mn);

    const openPreview = (tpl: AgentTemplate) => {
        setSelected(tpl);
        setReplaceExisting(false);
    };

    const applyTemplate = async () => {
        if (!selected) return;
        setApplying(true);
        try {
            const res = await fetch('/api/ai-settings/apply-template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(shopId ? { 'x-shop-id': shopId } : {}),
                },
                body: JSON.stringify({ templateId: selected.id, replaceExisting }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Загвар хэрэглэхэд алдаа гарлаа');

            setCurrentBusinessType(selected.businessType);
            setCurrentAgentName(selected.defaultName);
            toast.success(`"${text(selected.label)}" загвар амжилттай хэрэглэгдлээ`);
            setSelected(null);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Алдаа гарлаа');
        } finally {
            setApplying(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600">
                    <Sparkles className="h-4 w-4" />
                    Бизнес загвар
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Бизнесдээ тохирсон загвараа сонго
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Загвар сонгоход AI туслахын <strong>нэр, өнгө аяс, үүрэг (role), FAQ, слоган болон заавар</strong>{' '}
                    тань тухайн бизнесийн төрөлд тааруулан тохируулагдана. Хэрэглэхээс өмнө юу өөрчлөгдөхийг харж
                    баталгаажуулна.
                </p>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {AGENT_TEMPLATES.map((tpl) => {
                    const meta = BUSINESS_TYPES[tpl.businessType];
                    const Icon = meta?.icon ?? Bot;
                    const isCurrent = currentBusinessType === tpl.businessType;
                    return (
                        <button
                            key={tpl.id}
                            type="button"
                            onClick={() => openPreview(tpl)}
                            className={cn(
                                'group relative flex flex-col rounded-2xl border bg-white p-5 text-left transition-all',
                                'hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md',
                                isCurrent ? 'border-violet-400 ring-1 ring-violet-300' : 'border-gray-200'
                            )}
                        >
                            {isCurrent && (
                                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                    <Check className="h-3 w-3" /> Одоогийн
                                </span>
                            )}
                            <div
                                className={cn(
                                    'mb-3 flex h-11 w-11 items-center justify-center rounded-xl',
                                    meta?.accentClass ?? 'bg-gray-100 text-gray-600'
                                )}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                            <h3 className="text-base font-bold text-gray-900">{text(tpl.label)}</h3>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{text(tpl.description)}</p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                                <Badge variant="primary">{ROLE_LABEL_MN[tpl.role]}</Badge>
                                {tpl.suggestedFAQs.length > 0 && (
                                    <Badge variant="secondary">{tpl.suggestedFAQs.length} FAQ</Badge>
                                )}
                            </div>

                            <div className="mt-4 flex items-center text-sm font-medium text-violet-600 opacity-0 transition-opacity group-hover:opacity-100">
                                Дэлгэрэнгүй харах →
                            </div>
                        </button>
                    );
                })}
            </div>

            {loading && <p className="mt-4 text-sm text-muted-foreground">Ачаалж байна…</p>}

            {/* Preview modal */}
            <Modal open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                {selected && (
                    <ModalContent size="lg" title={text(selected.label)} description={text(selected.description)}>
                        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2">
                            {/* AI persona summary */}
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                                    <div>
                                        <div className="text-xs text-gray-400">AI нэр</div>
                                        <div className="font-semibold text-gray-900">{selected.defaultName}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400">Өнгө аяс</div>
                                        <div className="font-semibold text-gray-900">
                                            {EMOTION_LABEL_MN[selected.defaultEmotion] ?? selected.defaultEmotion}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400">Үүрэг</div>
                                        <div className="font-semibold text-gray-900">{ROLE_LABEL_MN[selected.role]}</div>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {selected.capabilities.map((c) => (
                                        <Badge key={c} variant="secondary">
                                            {CAPABILITY_LABEL_MN[c]}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Instructions */}
                            <div>
                                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                    <Bot className="h-4 w-4 text-violet-500" /> AI заавар
                                </div>
                                <p className="rounded-lg bg-violet-50 p-3 text-sm text-gray-700">
                                    {selected.defaultInstructions}
                                </p>
                            </div>

                            {/* FAQs */}
                            {selected.suggestedFAQs.length > 0 && (
                                <div>
                                    <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                        <MessageCircleQuestion className="h-4 w-4 text-violet-500" /> Түгээмэл асуултууд (
                                        {selected.suggestedFAQs.length})
                                    </div>
                                    <ul className="space-y-2">
                                        {selected.suggestedFAQs.map((f, i) => (
                                            <li key={i} className="rounded-lg border border-gray-100 p-3 text-sm">
                                                <div className="font-medium text-gray-900">{f.question}</div>
                                                <div className="mt-0.5 text-gray-500">{f.answer}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Slogans */}
                            {selected.suggestedSlogans && selected.suggestedSlogans.length > 0 && (
                                <div>
                                    <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                        <Quote className="h-4 w-4 text-violet-500" /> Слоган
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selected.suggestedSlogans.map((s, i) => (
                                            <Badge key={i} variant="outline">
                                                {s}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Replace toggle */}
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <input
                                    type="checkbox"
                                    checked={replaceExisting}
                                    onChange={(e) => setReplaceExisting(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600"
                                />
                                <span className="text-sm text-amber-800">
                                    Одоо байгаа FAQ болон слоганыг <strong>устгаж</strong> энэ загвараар бүрэн солих.
                                    <span className="mt-0.5 block text-xs text-amber-600">
                                        Тэмдэглээгүй бол одоо байгаа дээр нэмж нэгтгэнэ.
                                    </span>
                                </span>
                            </label>
                        </div>

                        <ModalFooter>
                            <Button variant="outline" onClick={() => setSelected(null)} disabled={applying}>
                                Болих
                            </Button>
                            <Button variant="primary" loading={applying} onClick={applyTemplate} leftIcon={<Check className="h-4 w-4" />}>
                                Энэ загварыг хэрэглэх
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                )}
            </Modal>
        </div>
    );
}
