'use client';

import type { ReactNode } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BUSINESS_TYPES, type BusinessType } from '@/lib/constants/business-types';
import { RetailPanel } from './RetailPanel';
import { RestaurantPanel } from './RestaurantPanel';
import { ServicePanel } from './ServicePanel';
import { EcommercePanel } from './EcommercePanel';
import { BeautyPanel } from './BeautyPanel';
import { HealthcarePanel } from './HealthcarePanel';
import { EducationPanel } from './EducationPanel';
import { RealestateAutoPanel } from './RealestateAutoPanel';
import type { Setup, SetField } from './utils';

interface OperationsPanelProps {
    businessType: BusinessType | null;
    data: Setup;
    setField: SetField;
    onSave: () => Promise<void> | void;
    saving: boolean;
}

type PanelComponent = (props: { data: Setup; setField: SetField }) => ReactNode;

// Industry Pack бүрийн "Бизнесийн мэдээлэл" panel. Record тул шинэ pack
// нэмэхэд энд panel (эсвэл null) бүртгэхгүй бол TypeScript алдаа заана.
const PANELS: Record<BusinessType, PanelComponent | null> = {
    retail: RetailPanel,
    restaurant: RestaurantPanel,
    service: ServicePanel,
    ecommerce: EcommercePanel,
    beauty: BeautyPanel,
    healthcare: HealthcarePanel,
    education: EducationPanel,
    realestate_auto: RealestateAutoPanel,
    other: null,
};

function panelFor(type: BusinessType, data: Setup, setField: SetField) {
    const Panel = PANELS[type];
    return Panel ? <Panel data={data} setField={setField} /> : null;
}

export function OperationsPanel({ businessType, data, setField, onSave, saving }: OperationsPanelProps) {
    if (!businessType) {
        return (
            <div className="card-featured p-6">
                <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em] mb-2">
                    Бизнесийн мэдээлэл
                </h3>
                <p className="text-[12.5px] text-white/45 italic">
                    Бизнесийн төрөл сонгогдоогүй байна. Setup wizard-аар бизнесийн төрлөө сонгоно уу.
                </p>
            </div>
        );
    }

    if (businessType === 'other') {
        return (
            <div className="card-featured p-6">
                <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em] mb-2">
                    Бизнесийн мэдээлэл
                </h3>
                <p className="text-[12.5px] text-white/45 leading-relaxed">
                    "Бусад" төрлийн бизнест тусгайлсан мэдээлэл шаардлагагүй. Шаардлагатай мэдээллээ "Мэдлэг"
                    tab дээрх "Тусгай мэдлэг" хэсэгт оруулна уу.
                </p>
            </div>
        );
    }

    const meta = BUSINESS_TYPES[businessType];
    const panel = panelFor(businessType, data, setField);

    return (
        <div className="card-featured p-6 space-y-7">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                        {meta?.label ?? 'Бизнесийн мэдээлэл'}
                    </h3>
                    <p className="text-[12px] text-white/45 mt-1 leading-relaxed max-w-2xl">
                        Энэ хэсэгт оруулсан мэдээлэл AI-д шууд орж, хэрэглэгчдэд тухайн бизнест зориулсан
                        тодорхой хариулт өгөхөд тусална.
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

            {panel}
        </div>
    );
}
