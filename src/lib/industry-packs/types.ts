/**
 * Industry Pack — нэг салбарын (business_type) бүх тодорхойлолт нэг дор.
 *
 * Өмнө нь салбар бүрийн мэдээлэл ~8 газар тархсан байсан (business-types,
 * archetypes, agents/registry, PromptService, api/shop …). Одоо тэдгээр нь
 * бүгд `INDUSTRY_PACKS`-аас үүсвэрлэгдэнэ. Шинэ салбар нэмэх = `builtin/`
 * дотор нэг файл + `registry.ts`-д бүртгэх (+ шаардлагатай бол AI settings-ийн
 * Zod schema ба UI panel; parity тест үүнийг сануулна).
 *
 * Энэ файл зөвхөн төрөл агуулна — runtime import байхгүй тул бусад модуль
 * (business-types, archetypes, agents) эндээс циклгүйгээр импортлоно.
 */

import type { LucideIcon } from 'lucide-react';
import type { AgentCapability, AgentRole } from '@/lib/ai/agents/types';

export type DashboardArchetype = 'commerce' | 'booking' | 'lead';

export interface DashboardBlocks {
    commerce: boolean;
    booking: boolean;
    lead: boolean;
}

export interface BusinessTypeMeta {
    label: string;
    description: string;
    icon: LucideIcon;
    productNoun: string;
    productNounSingular: string;
    hasOperations: boolean;
    aiTemplate: 'general' | 'clothing' | 'restaurant' | 'beauty' | 'tech';
    accentClass: string;
}

export type OperationsFieldType = 'number' | 'text' | 'boolean' | 'radio' | 'multi-checkbox';

export interface OperationsField {
    key: string;
    label: string;
    type: OperationsFieldType;
    placeholder?: string;
    options?: { value: string; label: string }[];
    min?: number;
    max?: number;
    helpText?: string;
}

export interface OperationsConfig {
    title: string;
    subtitle: string;
    fields: OperationsField[];
}

/** `shops.business_setup_data` — салбар бүрийн нэмэлт мэдээлэл (JSONB). */
export type SetupData = Record<string, unknown>;

export interface IndustryPack {
    /** `shops.business_type`-д хадгалагдах утга. */
    id: string;
    meta: BusinessTypeMeta;
    /** Dashboard-ийн үндсэн layout. */
    archetype: DashboardArchetype;
    /** Тооцоолох dashboard блокууд (холимог бизнест хэд хэд). */
    blocks: DashboardBlocks;
    /** Setup wizard-ийн "Үйл ажиллагаа" алхмын асуултууд; null бол алхам алгасна. */
    operations: OperationsConfig | null;
    /** Каталог: `stock` = үлдэгдэлтэй бараа, `listing` = зар (үл хөдлөх, авто). */
    catalog: { mode: 'stock' | 'listing' };
    /** AI агентын санал болгох анхны role, capability. */
    ai: { defaultRole: AgentRole; defaultCapabilities: AgentCapability[] };
    /** System prompt дахь салбарын хэсэг. */
    prompt: {
        sectionLabel: string;
        /** `business_setup_data`-аас prompt-ын мөрүүд гаргана; байхгүй бол хэсэг гарахгүй. */
        renderSetup?: (data: SetupData) => string[];
    };
}
