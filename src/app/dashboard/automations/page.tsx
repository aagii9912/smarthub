'use client';

import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Bell, Check, Phone, Send, Sparkles, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    useAutomationRuns,
    useAutomations,
    useRunAction,
    useUpdateAutomation,
    type AutomationRun,
    type ShopAutomationView,
} from '@/hooks/useAutomations';

const STATUS_LABELS: Record<AutomationRun['status'], { label: string; tone: string }> = {
    queued: { label: 'Дараалалд', tone: 'bg-white/[0.06] text-white/60' },
    running: { label: 'Явж байна', tone: 'bg-white/[0.06] text-white/60' },
    awaiting_approval: { label: 'Таны шийдвэр', tone: 'bg-amber-500/15 text-amber-300' },
    sent: { label: 'Хийгдсэн', tone: 'bg-emerald-500/15 text-emerald-300' },
    skipped: { label: 'Алгассан', tone: 'bg-white/[0.06] text-white/40' },
    failed: { label: 'Алдаа', tone: 'bg-red-500/15 text-red-300' },
    rejected: { label: 'Татгалзсан', tone: 'bg-white/[0.06] text-white/40' },
};

function range(min: number, max: number) {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function formatWhen(iso: string) {
    return new Date(iso).toLocaleString('mn-MN', {
        timeZone: 'Asia/Ulaanbaatar',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function labelFor(slug: string, automations: ShopAutomationView[]) {
    return automations.find((a) => a.slug === slug)?.label ?? slug;
}

function InboxItem({ run, automations }: { run: AutomationRun; automations: ShopAutomationView[] }) {
    const action = useRunAction();
    const task = run.result?.task as
        | { customer_name: string | null; phone: string | null; note: string }
        | undefined;
    const draft = typeof run.payload.draft === 'string' ? run.payload.draft : null;

    return (
        <div className="card-outlined p-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 min-w-0">
                <div className="text-[11px] text-muted-foreground">
                    {labelFor(run.agent_slug, automations)} · {formatWhen(run.created_at)}
                </div>
                {task ? (
                    <>
                        <div className="text-[14px] font-medium text-foreground mt-1">
                            {task.customer_name ?? 'Үйлчлүүлэгч'} — {task.note}
                        </div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">
                            {run.result?.delivery
                                ? 'Messenger-ээр хүрэх боломжгүй байна. Залгаж мэдэгдээрэй.'
                                : 'Залгаж холбогдоод "Хийсэн" гэж тэмдэглээрэй.'}
                        </div>
                    </>
                ) : (
                    <div className="text-[13px] text-foreground mt-1 whitespace-pre-line">{draft ?? 'Илгээх мессеж'}</div>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {task?.phone && (
                    <Button variant="outline" size="sm" href={`tel:${task.phone}`}>
                        <Phone className="h-3.5 w-3.5" /> {task.phone}
                    </Button>
                )}
                {task ? (
                    <Button size="sm" loading={action.isPending} onClick={() => action.mutate({ id: run.id, action: 'done' })}>
                        <Check className="h-3.5 w-3.5" /> Хийсэн
                    </Button>
                ) : (
                    <Button size="sm" loading={action.isPending} onClick={() => action.mutate({ id: run.id, action: 'approve' })}>
                        <Send className="h-3.5 w-3.5" /> Илгээх
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Татгалзах"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: run.id, action: 'reject' })}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

function AutomationCard({ automation }: { automation: ShopAutomationView }) {
    const update = useUpdateAutomation();
    const isCustomerFacing = automation.kind === 'customer_message' || automation.kind === 'invoice';

    return (
        <div className={cn('card-outlined p-4 flex flex-col gap-3', !automation.enabled && 'opacity-80')}>
            <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl shrink-0 flex items-center justify-center bg-secondary">
                    {automation.kind === 'owner_report' ? (
                        <Bell className="h-4 w-4 text-white/60" />
                    ) : (
                        <Zap className="h-4 w-4 text-white/60" />
                    )}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-foreground">{automation.label}</span>
                        {automation.recommended && !automation.enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300">Санал болгож буй</span>
                        )}
                        {automation.usesLLM && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50 inline-flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> AI нэгж
                            </span>
                        )}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{automation.description}</div>
                </div>
                <Toggle
                    enabled={automation.enabled}
                    disabled={update.isPending}
                    onChange={(enabled) => update.mutate({ slug: automation.slug, enabled })}
                />
            </div>

            {automation.enabled && isCustomerFacing && (
                <div className="flex items-center gap-1.5 text-[12px]">
                    {(['auto', 'approve'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ slug: automation.slug, mode })}
                            className={cn(
                                'px-2.5 py-1 rounded-md transition-colors',
                                automation.mode === mode ? 'bg-white/[0.12] text-foreground' : 'bg-white/[0.04] text-white/50',
                            )}
                        >
                            {mode === 'auto' ? 'Автоматаар илгээх' : 'Батлаад илгээх'}
                        </button>
                    ))}
                </div>
            )}

            {automation.enabled &&
                automation.configFields.map((field) => (
                    <label key={field.key} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        {field.label}
                        <select
                            value={Number(automation.config[field.key] ?? field.default)}
                            disabled={update.isPending}
                            onChange={(e) =>
                                update.mutate({
                                    slug: automation.slug,
                                    config: { ...automation.config, [field.key]: Number(e.target.value) },
                                })
                            }
                            className="bg-secondary text-foreground rounded-md px-2 py-1 text-[12px]"
                        >
                            {range(field.min, field.max).map((v) => (
                                <option key={v} value={v}>
                                    {field.type === 'hour' ? `${String(v).padStart(2, '0')}:00` : `${v} ${field.unit ?? ''}`.trim()}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
        </div>
    );
}

export default function AutomationsPage() {
    const { data, isLoading } = useAutomations();
    const inbox = useAutomationRuns('inbox');
    const log = useAutomationRuns('log');

    if (isLoading) return <DashboardSkeleton />;

    const automations = data?.automations ?? [];
    const enabledCount = automations.filter((a) => a.enabled).length;
    const inboxRuns = inbox.data ?? [];
    const logRuns = (log.data ?? []).filter((r) => r.status !== 'awaiting_approval');

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <PageHero
                eyebrow={data?.pack ? `${data.pack.label} · Автомат туслах` : 'Автомат туслах'}
                title="Автомат туслах"
                subtitle={
                    <>
                        Сануулга, тойм, дагалтыг таны оронд хийнэ ·{' '}
                        <span className="text-foreground font-medium tabular-nums">{enabledCount}</span> идэвхтэй
                    </>
                }
            />

            {automations.length === 0 ? (
                <div className="card-outlined p-12 text-center flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                        <Zap className="h-5 w-5 text-white/40" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="text-foreground font-medium">Бизнесийн төрлөө сонгоно уу</div>
                        <div className="text-[12px] text-muted-foreground mt-1">
                            Автомат туслах нь таны салбарт тохирсон ажлуудыг санал болгоно. Тохиргоо хэсгээс бизнесийн төрлөө сонгоорой.
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {inboxRuns.length > 0 && (
                        <section className="space-y-2">
                            <h2 className="text-[13px] font-semibold text-foreground">
                                Таны шийдвэр хүлээж буй <span className="text-amber-300 tabular-nums">{inboxRuns.length}</span>
                            </h2>
                            {inboxRuns.map((run) => (
                                <InboxItem key={run.id} run={run} automations={automations} />
                            ))}
                        </section>
                    )}

                    <section className="space-y-2">
                        <h2 className="text-[13px] font-semibold text-foreground">Автомат үйлдлүүд</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {automations.map((a) => (
                                <AutomationCard key={a.slug} automation={a} />
                            ))}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-[13px] font-semibold text-foreground">Сүүлийн үйлдлүүд</h2>
                        {logRuns.length === 0 ? (
                            <div className="text-[12px] text-muted-foreground">Одоогоор үйлдэл алга.</div>
                        ) : (
                            <div className="card-outlined divide-y divide-white/[0.05]">
                                {logRuns.map((run) => {
                                    const status = STATUS_LABELS[run.status];
                                    return (
                                        <div key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                                            <span className="text-muted-foreground tabular-nums w-28 shrink-0">{formatWhen(run.created_at)}</span>
                                            <span className="flex-1 min-w-0 truncate text-foreground">{labelFor(run.agent_slug, automations)}</span>
                                            <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] shrink-0', status.tone)}>{status.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
