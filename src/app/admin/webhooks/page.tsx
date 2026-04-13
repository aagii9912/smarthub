'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, RefreshCw, Trash2, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function AdminWebhooksPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchJobs();
    }, [statusFilter]);

    async function fetchJobs() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/webhooks?status=${statusFilter}`);
            if (res.ok) {
                const data = await res.json();
                setJobs(data.jobs || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(jobId: string, action: 'retry' | 'delete') {
        if (action === 'delete' && !confirm('Энэг устгахдаа итгэлтэй байна уу?')) return;
        
        try {
            await fetch('/api/admin/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, action })
            });
            fetchJobs();
        } catch (e) {
            console.error(e);
        }
    }

    async function clearDead() {
        if (!confirm('Бүх DEAD төлөвтэй webhook-үүдийг устгах уу?')) return;
        try {
            await fetch('/api/admin/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear_dead' })
            });
            fetchJobs();
        } catch (e) {
            console.error(e);
        }
    }

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'dead': return <ShieldAlert className="w-5 h-5 text-rose-500" />;
            case 'failed': return <AlertCircle className="w-5 h-5 text-orange-500" />;
            case 'pending':
            case 'processing': return <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />;
            default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            'completed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
            'dead': 'bg-rose-50 text-rose-700 border-rose-100',
            'failed': 'bg-orange-50 text-orange-700 border-orange-100',
            'pending': 'bg-sky-50 text-sky-700 border-sky-100',
            'processing': 'bg-violet-50 text-violet-700 border-violet-100'
        };
        const color = colors[status] || 'bg-gray-50 text-gray-700 border-gray-100';
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider ${color}`}>{status}</span>;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Webhook Дахин Оролдлого (Retry Queue)</h1>
                    <p className="text-sm text-gray-500 mt-1">Системийн хэмжээнд тасалдсан болон алдаа гарсан webhook-үүдийн хяналт</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={clearDead} variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50">Бүх Dead устгах</Button>
                    <Button onClick={fetchJobs} className="bg-violet-600 hover:bg-violet-700 text-white">
                        <RefreshCw className="w-4 h-4 mr-2" /> Сэргээх
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 pb-2 overflow-x-auto">
                {['all', 'pending', 'processing', 'completed', 'failed', 'dead'].map(f => (
                    <button 
                        key={f} 
                        onClick={() => setStatusFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${statusFilter === f ? 'bg-violet-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                        {f.toUpperCase()}
                    </button>
                ))}
            </div>

            <Card className="border-gray-100 shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID & Төрөл</th>
                                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Төлөв</th>
                                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Оролдлого</th>
                                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Сүүлийн алдаа</th>
                                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Үйлдэл</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 align-top">
                            {loading && jobs.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" /></td></tr>
                            ) : jobs.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-sm text-gray-500">Бичлэг олдсонгүй</td></tr>
                            ) : (
                                jobs.map(j => (
                                    <tr key={j.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-gray-900 text-sm">{j.type}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mt-1">{j.id}</div>
                                            <div className="text-[11px] text-gray-500 mt-1">{new Date(j.created_at).toLocaleString('mn-MN')}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(j.status)}
                                                {getStatusBadge(j.status)}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="text-sm font-medium text-gray-900">{j.attempts} <span className="text-gray-400 font-normal">/ {j.max_attempts}</span></div>
                                            {j.next_retry_at && j.status !== 'completed' && j.status !== 'dead' && (
                                                <div className="text-[11px] text-violet-600 font-medium mt-1">Дараагийн: {new Date(j.next_retry_at).toLocaleTimeString('mn-MN')}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 max-w-[250px]">
                                            {j.last_error ? (
                                                <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded truncate" title={j.last_error}>{j.last_error}</div>
                                            ) : <span className="text-gray-400 text-xs">-</span>}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-1">
                                                {(j.status === 'dead' || j.status === 'failed') && (
                                                    <button onClick={() => handleAction(j.id, 'retry')} className="p-1.5 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-md transition-colors" title="Retry">
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleAction(j.id, 'delete')} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
