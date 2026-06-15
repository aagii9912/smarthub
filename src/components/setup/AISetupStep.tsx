'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, RefreshCw, ChevronRight, ChevronLeft, Sparkles, Layers, ShoppingCart, CalendarCheck, Info, LifeBuoy, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Input';
import {
    EMOTIONS,
    STEPS,
    ASSERTIVENESS_OPTIONS,
    RESPONSE_LENGTH_OPTIONS,
    EMOJI_OPTIONS,
    PERSONA_STYLE_DEFAULTS,
} from '@/lib/constants/ai-setup';
import { logger } from '@/lib/utils/logger';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SalesAssertiveness, ResponseLength, EmojiUsage } from '@/types/ai';
import {
    AGENT_ROLES,
    getRecommendedAgentForBusinessType,
    getDefaultTemplateForBusinessType,
} from '@/lib/ai/agents';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { BusinessType } from '@/lib/constants/business-types';
import { BUSINESS_TYPES } from '@/lib/constants/business-types';

const ROLE_ICONS = {
    sales: ShoppingCart,
    booking: CalendarCheck,
    information: Info,
    support: LifeBuoy,
    lead_capture: UserPlus,
    hybrid: Layers,
} as const;

interface AISetupStepProps {
    initialData: {
        description: string;
        ai_emotion: string;
        ai_instructions: string;
        ai_agent_name?: string | null;
    };
    onSkip: () => void;
    onSave: (data: Record<string, unknown>) => Promise<void>;
    fbPageId?: string;
    fbPageToken?: string;
    /**
     * Business type chosen earlier in the wizard. Drives the recommended
     * agent role and template autofill.
     */
    businessType?: BusinessType;
}

