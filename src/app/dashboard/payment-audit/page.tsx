'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
    Shield,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Download,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    RotateCcw,
    FileText,
    Wallet,
    TrendingUp,
    AlertTriangle,
    Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';

interface AuditLog {
    id: string;
    payment_id: string;
    order_id: string | null;
    action: string;
    old_status: string | null;
    new_status: string | null;
    amount: number | null;
    payment_method: string | null;
    actor: string;
    actor_id: string | null;
    metadata: Record<string, unknown>;
    notes: string | null;
    created_at: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface Summary {
    total: number;
    paidCount: number;
    paidAmount: number;
    failedCount: number;
    expiredCount: number;
    refundedCount: number;
    refundedAmount: number;
    successRate: number;
}

const EMPTY_SUMMARY: Summary = {
    total: 0,
    paidCount: 0,
    paidAmount: 0,
    failedCount: 0,
    expiredCount: 0,
    refundedCount: 0,
    refundedAmount: 0,
    successRate: 0,
};

const ACTION_CONFIG: Record<
    string,
    {
        label: string;
        tone: 'info' | 'success' | 'danger' | 'warning' | 'violet' | 'neutral';
        icon: React.ComponentType<{ className?: string }>;
    }
> = {
    created: { label: 'Үүсгэсэн', tone: 'info', icon: FileText },
    paid: { label: 'Төлөгдсөн', tone: 'success', icon: CheckCircle2 },
    failed: { label: 'Амжилтгүй', tone: 'danger', icon: XCircle },
    expired: { label: 'Хугацаа дууссан', tone: 'warning', icon: Clock },
    refunded: { label: 'Буцаалт', tone: 'violet', icon: RotateCcw },
    status_changed: { label: 'Өөрчлөгдсөн', tone: 'neutral', icon: ArrowUpDown },
};

const toneClass = (tone: 'info' | 'success' | 'danger' | 'warning' | 'violet' | 'neutral') => {
    switch (tone) {
        case 'info':
            return 'text-[var(--brand-indigo-400)] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)]';
        case 'success':
            return 'text-[var(--success)] bg-[color-mix(in_oklab,var(--success)_18%,transparent)]';
        case 'danger':
            return 'text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)]';
        case 'warning':
            return 'text-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_18%,transparent)]';
        case 'violet':
            return 'text-[var(--brand-violet-500)] bg-[color-mix(in_oklab,var(--brand-violet-500)_18%,transparent)]';
        default:
            return 'text-white/60 bg-white/[0.06]';
    }
};

const ACTOR_LABELS: Record<string, string> = {
    system: 'Систем',
    webhook: 'QPay Webhook',
    pay_page_poll: 'Төлбөрийн хуудас',
    shop_owner: 'Дэлгүүр эзэн',
    admin: 'Админ',
};

const METHOD_LABELS: Record<string, string> = {
    qpay: 'QPay',
    cash: 'Бэлнээр',
    bank_transfer: 'Шилжүүлэг',
};

/**
 * Extract a readable note from an audit log:
 * - prefer explicit `notes`
 * - else pull common metadata keys (failure_reason, refund_reason, qpay_status, note)
 */
function extractContext(log: AuditLog): string | null {
    if (log.notes && log.notes.trim()) return log.notes.trim();
    const meta = log.metadata || {};
    const candidateKeys = ['failure_reason', 'refund_reason', 'note', 'qpay_status', 'failure_code'];
    for (const key of candidateKeys) {
        const value = meta[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

export default function PaymentAuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState<string>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [actionPending, setActionPending] = useState<string | null>(null);

    const fetchLogs = useCallback(
        async (page = 1) => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: '25',
                });
                if (actionFilter) params.set('action', actionFilter);
                if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
                if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());

                const headers: Record<string, string> = {
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                };

                const res = await fetch(`/api/payment/audit?${params}`, { headers });
                if (!res.ok) throw new Error('Fetch failed');

                const data = await res.json();
                setLogs(data.logs || []);
                setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
                setSummary(data.summary || EMPTY_SUMMARY);
            } catch {
                toast.error('Audit лог ачаалахад алдаа гарлаа');
            } finally {
                setLoading(false);
            }
        },
        [actionFilter, dateFrom, dateTo]
    );

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const exportCSV = () => {
        if (logs.length === 0) {
            toast.info('Экспортлох өгөгдөл байхгүй');
            return;
        }

        const headers = [
            'Огноо',
            'Үйлдэл',
            'Хуучин статус',
            'Шинэ статус',
            'Дүн',
            'Төлбөрийн арга',
            'Эх үүсвэр',
            'Захиалга ID',
            'Тэмдэглэл',
        ];
        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const rows = logs.map((log) => [
            new Date(log.created_at).toLocaleString('mn-MN'),
            ACTION_CONFIG[log.action]?.label || log.action,
            log.old_status || '-',
            log.new_status || '-',
            log.amount ? `₮${Number(log.amount).toLocaleString()}` : '-',
            METHOD_LABELS[log.payment_method || ''] || log.payment_method || '-',
            ACTOR_LABELS[log.actor] || log.actor,
            log.order_id?.substring(0, 8) || '-',
            extractContext(log) || '-',
        ]);

        const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payment_audit_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV татагдлаа');
    };

    const handleLifecycleAction = async (
        log: AuditLog,
        action: 'refund' | 'mark_failed'
    ) => {
        const defaultPrompt =
            action === 'refund'
                ? 'Буцаалтын шалтгаан (заавал биш):'
                : 'Амжилтгүй болсон шалтгаан:';
        const reason = window.prompt(defaultPrompt) || '';

        setActionPending(log.id);
        try {
            const res = await fetch('/api/payment/audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: JSON.stringify({
                    payment_id: log.payment_id,
                    action,
                    reason: reason.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Action failed');

            toast.success(action === 'refund' ? 'Буцаалт бүртгэгдлээ' : 'Амжилтгүй гэж бүртгэлээ');
            await fetchLogs(pagination.page);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        } finally {
            setActionPending(null);
        }
    };

    const fmtAmount = (n: number) => `₮${Math.round(n).toLocaleString()}`;

    const summaryCards = [
        {
            icon: TrendingUp,
            tone: 'info' as const,
            label: 'Нийт бичлэг',
            value: summary.total.toLocaleString(),
        },
        {
            icon: Wallet,
            tone: 'success' as const,
            label: 'Төлөгдсөн',
            value: `${summary.paidCount} • ${fmtAmount(summary.paidAmount)}`,
        },
        {
            icon: AlertTriangle,
            tone: 'danger' as const,
            label: 'Амжилтгүй',
            value: `${summary.failedCount + summary.expiredCount}`,
            hint: summary.expiredCount > 0 ? `${summary.expiredCount} хугацаа дуусс.` : undefined,
        },
        {
            icon: RotateCcw,
            tone: 'violet' as const,
            label: 'Буцаалт',
            value: `${summary.refundedCount} • ${fmtAmount(summary.refundedAmount)}`,
        },
        {
            icon: CheckCircle2,
            tone: 'success' as const,
            label: 'Амжилттай хувь',
            value: `${summary.successRate}%`,
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHero
                eyebrow={
                    <span className="inline-flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Найдвартай бүртгэл
                    </span>
                }
                title="Төлбөрийн Audit"
                subtitle="Захиалгын төлбөрийн бүх өөрчлөлт, амжилтгүй болсон гүйлгээ, буцаалтыг ил тод бүртгэнэ."
                actions={
                    <Button
                        variant="ghost"
                        size="md"
                        leftIcon={<Download className="h-4 w-4" strokeWidth={1.5} />}
                        onClick={exportCSV}
                    >
                        CSV татах
                    </Button>
                }
            />

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="card-outlined p-4 flex items-center gap-3">
                            <div
                                className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                    toneClass(card.tone)
                                )}
                            >
                                <Icon className="w-5 h-5" strokeWidth={1.6} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[16px] font-semibold text-foreground tabular-nums tracking-[-0.02em] truncate">
                                    {card.value}
                                </p>
                                <p className="text-[11px] text-white/45 tracking-[-0.01em]">{card.label}</p>
                                {card.hint && (
                                    <p className="text-[10px] text-white/30 tracking-[-0.01em] mt-0.5">{card.hint}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="card-outlined p-4 md:p-5">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
                            Үйлдэл
                        </label>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="h-10 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 text-[13px] text-white/80 focus:outline-none focus:border-[var(--brand-indigo)] transition-colors min-w-[160px]"
                        >
                            <option value="">Бүгд</option>
                            <option value="created">Үүсгэсэн</option>
                            <option value="paid">Төлөгдсөн</option>
                            <option value="failed">Амжилтгүй</option>
                            <option value="expired">Хугацаа дууссан</option>
                            <option value="refunded">Буцаалт</option>
                            <option value="status_changed">Өөрчлөгдсөн</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
                            Эхлэх
                        </label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="h-10 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 text-[13px] text-white/80 focus:outline-none focus:border-[var(--brand-indigo)] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
                            Дуусах
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="h-10 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 text-[13px] text-white/80 focus:outline-none focus:border-[var(--brand-indigo)] transition-colors"
                        />
                    </div>

                    {(actionFilter || dateFrom || dateTo) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setActionFilter('');
                                setDateFrom('');
                                setDateTo('');
                            }}
                            className="text-white/50 hover:text-white"
                        >
                            Цэвэрлэх
                        </Button>
                    )}

                    <div className="flex-1" />

                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground tabular-nums pb-2.5">
                        Нийт <span className="text-foreground">{pagination.total}</span> бичлэг
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card-outlined overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-indigo-400)]" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/40">
                        <Shield className="w-10 h-10 mb-3 text-white/10" strokeWidth={1.5} />
                        <p className="text-[13px] text-white/50">Audit бичлэг байхгүй</p>
                        <p className="text-[11px] text-white/30 mt-1">
                            Захиалгын төлбөр хийгдэх үед автоматаар бүртгэгдэнэ
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Огноо
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Үйлдэл
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Статус
                                    </th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Дүн
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Арга
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Эх үүсвэр
                                    </th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Захиалга
                                    </th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Үйлдэл
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {logs.map((log) => {
                                    const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.status_changed;
                                    const Icon = config.icon;
                                    const context = extractContext(log);
                                    const expanded = expandedLogId === log.id;
                                    const canRefund = log.action === 'paid';
                                    const canMarkFailed =
                                        log.action === 'created' || log.action === 'status_changed';

                                    return (
                                        <Fragment key={log.id}>
                                            <tr
                                                className={cn(
                                                    'hover:bg-white/[0.03] transition-colors cursor-pointer',
                                                    expanded && 'bg-white/[0.02]'
                                                )}
                                                onClick={() =>
                                                    setExpandedLogId(expanded ? null : log.id)
                                                }
                                            >
                                                <td className="px-4 py-3.5">
                                                    <div className="text-[12.5px] text-white/70 tabular-nums">
                                                        {new Date(log.created_at).toLocaleDateString('mn-MN')}
                                                    </div>
                                                    <div className="text-[10.5px] text-white/30 tabular-nums">
                                                        {new Date(log.created_at).toLocaleTimeString('mn-MN', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit',
                                                        })}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
                                                            toneClass(config.tone)
                                                        )}
                                                    >
                                                        <Icon className="w-3 h-3" />
                                                        {config.label}
                                                    </span>
                                                    {context && (
                                                        <div className="flex items-center gap-1 mt-1 text-[10.5px] text-white/40">
                                                            <Info className="w-3 h-3" />
                                                            <span className="truncate max-w-[220px]">
                                                                {context}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    {log.old_status && log.new_status ? (
                                                        <div className="flex items-center gap-1.5 text-[11.5px]">
                                                            <span className="text-white/35">
                                                                {log.old_status}
                                                            </span>
                                                            <span className="text-white/15">→</span>
                                                            <span className="text-white/70 font-medium">
                                                                {log.new_status}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11.5px] text-white/35">
                                                            {log.new_status || '—'}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 text-right">
                                                    {log.amount ? (
                                                        <span className="text-[13px] font-semibold text-foreground tabular-nums">
                                                            ₮{Number(log.amount).toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-white/20">—</span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <span className="text-[11.5px] text-white/50">
                                                        {METHOD_LABELS[log.payment_method || ''] ||
                                                            log.payment_method ||
                                                            '—'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <span className="text-[11.5px] text-white/50">
                                                        {ACTOR_LABELS[log.actor] || log.actor}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    {log.order_id ? (
                                                        <span className="text-[11.5px] text-[var(--brand-indigo-400)] font-mono">
                                                            #{log.order_id.substring(0, 8)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-white/15">—</span>
                                                    )}
                                                </td>

                                                <td
                                                    className="px-4 py-3.5 text-right"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canRefund && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={actionPending === log.id}
                                                                onClick={() =>
                                                                    handleLifecycleAction(log, 'refund')
                                                                }
                                                                leftIcon={
                                                                    actionPending === log.id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                                    )
                                                                }
                                                            >
                                                                Буцаах
                                                            </Button>
                                                        )}
                                                        {canMarkFailed && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={actionPending === log.id}
                                                                onClick={() =>
                                                                    handleLifecycleAction(log, 'mark_failed')
                                                                }
                                                                leftIcon={
                                                                    actionPending === log.id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <XCircle className="w-3.5 h-3.5" />
                                                                    )
                                                                }
                                                            >
                                                                Амжилтгүй
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <tr className="bg-[color-mix(in_oklab,var(--brand-indigo)_6%,transparent)]">
                                                    <td colSpan={8} className="px-4 py-4">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-[11px] text-white/50">
                                                                <Info className="w-3.5 h-3.5" />
                                                                <span className="font-medium">
                                                                    Нэмэлт мэдээлэл
                                                                </span>
                                                            </div>
                                                            <pre className="text-[11px] text-white/60 bg-black/30 rounded-lg p-3 overflow-x-auto">
                                                                {JSON.stringify(
                                                                    {
                                                                        payment_id: log.payment_id,
                                                                        notes: log.notes,
                                                                        metadata: log.metadata,
                                                                    },
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                        Хуудас {pagination.page} / {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => fetchLogs(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => fetchLogs(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
