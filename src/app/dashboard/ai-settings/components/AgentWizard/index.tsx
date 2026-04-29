'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { WizardLayout, type WizardStep } from './WizardLayout';
import { Step1Role } from './Step1Role';
import { Step2Personality } from './Step2Personality';
import { Step3Knowledge, type FAQEntry } from './Step3Knowledge';
import { Step4Capabilities } from './Step4Capabilities';
import { Step5Preview } from './Step5Preview';
import { AgentPreviewChat, type AgentDraftConfig } from '../AgentPreviewChat';
import {
    BUSINESS_ROLE_RECOMMENDATIONS,
    getDefaultTemplateForBusinessType,
} from '@/lib/ai/agents';
import { type BusinessType } from '@/lib/constants/business-types';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';
import type { AIEmotion } from '@/types/ai';
import type { ToolName } from '@/lib/ai/tools/definitions';

const WIZARD_STEPS: WizardStep[] = [
    { id: 'role', title: 'Үүрэг' },
    { id: 'personality', title: 'Зан төлөв' },
    { id: 'knowledge', title: 'Мэдлэг' },
    { id: 'capabilities', title: 'Үйлдлүүд' },
    { id: 'preview', title: 'Турших' },
];

interface AgentWizardProps {
    initial: {
        businessType?: BusinessType | null;
        agentRole?: AgentRole | null;
        capabilities?: AgentCapability[] | null;
        agentName?: string | null;
        emotion?: AIEmotion | null;
        instructions?: string | null;
        description?: string | null;
        faqs?: FAQEntry[];
        enabledTools?: ToolName[] | null;
    };
    onClose?: () => void;
    onComplete: () => void;
}