export function AISetupStep({ initialData, onSkip, onSave, fbPageId, fbPageToken, businessType }: AISetupStepProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchingFb, setFetchingFb] = useState(false);
    const { t } = useLanguage();

    const effectiveBusinessType: BusinessType = businessType || 'other';
    const recommendation = useMemo(
        () => getRecommendedAgentForBusinessType(effectiveBusinessType),
        [effectiveBusinessType],
    );
    const template = useMemo(
        () => getDefaultTemplateForBusinessType(effectiveBusinessType),
        [effectiveBusinessType],
    );

    const role: AgentRole = recommendation.defaultRole;
    const capabilities: AgentCapability[] = recommendation.defaultCapabilities;
    const roleDef = AGENT_ROLES[role];
    const RoleIcon = ROLE_ICONS[role];

    const [agentName, setAgentName] = useState(initialData.ai_agent_name || template.defaultName);
    const [description, setDescription] = useState(initialData.description || '');
    const [emotion, setEmotion] = useState(initialData.ai_emotion || template.defaultEmotion);
    const [instructions, setInstructions] = useState(initialData.ai_instructions || template.defaultInstructions);
    // Owner-tunable reply style — saved to cross_cutting (see handleSave).
    const [salesAssertiveness, setSalesAssertiveness] = useState<SalesAssertiveness>(
        PERSONA_STYLE_DEFAULTS.sales_assertiveness,
    );
    const [responseLength, setResponseLength] = useState<ResponseLength>(
        PERSONA_STYLE_DEFAULTS.response_length,
    );
    const [emojiUsage, setEmojiUsage] = useState<EmojiUsage>(PERSONA_STYLE_DEFAULTS.emoji_usage);
    const userEditedRef = useRef(Boolean(initialData.ai_instructions));

    // Setup-ыг дахин нээхэд өмнө нь хадгалсан reply-style утгууд default-аар
    // дарагдахгүйн тулд одоогийн cross_cutting-аас state-ээ эхлүүлнэ.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/ai-settings/config');
                if (!res.ok) return;
                const data = await res.json();
                const cc = data?.cross_cutting as Record<string, unknown> | null;
                if (cancelled || !cc) return;
                if (ASSERTIVENESS_OPTIONS.some((o) => o.value === cc.sales_assertiveness)) {
                    setSalesAssertiveness(cc.sales_assertiveness as SalesAssertiveness);
                }
                if (RESPONSE_LENGTH_OPTIONS.some((o) => o.value === cc.response_length)) {
                    setResponseLength(cc.response_length as ResponseLength);
                }
                if (EMOJI_OPTIONS.some((o) => o.value === cc.emoji_usage)) {
                    setEmojiUsage(cc.emoji_usage as EmojiUsage);
                }
            } catch {
                // Уншиж чадаагүй бол default-аар үлдээнэ — хадгалах үед л чухал.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // When the recommendation changes (e.g. user backs up and changes business
    // type), realign defaults — but only if the user hasn't manually edited.
    useEffect(() => {
        if (userEditedRef.current) return;
        setAgentName((prev) => (initialData.ai_agent_name ? prev : template.defaultName));
        setEmotion((prev) => (initialData.ai_emotion ? prev : template.defaultEmotion));
        setInstructions((prev) => (initialData.ai_instructions ? prev : template.defaultInstructions));
    }, [template, initialData.ai_agent_name, initialData.ai_emotion, initialData.ai_instructions]);

    const fetchFacebookContext = async () => {
        if (!fbPageId || !fbPageToken) return;
        setFetchingFb(true);
        try {
            const fields = 'about,description,mission,location';
            const res = await fetch(`https://graph.facebook.com/v19.0/${fbPageId}?fields=${fields}&access_token=${fbPageToken}`);
            const data = await res.json();

            if (data.about || data.description) {
                const desc = [data.about, data.description, data.mission].filter(Boolean).join('. ');
                setDescription(desc);
            }
        } catch (err) {
            logger.error('FB Fetch Error', { error: err });
        } finally {
            setFetchingFb(false);
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) setCurrentStep((c) => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep((c) => c - 1);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Reply-style knobs live in cross_cutting (JSONB), persisted via the
            // merge-safe config endpoint so we don't clobber other AI config.
            const res = await fetch('/api/ai-settings/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cross_cutting: {
                        sales_assertiveness: salesAssertiveness,
                        response_length: responseLength,
                        emoji_usage: emojiUsage,
                    },
                }),
            });
            if (!res.ok) {
                throw new Error(`cross_cutting save failed (${res.status})`);
            }
            await onSave({
                description,
                ai_emotion: emotion,
                ai_instructions: instructions,
                ai_agent_role: role,
                ai_agent_capabilities: capabilities,
                ai_agent_name: agentName.trim() || null,
                ai_setup_completed_at: new Date().toISOString(),
            });
        } catch (err) {
            logger.error('AI setup хадгалахад алдаа гарлаа', { error: err });
            toast.error('Тохиргоо хадгалахад алдаа гарлаа. Дахин оролдоно уу.');
            setLoading(false);
        }
    };

    const businessLabel = businessType ? BUSINESS_TYPES[businessType].label : 'Бусад';

    return (
        <div className="flex flex-col h-full">
            <div className="w-full flex flex-col pt-2">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.setup.ai.title}</h2>
                    <div className="flex gap-2">
                        {STEPS.map((step, i) => (
                            <div
                                key={step.id}
                                className={`h-1.5 rounded-full flex-1 transition-all ${i <= currentStep ? 'bg-violet-600' : 'bg-gray-200'}`}
                            />
                        ))}
                    </div>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                        {t.setup.ai.step} {currentStep + 1}: <span className="text-violet-600">{STEPS[currentStep].title}</span>
                    </p>
                </div>

                <div className="flex-1 space-y-6 animate-in slide-in-from-right fade-in duration-300">
                    {/* STEP 1: IDENTITY — auto-derived role + AI name + description */}
                    {currentStep === 0 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-700">
                                <Sparkles className="inline w-4 h-4 mr-1 text-blue-500" />
                                Бид {businessLabel} бизнест тохирох <strong>{roleDef.label.mn}</strong> agent-ийг автоматаар сонгосон.
                            </div>

                            {/* Role card */}
                            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-2">
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${roleDef.accentClass}`}>
                                        <RoleIcon className="w-5 h-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-base font-semibold text-gray-900">{roleDef.label.mn} Agent</div>
                                        <div className="text-xs text-gray-600 line-clamp-2">{roleDef.description.mn}</div>
                                    </div>
                                </div>
                                {role === 'hybrid' && capabilities.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-violet-200/50">
                                        <span className="text-[10.5px] uppercase tracking-wider text-gray-500">Чадварууд:</span>
                                        {capabilities.map((c) => (
                                            <span
                                                key={c}
                                                className={`inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full ${AGENT_ROLES[c].accentClass}`}
                                            >
                                                {AGENT_ROLES[c].label.mn}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* AI Name */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-900">AI-ийн нэр</label>
                                <Input
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value.slice(0, 80))}
                                    placeholder='Жишээ: "Сүхээ"'
                                    className="bg-white"
                                    maxLength={80}
                                />
                                <p className="text-xs text-gray-500">AI өөрийгөө танилцуулахдаа энэ нэрийг ашиглана.</p>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-gray-900">{t.setup.ai.shopDescription}</label>
                                    {fbPageId && fbPageToken && (
                                        <button
                                            onClick={fetchFacebookContext}
                                            disabled={fetchingFb}
                                            className="text-xs text-violet-600 font-medium hover:underline flex items-center gap-1"
                                        >
                                            <RefreshCw className={`w-3 h-3 ${fetchingFb ? 'animate-spin' : ''}`} />
                                            {t.setup.ai.fetchFromFb}
                                        </button>
                                    )}
                                </div>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t.setup.ai.shopDescPlaceholder}
                                    rows={4}
                                    className="bg-white resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PERSONALITY (emotion) */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-sm text-purple-700">
                                {t.setup.ai.personalityHint}
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-900">{t.setup.ai.emotionLabel}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {EMOTIONS.map((e) => (
                                        <button
                                            key={e.value}
                                            onClick={() => setEmotion(e.value)}
                                            className={`p-4 rounded-xl border text-left transition-all ${emotion === e.value
                                                ? 'bg-violet-600 text-white border-violet-600 shadow-md transform scale-[1.02]'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-200 shadow-sm'
                                                }`}
                                        >
                                            <div className="mb-2">
                                                <e.icon className={`w-6 h-6 ${emotion === e.value ? 'text-white' : 'text-gray-400'}`} />
                                            </div>
                                            <div className="font-semibold">{e.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reply-style knobs — lets the owner avoid an over-soft AI */}
                            <StyleChoice
                                label="Борлуулалтын зан"
                                hint="AI хэт зөөлөн санагдвал «Шулуухан» сонгоорой."
                                options={ASSERTIVENESS_OPTIONS}
                                value={salesAssertiveness}
                                onChange={setSalesAssertiveness}
                            />
                            <StyleChoice
                                label="Хариултын урт"
                                options={RESPONSE_LENGTH_OPTIONS}
                                value={responseLength}
                                onChange={setResponseLength}
                            />
                            <StyleChoice
                                label="Emoji хэрэглээ"
                                options={EMOJI_OPTIONS}
                                value={emojiUsage}
                                onChange={setEmojiUsage}
                            />
                        </div>
                    )}

                    {/* STEP 3: REVIEW — system prompt preview */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-sm text-green-700">
                                {t.setup.ai.reviewHint}
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-900">{t.setup.ai.systemPrompt}</label>
                                <p className="text-xs text-gray-500">{t.setup.ai.systemPromptDesc}</p>
                                <Textarea
                                    value={instructions}
                                    onChange={(e) => {
                                        userEditedRef.current = true;
                                        setInstructions(e.target.value);
                                    }}
                                    rows={8}
                                    className="bg-gray-50 font-mono text-sm leading-relaxed"
                                />
                            </div>

                            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
                                <strong>Тэмдэглэл:</strong> Илүү нарийвчилсан тохиргоо (FAQ, capability toggle, live preview chat) дашбордын <em>AI Settings</em>-ээс хийх боломжтой.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-100 bg-transparent sticky bottom-0 py-4">
                    {currentStep === 0 ? (
                        <Button variant="ghost" onClick={onSkip} className="text-gray-500 px-0 hover:bg-transparent">
                            {t.common.skip}
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={handleBack} className="text-gray-600 pl-0 hover:bg-transparent">
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            {t.common.back}
                        </Button>
                    )}

                    {currentStep < STEPS.length - 1 ? (
                        <Button onClick={handleNext} className="bg-violet-600 hover:bg-violet-700 text-white px-6">
                            {t.common.next}
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    ) : (
                        <Button onClick={handleSave} disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white px-8">
                            {loading ? t.common.saving : t.setup.ai.saveAndFinish}
                            {!loading && <Check className="w-4 h-4 ml-2" />}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Light-themed single-choice control for the onboarding reply-style knobs
 * (assertiveness / length / emoji). Mirrors the dashboard's StyleSegment but
 * styled for the white /setup wizard.
 */
function StyleChoice<T extends string>({
    label,
    hint,
    options,
    value,
    onChange,
}: {
    label: string;
    hint?: string;
    options: { value: T; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">{label}</label>
            {hint && <p className="text-xs text-gray-500 -mt-1">{hint}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {options.map((opt) => {
                    const selected = value === opt.value;
                    const Icon = opt.icon;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${selected
                                ? 'bg-violet-50 border-violet-400 ring-1 ring-violet-300'
                                : 'bg-white border-gray-200 hover:border-violet-200 shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <Icon className={`w-4 h-4 ${selected ? 'text-violet-600' : 'text-gray-400'}`} />
                                <span className={`text-[13px] font-semibold ${selected ? 'text-violet-700' : 'text-gray-700'}`}>
                                    {opt.label}
                                </span>
                            </div>
                            <span className="text-[11px] text-gray-500 leading-snug">{opt.description}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
