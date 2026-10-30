import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ sendPushNotification: vi.fn() }));
vi.mock('@/lib/notifications-prefs', () => ({ isNotificationEnabled: vi.fn() }));
vi.mock('@/lib/ai/tokenUsage', () => ({ persistTokenUsage: vi.fn() }));

import { runDispatcherTick, idempotencyKey, MAX_ATTEMPTS, type DispatcherDeps } from '../dispatcher';
import type { OperatorStore, EnabledAgent, NewRun, RunPatch } from '../store';
import type { AgentRunRow, AutomationDef, ShopAgentRow } from '../types';
import type { AutomationRegistry } from '../automations';

const NOW = new Date('2026-10-10T08:00:00Z');

function memoryStore(agents: EnabledAgent[]) {
    const runs = new Map<string, AgentRunRow>();
    let seq = 0;
    const store: OperatorStore = {
        async listEnabledAgents() {
            return agents.filter((a) => a.enabled);
        },
        async enqueueRuns(rows: NewRun[]) {
            let inserted = 0;
            for (const r of rows) {
                if ([...runs.values()].some((x) => x.idempotency_key === r.idempotency_key)) continue;
                const id = `run-${++seq}`;
                runs.set(id, {
                    ...r,
                    id,
                    status: 'queued',
                    result: null,
                    error: null,
                    attempts: 0,
                    tokens_used: 0,
                    started_at: null,
                    finished_at: null,
                    created_at: NOW.toISOString(),
                });
                inserted++;
            }
            return inserted;
        },
        async touchAgent() {},
        async claimRuns(limit) {
            const due = [...runs.values()]
                .filter((r) => r.status === 'queued' && new Date(r.scheduled_for) <= NOW)
                .slice(0, limit);
            for (const r of due) {
                r.status = 'running';
                r.attempts += 1;
            }
            return due.map((r) => ({ ...r }));
        },
        async getShopAgent(shopId, slug) {
            return agents.find((a) => a.shop_id === shopId && a.agent_slug === slug) ?? null;
        },
        async updateRun(id, patch: RunPatch) {
            Object.assign(runs.get(id)!, patch);
        },
    };
    return { store, runs };
}

function agent(overrides: Partial<EnabledAgent> = {}): EnabledAgent {
    return {
        id: 'agent-1',
        shop_id: 'shop-1',
        agent_slug: 'beauty.reminder',
        enabled: true,
        mode: 'auto',
        config: {},
        last_run_at: null,
        business_type: 'beauty',
        ...overrides,
    };
}

function automation(overrides: Partial<AutomationDef> = {}): AutomationDef {
    return {
        key: 'reminder',
        label: 'Сануулга',
        description: '',
        kind: 'customer_message',
        defaultMode: 'auto',
        defaultEnabled: true,
        usesLLM: false,
        select: async () => [{ subjectType: 'appointment', subjectId: 'appt-1', windowKey: '2026-10-11' }],
        execute: async () => ({ status: 'sent' }),
        ...overrides,
    };
}

function deps(store: OperatorStore, registry: AutomationRegistry, extra: Partial<DispatcherDeps> = {}) {
    return {
        store,
        registry,
        now: () => NOW,
        notifyOwnerOfFailure: vi.fn(async () => {}),
        meterTokens: vi.fn(async () => {}),
        ...extra,
    } satisfies DispatcherDeps;
}

