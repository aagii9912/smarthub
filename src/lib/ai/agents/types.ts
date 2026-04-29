/**
 * Agent role system types.
 *
 * An "agent role" describes the primary purpose of the AI for a given shop —
 * sales, booking, information lookup, support, lead capture, or a hybrid that
 * combines multiple capabilities.
 *
 * Role drives system prompt rules, allowed tool list, default emotion, and
 * which dashboard surfaces are relevant.
 */

import type { ChatContext } from '@/types/ai';
import type { ToolName } from '@/lib/ai/tools/definitions';
import type { BusinessType } from '@/lib/constants/business-types';

export type AgentRole =
    | 'sales'
    | 'booking'
    | 'information'
    | 'support'
    | 'lead_capture'
    | 'hybrid';

export type AgentCapability = Exclude<AgentRole, 'hybrid'>;

export interface LocalizedString {
    mn: string;
    en: string;
}

export interface AgentPreviewScenario {
    user: LocalizedString;
    expectedTools?: ToolName[];
    note?: LocalizedString;
}

export interface AgentRoleDefinition {
    id: AgentRole;
    label: LocalizedString;
    description: LocalizedString;
    iconName: string;
    accentClass: string;
    defaultEmotion: 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';
    allowedTools: readonly ToolName[];
    requiredContextFields: readonly (keyof ChatContext)[];
    /**
     * Build the role-specific portion of the system prompt.
     * Cross-cutting rules (emotion, conversation patterns, shared info) are
     * merged in by `buildSystemPrompt`.
     */
    systemPromptRules: (context: ChatContext, hasSalesIntelligence: boolean) => string;
    /**
     * Default introductory line used for the AI's identity and goal.
     * Rendered as: `Чи бол "${shopName}" дэлгүүрийн ${roleTitle}.`
     */
    roleTitle: LocalizedString;
    goalLine: LocalizedString;
    previewScenarios: AgentPreviewScenario[];
}

export interface AgentTemplate {
    id: string;
    businessType: BusinessType;
    role: AgentRole;
    capabilities: AgentCapability[];
    defaultName: string;
    defaultEmotion: 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';
    defaultInstructions: string;
    suggestedFAQs: { question: string; answer: string }[];
    suggestedSlogans?: string[];
    suggestedQuickReplies?: { trigger_words: string[]; response: string }[];
    label: LocalizedString;
    description: LocalizedString;
}

export interface AgentConfig {
    role: AgentRole;
    capabilities: AgentCapability[];
    name?: string | null;
    enabledTools?: ToolName[] | null;
    extra?: Record<string, unknown>;
}

export interface BusinessRoleRecommendation {
    defaultRole: AgentRole;
    defaultCapabilities: AgentCapability[];
}
