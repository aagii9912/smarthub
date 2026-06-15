/**
 * PATCH /api/ai-settings/config
 *
 * Updates the JSONB-backed sections of the shop's AI configuration:
 *   - `cross_cutting`  → merged into `ai_agent_config.cross_cutting`
 *   - `operations`     → merged into `business_setup_data` (keyed by business_type)
 *   - `working_hours_structured` → top-level column
 *   - `mark_completed` → stamps `ai_settings_completed_at = now()`
 *
 * Each section is optional; the caller can patch one or several in a
 * single request. JSONB merges are done in-process (read-modify-write)
 * so sibling keys are preserved instead of overwritten.
 *
 * GET /api/ai-settings/config
 * Returns the current configuration for the caller's shop.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { aiSettingsConfigPatchSchema } from '@/lib/validations/ai-settings';
import { isBusinessType } from '@/lib/constants/business-types';

export async function GET() {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('shops')
            .select(
                'business_type, business_setup_data, ai_agent_config, working_hours_structured, ai_settings_completed_at',
            )
            .eq('id', shop.id)
            .single();

        if (error) {
            logger.error('ai-settings/config GET: select failed', { error });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const aiConfig = (data?.ai_agent_config ?? {}) as Record<string, unknown>;
        const crossCutting = (aiConfig.cross_cutting ?? null) as Record<string, unknown> | null;

        return NextResponse.json({
            business_type: data?.business_type ?? null,
            business_setup_data: data?.business_setup_data ?? null,
            cross_cutting: crossCutting,
            working_hours_structured: data?.working_hours_structured ?? null,
            ai_settings_completed_at: data?.ai_settings_completed_at ?? null,
        });
    } catch (err) {
        logger.error('ai-settings/config GET: error', { error: err });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rawBody = await request.json().catch(() => null);
        if (rawBody === null) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = aiSettingsConfigPatchSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.format() },
                { status: 400 },
            );
        }
        const patch = parsed.data;

        const supabase = supabaseAdmin();

        // Read current JSONB blobs first so we can merge non-destructively.
        const { data: current, error: readErr } = await supabase
            .from('shops')
            .select('business_type, business_setup_data, ai_agent_config')
            .eq('id', shop.id)
            .single();

        if (readErr || !current) {
            logger.error('ai-settings/config PATCH: read current failed', { error: readErr });
            return NextResponse.json({ error: readErr?.message ?? 'Shop not found' }, { status: 500 });
        }

        const update: Record<string, unknown> = {};

        // ── cross_cutting / enabled_tools (merged into ai_agent_config) ──
        if (patch.cross_cutting !== undefined || patch.enabled_tools !== undefined) {
            const existingConfig = (current.ai_agent_config ?? {}) as Record<string, unknown>;
            const existingCC = (existingConfig.cross_cutting ?? {}) as Record<string, unknown>;
            update.ai_agent_config = {
                ...existingConfig,
                ...(patch.cross_cutting !== undefined
                    ? { cross_cutting: { ...existingCC, ...patch.cross_cutting } }
                    : {}),
                ...(patch.enabled_tools !== undefined
                    ? { enabled_tools: patch.enabled_tools }
                    : {}),
            };
        }

        // ── operations (merged into business_setup_data) ──
        if (patch.operations !== undefined) {
            // Defence in depth: don't let a caller change the saved business type
            // through this endpoint — that lives on the shop's top-level column
            // and is set during onboarding. Reject mismatches early.
            const incomingType = patch.operations.business_type;
            const savedType = current.business_type;
            if (savedType && incomingType !== savedType) {
                return NextResponse.json(
                    {
                        error: `business_type mismatch: shop is ${savedType}, payload is ${incomingType}`,
                    },
                    { status: 400 },
                );
            }
            if (!isBusinessType(incomingType)) {
                return NextResponse.json({ error: 'Unknown business_type' }, { status: 400 });
            }

            // Strip the discriminator before merging — the shop already has
            // `business_type` as a top-level column.
            const { business_type: _omit, ...rest } = patch.operations;
            void _omit;
            const existing = (current.business_setup_data ?? {}) as Record<string, unknown>;
            update.business_setup_data = { ...existing, ...rest };
        }

        // ── working_hours_structured ──
        if (patch.working_hours_structured !== undefined) {
            update.working_hours_structured = patch.working_hours_structured;
        }

        // ── mark_completed ──
        if (patch.mark_completed === true) {
            update.ai_settings_completed_at = new Date().toISOString();
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }

        const { error: updateErr } = await supabase
            .from('shops')
            .update(update)
            .eq('id', shop.id);

        if (updateErr) {
            logger.error('ai-settings/config PATCH: update failed', { error: updateErr });
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, updated: Object.keys(update) });
    } catch (err) {
        logger.error('ai-settings/config PATCH: error', { error: err });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