describe('runDispatcherTick', () => {
    it('plans and executes a run exactly once across ticks', async () => {
        const execute = vi.fn(async () => ({ status: 'sent' as const }));
        const { store, runs } = memoryStore([agent()]);
        const d = deps(store, { beauty: [automation({ execute })] });

        const first = await runDispatcherTick({ deps: d });
        const second = await runDispatcherTick({ deps: d });

        expect(first.planned).toBe(1);
        expect(first.outcomes.sent).toBe(1);
        expect(second.planned).toBe(0); // same idempotency key
        expect(execute).toHaveBeenCalledTimes(1);
        expect([...runs.values()][0].idempotency_key).toBe(idempotencyKey('beauty.reminder', 'appt-1', '2026-10-11'));
    });

    it('holds customer messages for approval in approve mode, then sends once approved', async () => {
        const execute = vi.fn(async () => ({ status: 'sent' as const }));
        const prepare = vi.fn(async () => ({ draft: 'Сайн байна уу' }));
        const a = agent({ mode: 'approve' });
        const { store, runs } = memoryStore([a]);
        const d = deps(store, { beauty: [automation({ execute, prepare })] });

        const tick = await runDispatcherTick({ deps: d });
        const run = [...runs.values()][0];
        expect(tick.outcomes.awaiting_approval).toBe(1);
        expect(run.payload).toMatchObject({ draft: 'Сайн байна уу' });
        expect(execute).not.toHaveBeenCalled();

        // owner approves → dashboard API requeues with payload.approved
        run.status = 'queued';
        run.payload = { ...run.payload, approved: true };
        await runDispatcherTick({ deps: d });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(run.status).toBe('sent');
    });

    it('does not gate owner reports behind approval', async () => {
        const { store } = memoryStore([agent({ mode: 'approve' })]);
        const d = deps(store, { beauty: [automation({ kind: 'owner_report' })] });
        const tick = await runDispatcherTick({ deps: d });
        expect(tick.outcomes.sent).toBe(1);
    });

    it('retries with backoff and fails after MAX_ATTEMPTS, notifying the owner', async () => {
        const execute = vi.fn(async () => {
            throw new Error('meta down');
        });
        const { store, runs } = memoryStore([agent()]);
        const d = deps(store, { beauty: [automation({ execute })] });

        await runDispatcherTick({ deps: d });
        const run = [...runs.values()][0];
        expect(run.status).toBe('queued');
        expect(new Date(run.scheduled_for).getTime()).toBeGreaterThan(NOW.getTime());

        // pretend backoff elapsed for the remaining attempts
        for (let i = 1; i < MAX_ATTEMPTS; i++) {
            run.scheduled_for = NOW.toISOString();
            await runDispatcherTick({ deps: d });
        }
        expect(run.status).toBe('failed');
        expect(run.error).toBe('meta down');
        expect(d.notifyOwnerOfFailure).toHaveBeenCalledTimes(1);
    });

    it('skips automations of a pack the shop no longer belongs to', async () => {
        const select = vi.fn(async () => []);
        const { store } = memoryStore([agent({ business_type: 'retail' })]);
        const d = deps(store, { beauty: [automation({ select })] });
        const tick = await runDispatcherTick({ deps: d });
        expect(select).not.toHaveBeenCalled();
        expect(tick.planned).toBe(0);
    });

    it('skips queued runs whose agent was disabled since planning', async () => {
        const a = agent();
        const { store, runs } = memoryStore([a]);
        const d = deps(store, { beauty: [automation()] });
        await store.enqueueRuns([
            {
                shop_id: 'shop-1',
                agent_slug: 'beauty.reminder',
                trigger_kind: 'schedule',
                subject_type: 'appointment',
                subject_id: 'appt-9',
                idempotency_key: 'k-9',
                payload: {},
                scheduled_for: NOW.toISOString(),
            },
        ]);
        (a as ShopAgentRow).enabled = false;
        await runDispatcherTick({ deps: d });
        const run = [...runs.values()].find((r) => r.idempotency_key === 'k-9')!;
        expect(run.status).toBe('skipped');
        expect(run.error).toBe('agent_disabled');
    });

    it('meters tokens only when an automation reports LLM usage', async () => {
        const { store } = memoryStore([agent()]);
        const d = deps(store, {
            beauty: [
                automation({
                    execute: async () => ({
                        status: 'sent',
                        tokens: { used: 1200, feature: 'chat_reply', model: 'gpt-6-luna' },
                    }),
                }),
            ],
        });
        await runDispatcherTick({ deps: d });
        expect(d.meterTokens).toHaveBeenCalledWith('shop-1', { used: 1200, feature: 'chat_reply', model: 'gpt-6-luna' });
    });
});
