/**
 * Эзний automation тохиргоо — dashboard API-ийн сервер логик.
 *
 * `shop_agents`-д мөр байхгүй = унтраалттай. Эзэн асаахад мөр үүсч,
 * automation-ий default горим авна. Зөвхөн дэлгүүрийн одоогийн pack-ийн
 * automation-уудыг асааж болно.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { getPack, isBusinessType } from '@/lib/industry-packs/registry';
import { PACK_AUTOMATIONS, automationSlug } from './automations';
import { configSchemaFor } from './automations/shared';
import type { AutomationConfigField, AutomationDef, AutomationMode, ShopAgentRow } from './types';

export interface ShopAutomationView {
    slug: string;
    key: string;
    label: string;
    description: string;
    kind: AutomationDef['kind'];
    usesLLM: boolean;
    recommended: boolean;
    configFields: AutomationConfigField[];
    enabled: boolean;
    mode: AutomationMode;
    config: Record<string, unknown>;
    lastRunAt: string | null;
}

export async function loadShopBusinessType(shopId: string): Promise<string | null> {
    const { data } = await supabaseAdmin().from('shops').select('business_type').eq('id', shopId).maybeSingle();
    return (data?.business_type as string | null) ?? null;
}

export function automationsForPack(businessType: string | null): AutomationDef[] {
    return isBusinessType(businessType) ? (PACK_AUTOMATIONS[businessType] ?? []) : [];
}

export async function listShopAutomations(shopId: string, businessType: string | null): Promise<ShopAutomationView[]> {
    const defs = automationsForPack(businessType);
    if (defs.length === 0 || !businessType) return [];

    const { data } = await supabaseAdmin()
        .from('shop_agents')
        .select('id, shop_id, agent_slug, enabled, mode, config, last_run_at')
        .eq('shop_id', shopId);
    const rows = new Map(((data ?? []) as ShopAgentRow[]).map((r) => [r.agent_slug, r]));

    return defs.map((def) => {
        const slug = automationSlug(businessType, def.key);
        const row = rows.get(slug);
        return {
            slug,
            key: def.key,
            label: def.label,
            description: def.description,
            kind: def.kind,
            usesLLM: def.usesLLM,
            recommended: def.defaultEnabled,
            configFields: def.configFields ?? [],
            enabled: row?.enabled ?? false,
            mode: row?.mode ?? def.defaultMode,
            config: row?.config ?? {},
            lastRunAt: row?.last_run_at ?? null,
        };
    });
}

export type UpdateAutomationResult =
    | { ok: true; automation: ShopAutomationView }
    | { ok: false; status: 400 | 404; error: string };

export async function updateShopAutomation(
    shopId: string,
    businessType: string | null,
    slug: string,
    patch: { enabled?: boolean; mode?: AutomationMode; config?: Record<string, unknown> },
): Promise<UpdateAutomationResult> {
    const def = automationsForPack(businessType).find((d) => businessType && automationSlug(businessType, d.key) === slug);
    if (!def || !getPack(businessType)) {
        return { ok: false, status: 404, error: 'Энэ automation таны салбарт байхгүй' };
    }

    let config: Record<string, unknown> | undefined;
    if (patch.config !== undefined) {
        if (!def.configFields?.length) return { ok: false, status: 400, error: 'Энэ automation тохиргоогүй' };
        const parsed = configSchemaFor(def.configFields).safeParse(patch.config);
        if (!parsed.success) return { ok: false, status: 400, error: 'Тохиргоо буруу' };
        config = parsed.data;
    }

    const db = supabaseAdmin();
    const { data: existing } = await db
        .from('shop_agents')
        .select('id')
        .eq('shop_id', shopId)
        .eq('agent_slug', slug)
        .maybeSingle();

    const values = {
        ...(patch.enabled !== undefined && { enabled: patch.enabled }),
        ...(patch.mode !== undefined && { mode: patch.mode }),
        ...(config !== undefined && { config }),
    };

    const { error } = existing
        ? await db.from('shop_agents').update(values).eq('id', existing.id).eq('shop_id', shopId)
        : await db.from('shop_agents').insert({
              shop_id: shopId,
              agent_slug: slug,
              enabled: patch.enabled ?? true,
              mode: patch.mode ?? def.defaultMode,
              config: config ?? {},
          });
    if (error) throw new Error(error.message);

    const views = await listShopAutomations(shopId, businessType);
    const automation = views.find((v) => v.slug === slug);
    if (!automation) return { ok: false, status: 404, error: 'Automation олдсонгүй' };
    return { ok: true, automation };
}
