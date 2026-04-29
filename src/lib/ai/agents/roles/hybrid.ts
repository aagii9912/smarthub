import type { AgentRoleDefinition, AgentCapability } from '../types';
import type { ToolName } from '@/lib/ai/tools/definitions';
import { salesRole } from './sales';
import { bookingRole } from './booking';
import { informationRole } from './information';
import { supportRole } from './support';
import { leadCaptureRole } from './lead-capture';
import type { ChatContext } from '@/types/ai';

const CAPABILITY_ROLES = {
    sales: salesRole,
    booking: bookingRole,
    information: informationRole,
    support: supportRole,
    lead_capture: leadCaptureRole,
} as const;

const CAPABILITY_LABEL_MN: Record<AgentCapability, string> = {
    sales: 'борлуулалт',
    booking: 'цаг товлолт',
    information: 'мэдээлэл',
    support: 'дэмжлэг',
    lead_capture: 'мэдээлэл цуглуулалт',
};

/**
 * Combine the rule sets of multiple capability roles. Each section is wrapped
 * in a clearly delimited block so the LLM can pick the right behaviour based
 * on the user's intent.
 */
function combineRules(
    capabilities: AgentCapability[],
    context: ChatContext,
    hasSalesIntelligence: boolean,
): string {
    if (capabilities.length === 0) return '';

    const dedup = Array.from(new Set(capabilities));
    const sections = dedup.map((cap) => {
        const role = CAPABILITY_ROLES[cap];
        const label = CAPABILITY_LABEL_MN[cap];
        const body = role.systemPromptRules(context, hasSalesIntelligence);
        return `══════════════════════════════════════
[${label.toUpperCase()} — ${cap}]
══════════════════════════════════════
${body}`;
    });

    const intentRouter = `🎯 HYBRID AGENT: ОЛОН ҮҮРЭГ
Чи доорх ${dedup.length} үүргийг хослуулсан туслах. Хэрэглэгчийн зорилго (intent)-оос хамаарч зөв үүргийн дүрмийг хэрэгжүүл:
${dedup.map((cap) => `- ${CAPABILITY_LABEL_MN[cap]} (${cap})`).join('\n')}

ХЭРХЭН ШИЙДЭХ ВЭ:
- Худалдаа, бараа, захиалга, төлбөр → SALES дүрмүүд
- Цаг товлох, ширээ, уулзалт → BOOKING дүрмүүд
- Лавлагаа, FAQ, ажлын цаг → INFORMATION дүрмүүд
- Гомдол, асуудал, удаашрал → SUPPORT дүрмүүд
- Үнэ асуух, сонирхох, том худалдаа → LEAD_CAPTURE дүрмүүд

Тодорхойгүй бол асуу: "Та юу хиймээр байна?" гэж эелдэг тодруул.`;

    return [intentRouter, ...sections].join('\n\n');
}

/**
 * The hybrid role is a wrapper — its real behaviour comes from the
 * `capabilities` list passed via the shop config. The exported definition
 * carries placeholder defaults so it can be listed in pickers; live logic is
 * realised through `getHybridRole(capabilities)`.
 */
export const hybridRole: AgentRoleDefinition = {
    id: 'hybrid',
    label: { mn: 'Олон үүрэг', en: 'Hybrid' },
    description: {
        mn: 'Хэд хэдэн үүргийг хослуулсан туслах. Жишээ нь ресторанд: захиалга авах + ширээ товлох + асуултад хариулах.',
        en: 'Combines multiple capabilities (e.g. restaurant: sales + booking + information). Routes intent automatically.',
    },
    iconName: 'layers',
    accentClass: 'bg-indigo-100 text-indigo-700',
    defaultEmotion: 'friendly',
    // The actual tool list is computed dynamically based on enabled capabilities.
    allowedTools: [
        ...new Set([
            ...salesRole.allowedTools,
            ...bookingRole.allowedTools,
            ...informationRole.allowedTools,
            ...supportRole.allowedTools,
            ...leadCaptureRole.allowedTools,
        ]),
    ] as ToolName[],
    requiredContextFields: [],
    roleTitle: { mn: 'олон үүрэгт туслах', en: 'multi-purpose assistant' },
    goalLine: {
        mn: 'Зорилго: Хэрэглэгчийн зорилгод тохирсон үүргийг идэвхжүүлж тусална.',
        en: 'Goal: Detect the user intent and serve it through the right capability.',
    },
    systemPromptRules: (context, hasSalesIntelligence) => {
        // Default to all capabilities when called directly (placeholder).
        const defaultCaps: AgentCapability[] = ['sales', 'booking', 'information'];
        return combineRules(defaultCaps, context, hasSalesIntelligence);
    },
    previewScenarios: [
        {
            user: { mn: 'Энэ хоол байгаа юу?', en: 'Do you have this dish?' },
            expectedTools: ['show_product_image'],
        },
        {
            user: { mn: 'Маргааш ширээ товлоё', en: 'Book a table for tomorrow' },
            expectedTools: ['list_appointments', 'book_appointment'],
        },
        {
            user: { mn: 'Хэдэн цаг хүртэл нээлттэй вэ?', en: 'What hours are you open?' },
            expectedTools: [],
        },
    ],
};

/**
 * Build a system-prompt-rules function for a specific hybrid configuration.
 * Used by buildSystemPrompt when the shop role is `hybrid`.
 */
export function buildHybridRules(
    capabilities: AgentCapability[],
    context: ChatContext,
    hasSalesIntelligence: boolean,
): string {
    return combineRules(capabilities, context, hasSalesIntelligence);
}

/**
 * Compute the union of allowed tools for a given capability set.
 */
export function getHybridAllowedTools(capabilities: AgentCapability[]): ToolName[] {
    if (capabilities.length === 0) return [];
    const tools = new Set<ToolName>();
    for (const cap of capabilities) {
        for (const tool of CAPABILITY_ROLES[cap].allowedTools) {
            tools.add(tool);
        }
    }
    return Array.from(tools);
}
