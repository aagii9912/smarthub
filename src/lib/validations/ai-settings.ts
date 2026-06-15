/**
 * AI Settings validation schemas — Phase 1 Foundation.
 *
 * These schemas are consumed by:
 *   - `/api/ai-settings/config` PATCH endpoint (server-side validation)
 *   - The dashboard AI settings page (client-side preflight before save)
 *
 * The discriminated union `OperationsSchema` lets us validate
 * business-type-specific payloads without losing type safety. Every field
 * is `.optional()` so the UI can save partial drafts; the prompt builder
 * already skips empty values.
 */

import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────
// Primitives
// ────────────────────────────────────────────────────────────────────

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dayHoursSchema = z
    .object({
        open: z.string().regex(HH_MM_REGEX, 'open must be HH:mm').optional(),
        close: z.string().regex(HH_MM_REGEX, 'close must be HH:mm').optional(),
        closed: z.boolean().optional(),
    })
    .strict();

export const weeklyHoursSchema = z
    .object({
        mon: dayHoursSchema.optional(),
        tue: dayHoursSchema.optional(),
        wed: dayHoursSchema.optional(),
        thu: dayHoursSchema.optional(),
        fri: dayHoursSchema.optional(),
        sat: dayHoursSchema.optional(),
        sun: dayHoursSchema.optional(),
    })
    .strict();

export const brandVoiceSchema = z.enum([
    'formal',
    'casual',
    'playful',
    'luxurious',
    'technical',
]);

export const supportedLanguageSchema = z.enum(['mn', 'en', 'ko', 'ja']);

export const seasonalPromotionSchema = z
    .object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        starts_at: z.string().datetime().nullable().optional(),
        ends_at: z.string().datetime().nullable().optional(),
    })
    .strict();

export const escalationRulesSchema = z
    .object({
        on_complaint: z.enum(['log', 'handoff']).optional(),
        handoff_phone: z.string().max(50).optional(),
        after_hours_message: z.string().max(500).optional(),
    })
    .strict();

export const fulfillmentSlaSchema = z
    .object({
        response_minutes: z.number().int().min(0).max(60 * 24).optional(),
        ship_within_hours: z.number().int().min(0).max(24 * 30).optional(),
        refund_within_days: z.number().int().min(0).max(365).optional(),
    })
    .strict();

// ────────────────────────────────────────────────────────────────────
// Cross-cutting (Brand & Policies tabs)
// ────────────────────────────────────────────────────────────────────

export const salesAssertivenessSchema = z.enum(['soft', 'balanced', 'assertive']);
export const responseLengthSchema = z.enum(['short', 'medium', 'long']);
export const emojiUsageSchema = z.enum(['none', 'minimal', 'frequent']);

export const crossCuttingSchema = z
    .object({
        brand_voice: brandVoiceSchema.optional(),
        prohibited_topics: z.array(z.string().min(1).max(200)).max(50).optional(),
        escalation_rules: escalationRulesSchema.optional(),
        supported_languages: z.array(supportedLanguageSchema).max(4).optional(),
        seasonal_promotions: z.array(seasonalPromotionSchema).max(20).optional(),
        fulfillment_sla: fulfillmentSlaSchema.optional(),
        // Owner-tunable reply style (assertiveness / length / emoji).
        sales_assertiveness: salesAssertivenessSchema.optional(),
        response_length: responseLengthSchema.optional(),
        emoji_usage: emojiUsageSchema.optional(),
    })
    .strict();

// ────────────────────────────────────────────────────────────────────
// Per-business-type operations payloads
// ────────────────────────────────────────────────────────────────────

const optString = (max = 500) => z.string().max(max).optional();
const optInt = (min = 0, max = 1_000_000) => z.number().int().min(min).max(max).optional();

const serviceCatalogItemSchema = z
    .object({
        name: z.string().min(1).max(120),
        duration: z.number().int().min(0).max(60 * 24).optional(),
        price: z.number().min(0).max(1_000_000_000).optional(),
    })
    .strict();

const specialistSchema = z
    .object({
        name: z.string().min(1).max(120),
        specialty: z.string().max(200).optional(),
    })
    .strict();

export const retailOperationsSchema = z
    .object({
        business_type: z.literal('retail'),
        inventory_method: z.enum(['manual', 'barcode']).optional(),
        warehouse_address: optString(),
        tax_registered: z.boolean().optional(),
        product_categories: z.array(z.string().min(1).max(100)).max(50).optional(),
        brand_origin: z.enum(['local', 'imported', 'mixed']).optional(),
        warranty_policy: optString(),
        loyalty_program: optString(),
    })
    .strict();

export const restaurantOperationsSchema = z
    .object({
        business_type: z.literal('restaurant'),
        table_count: optInt(0, 500),
        delivery_enabled: z.boolean().optional(),
        delivery_zones: optString(),
        avg_prep_minutes: optInt(0, 240),
        menu_categories: z.array(z.string().min(1).max(100)).max(50).optional(),
        dietary_options: z.array(z.string().min(1).max(50)).max(20).optional(),
        peak_hours: optString(),
        reservation_policy: optString(),
        min_order_value: optInt(0, 10_000_000),
        service_fee_percent: z.number().min(0).max(100).optional(),
    })
    .strict();

