'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Search,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Download,
    Calendar,
    Filter,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    RotateCcw,
    FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
    created: { label: 'Үүсгэсэн', color: 'text-blue-400 bg-blue-400/10', icon: FileText },
    paid: { label: 'Төлөгдсөн', color: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
    failed: { label: 'Амжилтгүй', color: 'text-red-400 bg-red-400/10', icon: XCircle },
    expired: { label: 'Хугацаа дууссан', color: 'text-amber-400 bg-amber-400/10', icon: Clock },
    refunded: { label: 'Буцаалт', color: 'text-violet-400 bg-violet-400/10', icon: RotateCcw },
    status_changed: { label: 'Өөрчлөгдсөн', color: 'text-gray-400 bg-gray-400/10', icon: ArrowUpDown },
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

    const cardCls = 'bg-[#0F0B2E] rounded-lg border border-white/[0.08]';

    return (
        <div className="space-y-6 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-[18px] font-bold text-foreground tracking-[-0.02em]">Төлбөрийн Audit</h1>
                        <p className="text-[11px] text-white/40">Захиалгын төлбөрийн бүх өөрчлөлтийн бүртгэл</p>
                    </div>
                </div>
                <button
                    onClick={exportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-[12px] font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-all"
                >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                </button>
            </div>

            {/* Filters */}
            <div className={`${cardCls} p-4`}>
                <div className="flex flex-wrap items-end gap-3">
                    {/* Action filter */}
                    <div>
                        <label className="block text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Үйлдэл</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="bg-[#09090b] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 focus:outline-none focus:border-blue-500/50 min-w-[140px]"
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
                        <label className="block text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Эхлэх огноо</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-[#09090b] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1.5">Дуусах огноо</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-[#09090b] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    {/* Clear */}
                    {(actionFilter || dateFrom || dateTo) && (
                        <button
                            onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); }}
                            className="px-3 py-2 text-[12px] text-white/40 hover:text-white/70 transition-colors"
                        >
                            Цэвэрлэх
                        </button>
                    )}
                </div>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/30">
                    Нийт <span className="text-white/60 font-medium">{pagination.total}</span> бичлэг
                </p>
            </div>

            {/* Table */}
            <div className={`${cardCls} overflow-hidden`}>
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/30">
                        <Shield className="w-8 h-8 mb-2 text-white/10" />
                        <p className="text-[13px]">Audit бичлэг байхгүй</p>
                        <p className="text-[11px] text-white/20 mt-1">Захиалгын төлбөр хийгдэх үед автоматаар бүртгэгдэнэ</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Огноо</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Үйлдэл</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Статус</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Дүн</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Арга</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Эх үүсвэр</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Захиалга</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {logs.map((log) => {
                                    const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.status_changed;
                                    const Icon = config.icon;

                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                            {/* Date */}
                                            <td className="px-4 py-3">
                                                <div className="text-[12px] text-white/60 tabular-nums">
                                                    {new Date(log.created_at).toLocaleDateString('mn-MN')}
                                                </div>
                                                <div className="text-[10px] text-white/25 tabular-nums">
                                                    {new Date(log.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </div>
                                            </td>

                                            {/* Action */}
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
                                                    config.color
                                                )}>
                                                    <Icon className="w-3 h-3" />
                                                    {config.label}
                                                </span>
                                            </td>

                                            {/* Status change */}
                                            <td className="px-4 py-3">
                                                {log.old_status && log.new_status ? (
                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                        <span className="text-white/30">{log.old_status}</span>
                                                        <span className="text-white/15">→</span>
                                                        <span className="text-white/60 font-medium">{log.new_status}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-white/30">{log.new_status || '—'}</span>
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td className="px-4 py-3 text-right">
                                                {log.amount ? (
                                                    <span className="text-[12px] font-medium text-white/70 tabular-nums">
                                                        ₮{Number(log.amount).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-white/20">—</span>
                                                )}
                                            </td>

                                            {/* Payment method */}
                                            <td className="px-4 py-3">
                                                <span className="text-[11px] text-white/40">
                                                    {METHOD_LABELS[log.payment_method || ''] || log.payment_method || '—'}
                                                </span>
                                            </td>

                                            {/* Actor */}
                                            <td className="px-4 py-3">
                                                <span className="text-[11px] text-white/40">
                                                    {ACTOR_LABELS[log.actor] || log.actor}
                                                </span>
                                            </td>

                                            {/* Order */}
                                            <td className="px-4 py-3">
                                                {log.order_id ? (
                                                    <span className="text-[11px] text-blue-400/60 font-mono">
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
                    <p className="text-[11px] text-white/30">
                        Хуудас {pagination.page} / {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => fetchLogs(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="p-2 rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => fetchLogs(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="p-2 rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
