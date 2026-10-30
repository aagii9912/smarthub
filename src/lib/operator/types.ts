/**
 * Operator runtime — идэвхтэй (proactive) агентуудын төрлүүд.
 *
 * Automation бүр нь Industry Pack-д харьяалагдана; slug = '<pack>.<automation>'.
 * Dispatcher (cron) нь `select()`-ээр хийх ажлуудыг олж `agent_runs`-д
 * дараалуулж, дараа нь `execute()`-ээр гүйцэтгэнэ. Эзэн "approve" горим
 * сонгосон бол `prepare()`-ийн гаргасан төслийг эзэн батлах хүртэл хүлээнэ.
 */

import type { TokenFeature } from '@/lib/ai/tokenFeatures';

export type TriggerKind = 'schedule' | 'event' | 'manual' | 'chat';

export type RunStatus =
    | 'queued'
    | 'running'
    | 'awaiting_approval'
    | 'sent'
    | 'skipped'
    | 'failed'
    | 'rejected';

export type AutomationMode = 'auto' | 'approve';

export interface AgentRunRow {
    id: string;
    shop_id: string;
    agent_slug: string;
    trigger_kind: TriggerKind;
    status: RunStatus;
    subject_type: string | null;
    subject_id: string | null;
    idempotency_key: string;
    payload: Record<string, unknown>;
    result: Record<string, unknown> | null;
    error: string | null;
    attempts: number;
    tokens_used: number;
    scheduled_for: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
}

export interface ShopAgentRow {
    id: string;
    shop_id: string;
    agent_slug: string;
    enabled: boolean;
    mode: AutomationMode;
    config: Record<string, unknown>;
    last_run_at: string | null;
}

export interface AutomationContext {
    shopId: string;
    /** `shop_agents.config` — automation-ий default дээр дарагдсан эзний тохиргоо. */
    config: Record<string, unknown>;
    mode: AutomationMode;
    now: Date;
}

/** `select()`-ийн олсон нэг ажил → нэг `agent_runs` мөр. */
export interface AutomationSubject {
    subjectType: string;
    subjectId: string;
    /**
     * Нэг subject-д давтагдахгүй байх цонхны түлхүүр (жишээ: цаг захиалгын
     * огноо). idempotency_key = `${slug}:${subjectId}:${windowKey}`.
     */
    windowKey: string;
    payload?: Record<string, unknown>;
    /** Ирээдүйд гүйцэтгэх бол; өгөөгүй бол шууд. */
    scheduledFor?: Date;
}

export interface RunResult {
    status: Extract<RunStatus, 'sent' | 'skipped' | 'awaiting_approval'>;
    result?: Record<string, unknown>;
    /** LLM ашигласан бол — token pool-оос хасагдана. Deterministic ажилд өгөхгүй (0 нэгж). */
    tokens?: { used: number; feature: TokenFeature; model?: string };
}

export interface AutomationConfigField {
    key: string;
    label: string;
    /** `hour` — UB цаг (HH:00 гэж харагдана), `number` — тоо + нэгж. */
    type: 'hour' | 'number';
    min: number;
    max: number;
    default: number;
    unit?: string;
}

export interface AutomationDef {
    /** Pack доторх нэр (жишээ: 'reminder_24h'); бүтэн slug нь '<pack>.<key>'. */
    key: string;
    label: string;
    description: string;
    kind: 'customer_message' | 'owner_report' | 'owner_task' | 'invoice';
    defaultMode: AutomationMode;
    defaultEnabled: boolean;
    usesLLM: boolean;
    /** Эзний өөрчилж болох тоон тохиргоо (`shop_agents.config`); UI болон шалгалт эндээс үүснэ. */
    configFields?: AutomationConfigField[];
    /** `select()`-ийг хамгийн багадаа хэдэн минут тутам ажиллуулах (default: tick бүр). */
    intervalMinutes?: number;
    /** Хийх ажлуудыг олно (SQL). Давхардлыг idempotency key хамгаална. */
    select(ctx: AutomationContext): Promise<AutomationSubject[]>;
    /** "approve" горимд эзэнд харуулах төслийг бэлдэнэ (payload-д нэмэгдэнэ). */
    prepare?(ctx: AutomationContext, run: AgentRunRow): Promise<Record<string, unknown>>;
    /** Бодит үйлдлийг гүйцэтгэнэ. Алдаа шидвэл dispatcher дахин оролдоно. */
    execute(ctx: AutomationContext, run: AgentRunRow): Promise<RunResult>;
}
