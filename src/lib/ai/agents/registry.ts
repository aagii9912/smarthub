import type { AgentRole, AgentRoleDefinition, AgentCapability, BusinessRoleRecommendation } from './types';
import type { BusinessType } from '@/lib/constants/business-types';
import type { ToolName } from '@/lib/ai/tools/definitions';
import type { ChatContext } from '@/types/ai';
import { mapPacks } from '@/lib/industry-packs/registry';

import { salesRole } from './roles/sales';
import { bookingRole } from './roles/booking';
import { informationRole } from './roles/information';
import { supportRole } from './roles/support';
import { leadCaptureRole } from './roles/lead-capture';
import { hybridRole, buildHybridRules, getHybridAllowedTools } from './roles/hybrid';

export const AGENT_ROLES: Record<AgentRole, AgentRoleDefinition> = {
    sales: salesRole,
    booking: bookingRole,
    information: informationRole,
    support: supportRole,
    lead_capture: leadCaptureRole,
    hybrid: hybridRole,
};

export const AGENT_ROLE_VALUES: AgentRole[] = [
    'sales',
    'booking',
    'information',
    'support',
    'lead_capture',
    'hybrid',
];

export const AGENT_CAPABILITY_VALUES: AgentCapability[] = [
    'sales',
    'booking',
    'information',
    'support',
    'lead_capture',
];

export function isAgentRole(value: unknown): value is AgentRole {
    return typeof value === 'string' && (AGENT_ROLE_VALUES as string[]).includes(value);
}

export function isAgentCapability(value: unknown): value is AgentCapability {
    return typeof value === 'string' && (AGENT_CAPABILITY_VALUES as string[]).includes(value);
}

/**
 * Recommended default role + capabilities for each business type.
 * Used by setup wizard, smart defaults, and migration logic.
 * Defined per Industry Pack (`pack.ai`).
 */
export const BUSINESS_ROLE_RECOMMENDATIONS: Record<BusinessType, BusinessRoleRecommendation> = mapPacks(
    (pack) => ({ defaultRole: pack.ai.defaultRole, defaultCapabilities: [...pack.ai.defaultCapabilities] }),
);

/**
 * Get the recommended role + capabilities for a business type.
 * Falls back to sales for unknown types.
 */
export function getRecommendedAgentForBusinessType(
    businessType: BusinessType | null | undefined,
): BusinessRoleRecommendation {
    if (!businessType || !(businessType in BUSINESS_ROLE_RECOMMENDATIONS)) {
        return BUSINESS_ROLE_RECOMMENDATIONS.other;
    }
    return BUSINESS_ROLE_RECOMMENDATIONS[businessType];
}

/**
 * Build the full set of role-specific system prompt rules.
 * For hybrid roles, combines rules from each enabled capability.
 */
export function buildRolePromptRules(
    role: AgentRole,
    capabilities: AgentCapability[],
    context: ChatContext,
    hasSalesIntelligence: boolean,
): string {
    if (role === 'hybrid') {
        const caps = capabilities.length > 0 ? capabilities : ['sales'];
        return buildHybridRules(caps as AgentCapability[], context, hasSalesIntelligence);
    }
    return AGENT_ROLES[role].systemPromptRules(context, hasSalesIntelligence);
}

/**
 * Get the union of allowed tools for a role + capabilities combination.
 * For non-hybrid roles, capabilities are ignored.
 */
export function getAllowedToolsForRole(
    role: AgentRole,
    capabilities: AgentCapability[],
): ToolName[] {
    if (role === 'hybrid') {
        const caps = capabilities.length > 0 ? capabilities : ['sales'];
        return getHybridAllowedTools(caps as AgentCapability[]);
    }
    return [...AGENT_ROLES[role].allowedTools];
}

/**
 * Get the role's title for use in the system prompt opening line.
 */
export function getRoleTitle(role: AgentRole, locale: 'mn' | 'en' = 'mn'): string {
    return AGENT_ROLES[role].roleTitle[locale];
}

export function getRoleGoalLine(role: AgentRole, locale: 'mn' | 'en' = 'mn'): string {
    return AGENT_ROLES[role].goalLine[locale];
}

export function getRoleDefaultEmotion(role: AgentRole) {
    return AGENT_ROLES[role].defaultEmotion;
}