export const serviceOperationsSchema = z
    .object({
        business_type: z.literal('service'),
        staff_count: optInt(0, 1000),
        default_duration_minutes: optInt(0, 600),
        booking_method: z.enum(['manual', 'calendar']).optional(),
        business_hours: optString(),
        service_catalog: z.array(serviceCatalogItemSchema).max(100).optional(),
        cancellation_policy: optString(),
        advance_booking_days: optInt(0, 365),
        requires_deposit: z.boolean().optional(),
        home_visit_enabled: z.boolean().optional(),
    })
    .strict();

export const ecommerceOperationsSchema = z
    .object({
        business_type: z.literal('ecommerce'),
        shipping_zones: optString(),
        payment_methods: z.array(z.string().min(1).max(50)).max(20).optional(),
        inventory_tracking: z.boolean().optional(),
        dispatch_sla_hours: optInt(0, 24 * 30),
        return_window_days: optInt(0, 365),
        size_chart_url: optString(),
        brand_story: optString(2000),
        pre_order_policy: optString(),
    })
    .strict();

export const beautyOperationsSchema = z
    .object({
        business_type: z.literal('beauty'),
        staff_count: optInt(0, 100),
        salon_address: optString(),
        services_at_home: z.boolean().optional(),
        default_duration_minutes: optInt(0, 600),
        service_menu: z.array(serviceCatalogItemSchema).max(100).optional(),
        specialist_list: z.array(specialistSchema).max(50).optional(),
        walk_in_accepted: z.boolean().optional(),
        aftercare_instructions: optString(1000),
    })
    .strict();

export const healthcareOperationsSchema = z
    .object({
        business_type: z.literal('healthcare'),
        doctor_count: optInt(0, 1000),
        specialties: optString(),
        business_hours: optString(),
        insurance_accepted: z.array(z.string().min(1).max(100)).max(30).optional(),
        appointment_required: z.boolean().optional(),
        emergency_handling: optString(),
        triage_disclaimer: optString(1000),
    })
    .strict();

export const educationOperationsSchema = z
    .object({
        business_type: z.literal('education'),
        course_types: optString(),
        student_capacity: optInt(0, 1000),
        business_hours: optString(),
        levels_offered: z.array(z.string().min(1).max(50)).max(20).optional(),
        class_format: z.array(z.string().min(1).max(50)).max(10).optional(),
        intake_dates: optString(),
        certification_offered: z.boolean().optional(),
        trial_class_available: z.boolean().optional(),
    })
    .strict();

export const realestateAutoOperationsSchema = z
    .object({
        business_type: z.literal('realestate_auto'),
        category: z.enum(['realestate', 'auto', 'both']).optional(),
        agent_count: optInt(0, 500),
        service_areas: optString(),
        listing_types: z.array(z.string().min(1).max(50)).max(10).optional(),
        financing_partners: optString(),
        inspection_policy: optString(),
        lead_qualification_questions: z.array(z.string().min(1).max(300)).max(20).optional(),
    })
    .strict();

// Discriminated union — picks the right schema based on `business_type`.
// `other` is intentionally omitted: that business type has no operations
// payload (the Operations tab is hidden in the UI).
export const operationsSchema = z.discriminatedUnion('business_type', [
    retailOperationsSchema,
    restaurantOperationsSchema,
    serviceOperationsSchema,
    ecommerceOperationsSchema,
    beautyOperationsSchema,
    healthcareOperationsSchema,
    educationOperationsSchema,
    realestateAutoOperationsSchema,
]);

// ────────────────────────────────────────────────────────────────────
// PATCH /api/ai-settings/config body
// ────────────────────────────────────────────────────────────────────

export const aiSettingsConfigPatchSchema = z
    .object({
        cross_cutting: crossCuttingSchema.partial().optional(),
        // Replaces ai_agent_config.enabled_tools only; sibling keys are preserved.
        enabled_tools: z.array(z.string().min(1).max(100)).max(50).optional(),
        operations: operationsSchema.optional(),
        working_hours_structured: weeklyHoursSchema.optional(),
        mark_completed: z.boolean().optional(),
    })
    .strict()
    .refine(
        d =>
            d.cross_cutting !== undefined ||
            d.enabled_tools !== undefined ||
            d.operations !== undefined ||
            d.working_hours_structured !== undefined ||
            d.mark_completed !== undefined,
        { message: 'At least one section must be provided' },
    );

export type AISettingsConfigPatch = z.infer<typeof aiSettingsConfigPatchSchema>;
export type OperationsPayload = z.infer<typeof operationsSchema>;
export type CrossCuttingPayload = z.infer<typeof crossCuttingSchema>;
export type WeeklyHoursPayload = z.infer<typeof weeklyHoursSchema>;
