'use client';

import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BusinessHoursPicker } from './BusinessHoursPicker';
import { FulfillmentSLAForm } from './FulfillmentSLAForm';
import { SeasonalPromotionsList } from './SeasonalPromotionsList';
import type {
    WeeklyHours,
    FulfillmentSLA,
    SeasonalPromotion,
    CrossCuttingConfig,
} from '@/types/ai';

interface PoliciesSectionProps {
    workingHoursStructured: WeeklyHours;
    fulfillmentSla: FulfillmentSLA;
    seasonalPromotions: SeasonalPromotion[];
    onChangeHours: (next: WeeklyHours) => void;
    onChangeCrossCutting: (patch: Partial<CrossCuttingConfig>) => void;
    onSave: () => Promise<void> | void;
    saving: boolean;
}

export function PoliciesSection({
    workingHoursStructured,
    fulfillmentSla,
    seasonalPromotions,
    onChangeHours,
    onChangeCrossCutting,
    onSave,
    saving,
}: PoliciesSectionProps) {
    return (
        <div className="card-featured p-6 space-y-7">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                        Бодлого ба хүргэлт
                    </h3>
                    <p className="text-[12px] text-white/45 mt-1 leading-relaxed max-w-2xl">
                        Ажиллах цаг, хариулах SLA, цаг хугацаатай акцаа тохируулна. AI энд оруулсан тоог ам гарган хариулна.
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

            <BusinessHoursPicker
                hours={workingHoursStructured}
                onChange={onChangeHours}
            />

            <div className="border-t border-white/[0.06] pt-6">
                <h4 className="text-[13px] font-semibold text-foreground tracking-[-0.01em] mb-2">
                    Үйлчилгээний баталгаа (SLA)
                </h4>
                <FulfillmentSLAForm
                    sla={fulfillmentSla}
                    onChange={(next) => onChangeCrossCutting({ fulfillment_sla: next })}
                />
            </div>

            <div className="border-t border-white/[0.06] pt-6">
                <h4 className="text-[13px] font-semibold text-foreground tracking-[-0.01em] mb-2">
                    Цаг хугацаатай акц
                </h4>
                <SeasonalPromotionsList
                    promotions={seasonalPromotions}
                    onChange={(next) => onChangeCrossCutting({ seasonal_promotions: next })}
                />
            </div>
        </div>
    );
}
