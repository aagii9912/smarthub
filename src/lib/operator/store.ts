/**
 * Operator runtime-ийн DB хандалт (`shop_agents`, `agent_runs`).
 * Dispatcher энэ интерфэйсээр л DB-тэй ажилладаг тул тестэд in-memory
 * хувилбараар солих боломжтой.
 */

import { supabaseAdmin } from '@/lib/supabase';
import type { AgentRunRow, RunStatus, ShopAgentRow, TriggerKind } from './types';

export interface EnabledAgent extends ShopAgentRow {
    business_type: string | null;
}

export interface NewRun {
    shop_id: string;
    agent_slug: string;
    trigger_kind: TriggerKind;
    subject_type: string;
    subject_id: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
    scheduled_for: string;
}

export interface RunPatch {
    status: RunStatus;
    payload?: Record<string, unknown>;
    result?: Record<string, unknown> | null;
    error?: string | null;
    tokens_used?: number;
    model?: string | null;
    scheduled_for?: string;
    finished_at?: string | null;
}

export interface OperatorStore {
    /** Асаалттай automation-ууд, хамгийн удаан ажиллаагүй нь эхэнд. */
    listEnabledAgents(limit: number): Promise<EnabledAgent[]>;
    /** Давхардсан idempotency_key-ийг алгасна; шинээр нэмэгдсэн тоог буцаана. */
    enqueueRuns(rows: NewRun[]): Promise<number>;
    touchAgent(agentId: string, at: string): Promise<void>;
    /** Гүйцэтгэх цаг болсон run-уудыг атомаар авна (FOR UPDATE SKIP LOCKED). */
    claimRuns(limit: number): Promise<AgentRunRow[]>;
    getShopAgent(shopId: string, slug: string): Promise<ShopAgentRow | null>;
    updateRun(id: string, patch: RunPatch): Promise<void>;
}

export function supabaseOperatorStore(): OperatorStore {
    const db = supabaseAdmin();

    return {
        async listEnabledAgents(limit) {
            const { data, error } = await db
                .from('shop_agents')
                .select('id, shop_id, agent_slug, enabled, mode, config, last_run_at, shops(business_type)')
                .eq('enabled', true)
                .order('last_run_at', { ascending: true, nullsFirst: true })
                .limit(limit);
            if (error) throw new Error(`listEnabledAgents: ${error.message}`);
            return (data ?? []).map((row) => {
                const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
                const { shops: _shops, ...agent } = row;
                return {
                    ...(agent as ShopAgentRow),
                    business_type: (shop as { business_type?: string | null } | null)?.business_type ?? null,
                };
            });
        },

        async enqueueRuns(rows) {
            if (rows.length === 0) return 0;
            const { data, error } = await db
                .from('agent_runs')
                .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true })
                .select('id');
            if (error) throw new Error(`enqueueRuns: ${error.message}`);
            return data?.length ?? 0;
        },

        async touchAgent(agentId, at) {
            await db.from('shop_agents').update({ last_run_at: at }).eq('id', agentId);
        },

        async claimRuns(limit) {
            const { data, error } = await db.rpc('claim_agent_runs', { p_limit: limit });
            if (error) throw new Error(`claimRuns: ${error.message}`);
            return (data ?? []) as AgentRunRow[];
        },

        async getShopAgent(shopId, slug) {
            const { data } = await db
                .from('shop_agents')
                .select('id, shop_id, agent_slug, enabled, mode, config, last_run_at')
                .eq('shop_id', shopId)
                .eq('agent_slug', slug)
                .maybeSingle();
            return (data as ShopAgentRow | null) ?? null;
        },

        async updateRun(id, patch) {
            const { error } = await db.from('agent_runs').update(patch).eq('id', id);
            if (error) throw new Error(`updateRun: ${error.message}`);
        },
    };
}
