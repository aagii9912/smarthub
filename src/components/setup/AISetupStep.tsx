'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { TEMPLATES, EMOTIONS, STEPS } from '@/lib/constants/ai-setup';
import { logger } from '@/lib/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';

type TemplateKey = keyof typeof TEMPLATES;

interface AISetupStepProps {
    initialData: {
        description: string;
        ai_emotion: string;
        ai_instructions: string;
    };
    onSkip: () => void;
    onSave: (data: any) => Promise<void>;
    fbPageId?: string;
    fbPageToken?: string;
    /**
     * Optional template key derived from the wizard's selected business type.
     * When provided, it preselects the AI template and updates emotion/instructions
     * to match — unless the user has already customized them.
     */
    defaultTemplate?: TemplateKey;
}

export function AISetupStep({ initialData, onSkip, onSave, fbPageId, fbPageToken, defaultTemplate }: AISetupStepProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchingFb, setFetchingFb] = useState(false);
    const { t } = useLanguage();

    const initialTemplate: TemplateKey = defaultTemplate && TEMPLATES[defaultTemplate] ? defaultTemplate : 'general';
    const [template, setTemplate] = useState<TemplateKey>(initialTemplate);
    const [description, setDescription] = useState(initialData.description || '');
    const [emotion, setEmotion] = useState(initialData.ai_emotion || TEMPLATES[initialTemplate].emotion);
    const [instructions, setInstructions] = useState(initialData.ai_instructions || TEMPLATES[initialTemplate].instructions);
    const userEditedRef = useRef(Boolean(initialData.ai_instructions));

    // When defaultTemplate changes (e.g. user picked a different business type
    // and came back to AI step), realign template/emotion/instructions — but
    // only if the user hasn't manually edited the instructions yet.
    useEffect(() => {
        if (!defaultTemplate || !TEMPLATES[defaultTemplate]) return;
        if (userEditedRef.current) return;
        const tpl = TEMPLATES[defaultTemplate];
        setTemplate(defaultTemplate);
        setEmotion((prev) => prev === '' ? tpl.emotion : prev || tpl.emotion);
        setInstructions((prev) => (prev && userEditedRef.current ? prev : tpl.instructions));
    }, [defaultTemplate]);

    const handleTemplateChange = (newTemplate: TemplateKey) => {
        setTemplate(newTemplate);
        const tpl = TEMPLATES[newTemplate];
        setInstructions(tpl.instructions);
        setEmotion(tpl.emotion);
        userEditedRef.current = false;
    };

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
        if (currentStep < STEPS.length - 1) setCurrentStep(c => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(c => c - 1);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave({
                description,
                ai_emotion: emotion,
                ai_instructions: instructions
            });
        } catch (err) {
            logger.error('Алдаа гарлаа', { error: err });
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">

            {/* LEFT COLUMN (Wizard Actions) -> Now stacked below */}
            <div className="w-full flex flex-col pt-2">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.setup.ai.title}</h2>
                    {/* Wizard Progress */}
                    <div className="flex gap-2">
                        {STEPS.map((step, i) => (
                            <div key={step.id} className={`h-1.5 rounded-full flex-1 transition-all ${i <= currentStep ? 'bg-violet-600' : 'bg-gray-200'
                                }`} />
                        ))}
                    </div>
                    <p className="text-sm font-medium text-gray-500 mt-2">
                        {t.setup.ai.step} {currentStep + 1}: <span className="text-violet-600">{STEPS[currentStep].title}</span>
                    </p>
                </div>

                <div className="flex-1 space-y-6 animate-in slide-in-from-right fade-in duration-300">

                    {/* STEP 1: IDENTITY */}
                    {currentStep === 0 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-700">
                                {t.setup.ai.templateHint}
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-900">{t.setup.ai.selectBusinessType}</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(TEMPLATES).map(([key, t]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleTemplateChange(key as TemplateKey)}
                                            className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between ${template === key
                                                ? 'border-violet-600 bg-violet-50 ring-1 ring-violet-600'
                                                : 'border-gray-200 hover:border-violet-200'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-semibold text-gray-900">{t.label}</div>
                                                <div className="text-xs text-gray-500">{t.description}</div>
                                            </div>
                                            {template === key && <Check className="w-5 h-5 text-violet-600" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
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

                    {/* STEP 2: PERSONALITY */}
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
                        </div>
                    )}

                    {/* STEP 3: REVIEW */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-sm text-green-700">
                                {t.setup.ai.reviewHint}
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-900">{t.setup.ai.systemPrompt}</label>
                                <p className="text-xs text-gray-500">
                                    {t.setup.ai.systemPromptDesc}
                                </p>
                                <Textarea
                                    value={instructions}
                                    onChange={(e) => { userEditedRef.current = true; setInstructions(e.target.value); }}
                                    rows={8}
                                    className="bg-gray-50 font-mono text-sm leading-relaxed"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
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
