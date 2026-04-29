'use client';

import { useMemo } from 'react';
import { Wrench, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOOL_DEFINITIONS, type ToolName } from '@/lib/ai/tools/definitions';
import { getAllowedToolsForRole } from '@/lib/ai/agents';
import type { AgentRole, AgentCapability } from '@/lib/ai/agents/types';

const TOOL_LABELS_MN: Record<string, { label: string; description: string }> = {
    add_to_cart: { label: 'Сагсанд нэмэх', description: 'Хэрэглэгч "авмаар" гэвэл барааг сагсанд нэмнэ' },
    view_cart: { label: 'Сагс харах', description: 'Сагсны агуулга, нийт дүн харуулна' },
    remove_from_cart: { label: 'Сагснаас хасах', description: 'Сонгосон барааг сагснаас хасна' },
    checkout: { label: 'Захиалга баталгаажуулах', description: 'Төлбөрийн линк үүсгэн checkout явуулна' },
    create_order: { label: 'Захиалга үүсгэх', description: 'Хэрэглэгчийн өгсөн утсаар шууд захиалга бүртгэнэ' },
    cancel_order: { label: 'Захиалга цуцлах', description: 'Pending захиалгыг цуцлан нөөц сэргээнэ' },
    check_order_status: { label: 'Захиалгын статус', description: '"Захиалга минь хаана?" гэсэн асуултанд хариулна' },
    update_order: { label: 'Захиалга өөрчлөх', description: 'Тоо, тайлбар зэргийг pending захиалга дээр шинэчилнэ' },
    check_delivery_status: { label: 'Хүргэлтийн мэдээлэл', description: 'Хүргэлтийн ETA-г харуулна' },
    book_appointment: { label: 'Цаг товлох', description: 'Тодорхой цагт уулзалт/үйлчилгээ бүртгэнэ' },
    list_appointments: { label: 'Цагнуудыг харах', description: 'Боломжит цаг + хэрэглэгчийн товлосон цагуудыг гаргана' },
    cancel_appointment: { label: 'Цаг цуцлах', description: 'Товлогдсон цагийг цуцалж бусдад нээнэ' },
    show_product_image: { label: 'Бараа зураг', description: 'Тодорхой барааны зураг харуулна' },
    suggest_related_products: { label: 'Холбоотой бараа санал', description: 'Cross-sell, upsell санал болгоно' },
    check_payment_status: { label: 'Төлбөр шалгах', description: 'Гар утгаар төлсөн төлбөрийн статусыг шалгана' },
    log_complaint: { label: 'Гомдол бүртгэх', description: 'Сэтгэл дундуур байдлыг автоматаар илрүүлэн бүртгэнэ' },
    collect_contact_info: { label: 'Утас, хаяг авах', description: 'Захиалга / цаг өгөхийн өмнө холбоо барих мэдээлэл цуглуулна' },
    request_human_support: { label: 'Хүн рүү шилжүүлэх', description: 'Хэрэглэгч хүсэлтэй бол ажилтан рүү шилжүүлнэ' },
    remember_preference: { label: 'Сонголт санах', description: 'Хэмжээ, өнгө, төсөв зэрэг хэрэглэгчийн сонголтыг хадгална' },
};

interface Step4Props {
    role: AgentRole;
    capabilities: AgentCapability[];
    enabledTools: ToolName[];
    onEnabledToolsChange: (tools: ToolName[]) => void;
}

export function Step4Capabilities({
    role,
    capabilities,
    enabledTools,
    onEnabledToolsChange,
}: Step4Props) {
    const allowedToolNames = useMemo(
        () => new Set(getAllowedToolsForRole(role, capabilities)),
        [role, capabilities],
    );

    const availableTools = TOOL_DEFINITIONS.filter((t) => allowedToolNames.has(t.name as ToolName));

    const enabledSet = new Set(enabledTools);

    const toggleTool = (name: ToolName) => {
        if (enabledSet.has(name)) {
            onEnabledToolsChange(enabledTools.filter((t) => t !== name));
        } else {
            onEnabledToolsChange([...enabledTools, name]);
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-[20px] font-semibold text-foreground tracking-tight">
                    AI ямар үйлдэл хийх ёстой вэ?
                </h2>
                <p className="text-[13px] text-white/55 mt-1.5">
                    Сонгосон үүрэгт тохирох tool-ууд. Бүгдийг анхдагч асаалттай үлдээж болно.
                </p>
            </div>

            <section>
                <h3 className="flex items-center gap-2 text-[11.5px] font-semibold text-white/55 uppercase tracking-[0.08em] mb-3">
                    <Wrench className="h-3 w-3" />
                    Боломжит үйлдэл ({availableTools.length})
                </h3>
                <div className="space-y-2">
                    {availableTools.map((tool) => {
                        const meta = TOOL_LABELS_MN[tool.name] ?? {
                            label: tool.name,
                            description: tool.description,
                        };
                        const enabled = enabledSet.size === 0 || enabledSet.has(tool.name as ToolName);
                        return (
                            <label
                                key={tool.name}
                                className={cn(
                                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                                    enabled
                                        ? 'border-[var(--brand-indigo,#4A7CE7)]/40 bg-[var(--brand-indigo,#4A7CE7)]/[0.05]'
                                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 accent-[var(--brand-indigo,#4A7CE7)]"
                                    checked={enabled}
                                    onChange={() => toggleTool(tool.name as ToolName)}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-semibold text-foreground tracking-tight">
                                        {meta.label}
                                    </p>
                                    <p className="text-[11px] text-white/45 mt-0.5">
                                        {meta.description}
                                    </p>
                                </div>
                            </label>
                        );
                    })}
                </div>
                {availableTools.length === 0 && (
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                        <Lock className="h-5 w-5 mx-auto text-white/40 mb-2" />
                        <p className="text-[12px] text-white/55">
                            Энэ үүрэгт зориулагдсан tool алга. Capability нэмж сонгоорой.
                        </p>
                    </div>
                )}

                <p className="text-[11px] text-white/40 mt-3">
                    💡 Хоосон үлдээвэл бүх боломжтой tool автоматаар асаагдана.
                </p>
            </section>
        </div>
    );
}
