'use client';

import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BrandVoiceForm } from './BrandVoiceForm';
import { ProhibitedTopicsInput } from './ProhibitedTopicsInput';
import { SupportedLanguagesPicker } from './SupportedLanguagesPicker';
import { EscalationRulesForm } from './EscalationRulesForm';
import type {
    BrandVoice,
    AISupportedLanguage,
    EscalationRules,
    CrossCuttingConfig,
} from '@/types/ai';

interface BrandSectionProps {
    brandVoice?: BrandVoice;
    prohibitedTopics: string[];
    supportedLanguages: AISupportedLanguage[];
    escalationRules: EscalationRules;
    onChange: (patch: Partial<CrossCuttingConfig>) => void;
    onSave: () => Promise<void> | void;
    saving: boolean;
}

export function BrandSection({
    brandVoice,
    prohibitedTopics,
    supportedLanguages,
    escalationRules,
    onChange,
    onSave,
    saving,
}: BrandSectionProps) {
    return (
        <div className="card-featured p-6 space-y-7">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                        Брэнд хоолой ба хязгаар
                    </h3>
                    <p className="text-[12px] text-white/45 mt-1 leading-relaxed max-w-2xl">
                        AI таны брэндийн дүр төрхөө хадгалж, нууцлал болон хязгаарыг сахихын тулд эдгээр тохиргоог хийнэ.
                    </p>
                </div>
                <Button
                    onClick={() => void onSave()}
                    disabled={saving}
                    variant="primary"
                    className="shrink-0"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Хадгалж байна...
                        </>
                    ) : (
                        <>
                            <Save className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Хадгалах
                        </>
                    )}
                </Button>
            </div>

            <BrandVoiceForm
                value={brandVoice}
                onChange={(next) => onChange({ brand_voice: next })}
            />

            <ProhibitedTopicsInput
                topics={prohibitedTopics}
                onChange={(next) => onChange({ prohibited_topics: next })}
            />

            <SupportedLanguagesPicker
                languages={supportedLanguages}
                onChange={(next) => onChange({ supported_languages: next })}
            />

            <div className="border-t border-white/[0.06] pt-6">
                <h4 className="text-[13px] font-semibold text-foreground tracking-[-0.01em] mb-2">
                    Хүн рүү шилжүүлэх дүрэм
                </h4>
                <EscalationRulesForm
                    rules={escalationRules}
                    onChange={(next) => onChange({ escalation_rules: next })}
                />
            </div>
        </div>
    );
}
