/**
 * Operator dispatcher — `/api/cron/agent-scheduler` 5 минут тутам дуудна.
 *
 * Нэг tick хоёр үе шаттай:
 *   1. Plan — асаалттай automation бүрийн `select()`-ийг ажиллуулж олдсон
 *      ажлуудыг `agent_runs`-д дараалуулна. idempotency_key давхардлыг алгасна.
 *   2. Execute — гүйцэтгэх цаг болсон run-уудыг атомаар авч (SKIP LOCKED)
 *      гүйцэтгэнэ. "approve" горимтой мессеж эзний батлалтыг хүлээнэ.
 *
 * Хоёр tick зэрэг ажилласан ч аюулгүй (DB түвшний хамгаалалт), тиймээс
 * тусдаа түгжээ хэрэггүй. Vercel-ийн 60 сек хязгаараас өмнө (`budgetMs`)
 * зогсоож үлдсэнийг дараагийн tick-д үлдээнэ.
 */

import { logger } from '@/lib/utils/logger';
import { persistTokenUsage } from '@/lib/ai/tokenUsage';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';
import { PACK_AUTOMATIONS, findAutomation, type AutomationRegistry } from './automations';
import { supabaseOperatorStore, type OperatorStore, type NewRun } from './store';
import type {
    AgentRunRow,
    AutomationContext,
    AutomationDef,
    RunResult,
    RunStatus,
    ShopAgentRow,
} from './types';

export const MAX_ATTEMPTS = 3;
const PLAN_AGENT_LIMIT = 200;
const CLAIM_BATCH = 25;

export function idempotencyKey(slug: string, subjectId: string, windowKey: string): string {
    return `${slug}:${subjectId}:${windowKey}`;
}

/** Дахин оролдох цаг: 5, 10, 15 минутын дараа. */
export function nextRetryAt(attempts: number, now: Date): Date {
    return new Date(now.getTime() + Math.max(1, attempts) * 5 * 60_000);
}

/** `intervalMinutes`-тэй automation-ий select()-ийг тэр давтамжаас олон ажиллуулахгүй. */
export function isDueForSelect(def: AutomationDef, lastRunAt: string | null, now: Date): boolean {
    if (!def.intervalMinutes || !lastRunAt) return true;
    return now.getTime() - new Date(lastRunAt).getTime() >= def.intervalMinutes * 60_000;
}

/** Эзний зөвшөөрөл шаардлагатай эсэх — зөвхөн үйлчлүүлэгч рүү чиглэсэн үйлдэлд. */
export function needsApproval(def: AutomationDef, agent: ShopAgentRow, run: AgentRunRow): boolean {
    const outward = def.kind === 'customer_message' || def.kind === 'invoice';
    return outward && agent.mode === 'approve' && run.payload.approved !== true;
}

export interface DispatcherDeps {
    store: OperatorStore;
    registry: AutomationRegistry;
    now: () => Date;
    /** Эцсийн алдаа / LLM хэрэглээг гадагш мэдээлэх (тестэд хоосон). */
    notifyOwnerOfFailure: (shopId: string, slug: string, error: string) => Promise<void>;
    meterTokens: (shopId: string, tokens: NonNullable<RunResult['tokens']>) => Promise<void>;
}

export interface TickSummary {
    planned: number;
    claimed: number;
    outcomes: Partial<Record<RunStatus, number>>;
    durationMs: number;
    outOfBudget: boolean;
}

function defaultDeps(): DispatcherDeps {
    return {
        store: supabaseOperatorStore(),
        registry: PACK_AUTOMATIONS,
        now: () => new Date(),
        async notifyOwnerOfFailure(shopId, slug, error) {
            try {
                if (!(await isNotificationEnabled(shopId, 'automation'))) return;
                await sendPushNotification(shopId, {
                    title: '⚠️ Автомат үйлдэл амжилтгүй',
                    body: `${slug}: ${error.slice(0, 140)}`,
                    url: '/dashboard',
                    tag: `operator-failed-${slug}`,
                });
            } catch {
                // non-critical
            }
        },
        async meterTokens(shopId, tokens) {
            await persistTokenUsage(shopId, tokens.used, tokens.feature, { model: tokens.model });
        },
    };
}