export function AgentWizard({ initial, onClose, onComplete }: AgentWizardProps) {
    const initBusinessType: BusinessType = initial.businessType || 'retail';
    const initRec = BUSINESS_ROLE_RECOMMENDATIONS[initBusinessType];
    const initTemplate = getDefaultTemplateForBusinessType(initBusinessType);

    const [stepIndex, setStepIndex] = useState(0);
    const [businessType, setBusinessType] = useState<BusinessType>(initBusinessType);
    const [role, setRole] = useState<AgentRole>(initial.agentRole || initRec.defaultRole);
    const [capabilities, setCapabilities] = useState<AgentCapability[]>(
        initial.capabilities && initial.capabilities.length > 0
            ? initial.capabilities
            : initRec.defaultCapabilities,
    );
    const [agentName, setAgentName] = useState(initial.agentName || initTemplate.defaultName);
    const [emotion, setEmotion] = useState<AIEmotion>(
        (initial.emotion as AIEmotion) || initTemplate.defaultEmotion,
    );
    const [instructions, setInstructions] = useState(
        initial.instructions || initTemplate.defaultInstructions,
    );
    const [description, setDescription] = useState(initial.description || '');
    const [faqs, setFaqs] = useState<FAQEntry[]>(initial.faqs || []);
    const [enabledTools, setEnabledTools] = useState<ToolName[]>(initial.enabledTools || []);
    const [saving, setSaving] = useState(false);

    // When the user changes business type mid-wizard, refresh template-based fields
    // (only if they're still equal to the previous template defaults).
    useEffect(() => {
        const tpl = getDefaultTemplateForBusinessType(businessType);
        setAgentName((prev) => (prev === initTemplate.defaultName ? tpl.defaultName : prev));
        setEmotion((prev) => (prev === initTemplate.defaultEmotion ? tpl.defaultEmotion : prev));
        setInstructions((prev) =>
            prev === initTemplate.defaultInstructions ? tpl.defaultInstructions : prev,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessType]);

    const draft: AgentDraftConfig = useMemo(
        () => ({
            agentRole: role,
            capabilities,
            agentName,
            emotion,
            instructions,
        }),
        [role, capabilities, agentName, emotion, instructions],
    );

    const suggestedFaqs = useMemo(
        () => getDefaultTemplateForBusinessType(businessType).suggestedFAQs,
        [businessType],
    );

    const stepValid = useMemo(() => {
        switch (stepIndex) {
            case 0:
                return role === 'hybrid' ? capabilities.length > 0 : true;
            case 1:
                return agentName.trim().length > 0;
            default:
                return true;
        }
    }, [stepIndex, role, capabilities.length, agentName]);

    const persistAndComplete = async () => {
        setSaving(true);
        try {
            // 1) Save shop-level fields.
            const shopRes = await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_type: businessType,
                    ai_agent_role: role,
                    ai_agent_capabilities: capabilities,
                    ai_agent_name: agentName.trim() || null,
                    ai_emotion: emotion,
                    ai_instructions: instructions,
                    description,
                    ai_setup_completed_at: new Date().toISOString(),
                    ai_agent_config: { enabled_tools: enabledTools },
                }),
            });
            if (!shopRes.ok) {
                const data = await shopRes.json().catch(() => ({}));
                throw new Error(data?.error || 'Шопын мэдээлэл хадгалахад алдаа гарлаа');
            }

            // 2) Replace FAQs (small list, simpler than diffing).
            const faqRes = await fetch('/api/ai-settings?type=faqs', { method: 'GET' });
            if (faqRes.ok) {
                const data = await faqRes.json();
                const existing = (data?.faqs || []) as { id: string }[];
                await Promise.all(
                    existing.map((f) =>
                        fetch(`/api/ai-settings?type=faqs&id=${f.id}`, { method: 'DELETE' }),
                    ),
                );
            }
            await Promise.all(
                faqs.map((f) =>
                    fetch('/api/ai-settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'faqs',
                            question: f.question,
                            answer: f.answer,
                        }),
                    }),
                ),
            );

            toast.success('AI agent идэвхжлээ! Хэрэглэгчид шууд хариу авах боломжтой.');
            onComplete();
        } catch (err) {
            logger.error('AgentWizard save failed', { error: err });
            toast.error(err instanceof Error ? err.message : 'Хадгалахад алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    };

    const handleNext = () => {
        if (stepIndex < WIZARD_STEPS.length - 1) {
            setStepIndex((i) => i + 1);
        } else {
            persistAndComplete();
        }
    };

    const handleBack = () => {
        if (stepIndex > 0) setStepIndex((i) => i - 1);
    };

    const finalStep = stepIndex === WIZARD_STEPS.length - 1;

    const stepContent = (() => {
        switch (stepIndex) {
            case 0:
                return (
                    <Step1Role
                        businessType={businessType}
                        onBusinessTypeChange={setBusinessType}
                        role={role}
                        onRoleChange={setRole}
                        capabilities={capabilities}
                        onCapabilitiesChange={setCapabilities}
                    />
                );
            case 1:
                return (
                    <Step2Personality
                        agentName={agentName}
                        onAgentNameChange={setAgentName}
                        emotion={emotion}
                        onEmotionChange={setEmotion}
                        instructions={instructions}
                        onInstructionsChange={setInstructions}
                    />
                );
            case 2:
                return (
                    <Step3Knowledge
                        faqs={faqs}
                        onFaqsChange={setFaqs}
                        suggestedFaqs={suggestedFaqs}
                        description={description}
                        onDescriptionChange={setDescription}
                    />
                );
            case 3:
                return (
                    <Step4Capabilities
                        role={role}
                        capabilities={capabilities}
                        enabledTools={enabledTools}
                        onEnabledToolsChange={setEnabledTools}
                    />
                );
            case 4:
                return <Step5Preview draft={draft} />;
            default:
                return null;
        }
    })();

    return (
        <WizardLayout
            steps={WIZARD_STEPS}
            activeStepIndex={stepIndex}
            onStepClick={(idx) => setStepIndex(idx)}
            onBack={handleBack}
            onNext={handleNext}
            onClose={onClose}
            onSkipToEnd={() => setStepIndex(WIZARD_STEPS.length - 1)}
            nextLabel={finalStep ? 'Идэвхжүүлэх' : 'Үргэлжлүүлэх'}
            nextLoading={saving}
            nextDisabled={!stepValid}
            finalStep={finalStep}
            sidePanel={
                stepIndex < 4 ? (
                    <div className="flex h-full flex-col">
                        <div className="border-b border-white/[0.06] px-4 py-3">
                            <p className="text-[10.5px] uppercase tracking-wider text-white/40">
                                LIVE PREVIEW
                            </p>
                            <p className="text-[12.5px] font-semibold text-foreground tracking-tight mt-1">
                                AI хариу хэрхэн харагдах вэ
                            </p>
                        </div>
                        <div className="flex-1 min-h-0">
                            <AgentPreviewChat draft={draft} compact />
                        </div>
                    </div>
                ) : undefined
            }
        >
            {stepContent}
        </WizardLayout>
    );
}
