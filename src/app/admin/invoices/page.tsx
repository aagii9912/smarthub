'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import {
    FileText, Search, Plus, ChevronLeft, ChevronRight,
    CheckCircle, Clock, AlertCircle, Download
} from 'lucide-react';

interface Invoice {
    id: string;
    shop_id: string;
    subscription_id: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue' | 'canceled';
    due_date: string;
    paid_at: string | null;
    created_at: string;
    shops: { id: string; name: string; email: string };
    subscriptions?: { id: string; status: string; plans: { name: string } };
}

interface Totals {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
}

export default function AdminInvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [totals, setTotals] = useState<Totals>({ total: 0, paid: 0, pending: 0, overdue: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchInvoices();
    }, [page, statusFilter]);

    async function fetchInvoices() {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: page.toString(), limit: '10' });
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`/api/admin/invoices?${params}`);
            if (res.ok) {
                const data = await res.json();
                setInvoices(data.invoices || []);
                setTotals(data.totals || { total: 0, paid: 0, pending: 0, overdue: 0 });
                setTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(invoiceId: string, newStatus: string) {
        try {
            const res = await fetch('/api/admin/invoices', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_id: invoiceId, status: newStatus })
            });
            if (res.ok) {
                fetchInvoices();
            }
        } catch (error) {
            console.error('Update error:', error);
        }
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            paid: 'bg-green-100 text-green-700',
            pending: 'bg-yellow-100 text-yellow-700',
            overdue: 'bg-red-100 text-red-700',
            canceled: 'bg-gray-100 text-gray-700'
        };
        return styles[status] || 'bg-gray-100 text-gray-700';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'overdue': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return null;
        }
    };

    const formatMoney = (amount: number) => `₮${amount.toLocaleString()}`;

    const filteredInvoices = invoices.filter(inv =>
        !searchTerm ||
        inv.shops?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                    <p className="text-gray-500 mt-1">Төлбөрийн нэхэмжлэл удирдах</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-gray-500">Нийт</p>
                        <p className="text-2xl font-bold text-gray-900">{formatMoney(totals.total)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-gray-500">Төлөгдсөн</p>
                        <p className="text-2xl font-bold text-green-600">{formatMoney(totals.paid)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-gray-500">Хүлээгдэж буй</p>
                        <p className="text-2xl font-bold text-yellow-600">{formatMoney(totals.pending)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-sm text-gray-500">Хугацаа хэтэрсэн</p>
                        <p className="text-2xl font-bold text-red-600">{formatMoney(totals.overdue)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Дэлгүүр хайх..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            <option value="">Бүх статус</option>
                            <option value="paid">Төлөгдсөн</option>
                            <option value="pending">Хүлээгдэж буй</option>
                            <option value="overdue">Хугацаа хэтэрсэн</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full" />
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Invoice олдсонгүй
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Дэлгүүр</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Багц</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Дүн</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Төлөх огноо</th>
                                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Үйлдэл</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredInvoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{inv.shops?.name}</p>
                                                    <p className="text-sm text-gray-500">{inv.shops?.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">
                                                {inv.subscriptions?.plans?.name || '-'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {formatMoney(inv.amount)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(inv.status)}`}>
                                                    {getStatusIcon(inv.status)}
                                                    {inv.status === 'paid' ? 'Төлөгдсөн' : inv.status === 'pending' ? 'Хүлээгдэж буй' : 'Хугацаа хэтэрсэн'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {inv.due_date ? new Date(inv.due_date).toLocaleDateString('mn-MN') : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={inv.status}
                                                    onChange={(e) => updateStatus(inv.id, e.target.value)}
                                                    className="text-sm border border-gray-200 rounded px-2 py-1"
                                                >
                                                    <option value="pending">Хүлээгдэж буй</option>
                                                    <option value="paid">Төлөгдсөн</option>
                                                    <option value="overdue">Хугацаа хэтэрсэн</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" /> Өмнөх
                            </button>
                            <span className="text-sm text-gray-500">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                                Дараах <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