async function planPhase(deps: DispatcherDeps, deadline: number): Promise<number> {
    const agents = await deps.store.listEnabledAgents(PLAN_AGENT_LIMIT);
    let planned = 0;

    for (const agent of agents) {
        if (Date.now() > deadline) break;
        const found = findAutomation(deps.registry, agent.agent_slug);
        // Дэлгүүр салбараа сольсон бол хуучин pack-ийн automation ажиллахгүй.
        if (!found || found.packId !== agent.business_type) continue;

        const now = deps.now();
        if (!isDueForSelect(found.def, agent.last_run_at, now)) continue;
        const ctx: AutomationContext = { shopId: agent.shop_id, config: agent.config ?? {}, mode: agent.mode, now };
        try {
            const subjects = await found.def.select(ctx);
            const rows: NewRun[] = subjects.map((s) => ({
                shop_id: agent.shop_id,
                agent_slug: agent.agent_slug,
                trigger_kind: 'schedule',
                subject_type: s.subjectType,
                subject_id: s.subjectId,
                idempotency_key: idempotencyKey(agent.agent_slug, s.subjectId, s.windowKey),
                payload: s.payload ?? {},
                scheduled_for: (s.scheduledFor ?? now).toISOString(),
            }));
            planned += await deps.store.enqueueRuns(rows);
            await deps.store.touchAgent(agent.id, now.toISOString());
        } catch (err) {
            logger.warn('operator: select failed', {
                slug: agent.agent_slug,
                shopId: agent.shop_id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    return planned;
}

async function executeRun(
    deps: DispatcherDeps,
    run: AgentRunRow,
    agentCache: Map<string, ShopAgentRow | null>,
): Promise<RunStatus> {
    const now = deps.now();
    const finish = async (status: RunStatus, patch: Partial<Parameters<OperatorStore['updateRun']>[1]> = {}) => {
        await deps.store.updateRun(run.id, { status, finished_at: now.toISOString(), ...patch });
        return status;
    };

    const found = findAutomation(deps.registry, run.agent_slug);
    if (!found) return finish('skipped', { error: 'unknown_automation' });

    const cacheKey = `${run.shop_id}:${run.agent_slug}`;
    if (!agentCache.has(cacheKey)) {
        agentCache.set(cacheKey, await deps.store.getShopAgent(run.shop_id, run.agent_slug));
    }
    const agent = agentCache.get(cacheKey);
    if (!agent?.enabled) return finish('skipped', { error: 'agent_disabled' });

    const ctx: AutomationContext = { shopId: run.shop_id, config: agent.config ?? {}, mode: agent.mode, now };

    try {
        if (needsApproval(found.def, agent, run)) {
            const draft = found.def.prepare ? await found.def.prepare(ctx, run) : {};
            return await finish('awaiting_approval', {
                payload: { ...run.payload, ...draft },
                finished_at: null,
            });
        }

        const outcome = await found.def.execute(ctx, run);
        if (outcome.tokens && outcome.tokens.used > 0) {
            await deps.meterTokens(run.shop_id, outcome.tokens).catch(() => undefined);
        }
        return await finish(outcome.status, {
            result: outcome.result ?? null,
            tokens_used: outcome.tokens?.used ?? 0,
            model: outcome.tokens?.model ?? null,
            error: null,
            finished_at: outcome.status === 'awaiting_approval' ? null : now.toISOString(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (run.attempts >= MAX_ATTEMPTS) {
            await deps.notifyOwnerOfFailure(run.shop_id, run.agent_slug, message);
            return finish('failed', { error: message });
        }
        await deps.store.updateRun(run.id, {
            status: 'queued',
            error: message,
            scheduled_for: nextRetryAt(run.attempts, now).toISOString(),
        });
        return 'queued';
    }
}

export async function runDispatcherTick(
    opts: { budgetMs?: number; deps?: Partial<DispatcherDeps> } = {},
): Promise<TickSummary> {
    const started = Date.now();
    const deadline = started + (opts.budgetMs ?? 45_000);
    const deps: DispatcherDeps = { ...defaultDeps(), ...opts.deps };

    const summary: TickSummary = { planned: 0, claimed: 0, outcomes: {}, durationMs: 0, outOfBudget: false };

    summary.planned = await planPhase(deps, deadline);

    const agentCache = new Map<string, ShopAgentRow | null>();
    while (Date.now() < deadline) {
        const runs = await deps.store.claimRuns(CLAIM_BATCH);
        if (runs.length === 0) break;
        summary.claimed += runs.length;
        for (const run of runs) {
            const status = await executeRun(deps, run, agentCache);
            summary.outcomes[status] = (summary.outcomes[status] ?? 0) + 1;
        }
        if (runs.length < CLAIM_BATCH) break;
    }

    summary.outOfBudget = Date.now() >= deadline;
    summary.durationMs = Date.now() - started;
    return summary;
}
