'use client';

import { useState, useEffect, useCallback } from 'react';
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

const ACTION_CONFIG: Record<string, { label: string; tone: 'info' | 'success' | 'danger' | 'warning' | 'violet' | 'neutral'; icon: React.ComponentType<{ className?: string }> }> = {
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

export default function PaymentAuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState<string>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchLogs = useCallback(async (page = 1) => {
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
        } catch {
            toast.error('Audit лог ачаалахад алдаа гарлаа');
        } finally {
            setLoading(false);
        }
    }, [actionFilter, dateFrom, dateTo]);

    useEffect(() => {
        fetchLogs(1);
    }, [fetchLogs]);

    const exportCSV = () => {
        if (logs.length === 0) {
            toast.info('Экспортлох өгөгдөл байхгүй');
            return;
        }

        const headers = ['Огноо', 'Үйлдэл', 'Хуучин статус', 'Шинэ статус', 'Дүн', 'Төлбөрийн арга', 'Эх үүсвэр', 'Захиалга ID'];
        const rows = logs.map(log => [
            new Date(log.created_at).toLocaleString('mn-MN'),
            ACTION_CONFIG[log.action]?.label || log.action,
            log.old_status || '-',
            log.new_status || '-',
            log.amount ? `₮${Number(log.amount).toLocaleString()}` : '-',
            METHOD_LABELS[log.payment_method || ''] || log.payment_method || '-',
            ACTOR_LABELS[log.actor] || log.actor,
            log.order_id?.substring(0, 8) || '-',
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payment_audit_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV татагдлаа');
    };

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
                subtitle="Захиалгын төлбөрийн бүх өөрчлөлтийг ил тод, бүрэн бүртгэлтэй хадгална."
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

            {/* Filters */}
            <div className="card-outlined p-4 md:p-5">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Action filter */}
                    <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Үйлдэл</label>
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
                        </select>
                    </div>

                    {/* Date range */}
                    <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Эхлэх</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="h-10 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 text-[13px] text-white/80 focus:outline-none focus:border-[var(--brand-indigo)] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Дуусах</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="h-10 bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 text-[13px] text-white/80 focus:outline-none focus:border-[var(--brand-indigo)] transition-colors"
                        />
                    </div>

                    {/* Clear */}
                    {(actionFilter || dateFrom || dateTo) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); }}
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
                        <p className="text-[11px] text-white/30 mt-1">Захиалгын төлбөр хийгдэх үед автоматаар бүртгэгдэнэ</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Огноо</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Үйлдэл</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Статус</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Дүн</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Арга</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Эх үүсвэр</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Захиалга</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {logs.map((log) => {
                                    const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.status_changed;
                                    const Icon = config.icon;

                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                                            {/* Date */}
                                            <td className="px-4 py-3.5">
                                                <div className="text-[12.5px] text-white/70 tabular-nums">
                                                    {new Date(log.created_at).toLocaleDateString('mn-MN')}
                                                </div>
                                                <div className="text-[10.5px] text-white/30 tabular-nums">
                                                    {new Date(log.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                            </td>

                                            {/* Action */}
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
                                            </td>

                                            {/* Status change */}
                                            <td className="px-4 py-3.5">
                                                {log.old_status && log.new_status ? (
                                                    <div className="flex items-center gap-1.5 text-[11.5px]">
                                                        <span className="text-white/35">{log.old_status}</span>
                                                        <span className="text-white/15">→</span>
                                                        <span className="text-white/70 font-medium">{log.new_status}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11.5px] text-white/35">{log.new_status || '—'}</span>
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td className="px-4 py-3.5 text-right">
                                                {log.amount ? (
                                                    <span className="text-[13px] font-semibold text-foreground tabular-nums">
                                                        ₮{Number(log.amount).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-white/20">—</span>
                                                )}
                                            </td>

                                            {/* Payment method */}
                                            <td className="px-4 py-3.5">
                                                <span className="text-[11.5px] text-white/50">
                                                    {METHOD_LABELS[log.payment_method || ''] || log.payment_method || '—'}
                                                </span>
                                            </td>

                                            {/* Actor */}
                                            <td className="px-4 py-3.5">
                                                <span className="text-[11.5px] text-white/50">
                                                    {ACTOR_LABELS[log.actor] || log.actor}
                                                </span>
                                            </td>

                                            {/* Order */}
                                            <td className="px-4 py-3.5">
                                                {log.order_id ? (
                                                    <span className="text-[11.5px] text-[var(--brand-indigo-400)] font-mono">
                                                        #{log.order_id.substring(0, 8)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-white/15">—</span>
                                                )}
                                            </td>
                                        </tr>
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
