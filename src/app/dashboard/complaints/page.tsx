'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
    AlertTriangle,
    MessageSquare,
    CheckCircle,
    Clock,
    Search,
    XCircle,
    Package,
    Truck,
    HeadphonesIcon,
    DollarSign,
    MoreHorizontal,
    Filter,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Complaint {
    id: string;
    shop_id: string;
    customer_id: string;
    complaint_type: 'product_quality' | 'delivery' | 'service' | 'price' | 'other';
    description: string;
    severity: 'low' | 'medium' | 'high';
    status: 'new' | 'in_progress' | 'resolved' | 'dismissed';
    resolution_notes: string | null;
    created_at: string;
    updated_at: string;
    customers?: {
        name: string | null;
        phone: string | null;
    };
}

const complaintTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    product_quality: { label: 'Барааны чанар', icon: <Package className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    delivery: { label: 'Хүргэлт', icon: <Truck className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    service: { label: 'Үйлчилгээ', icon: <HeadphonesIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    price: { label: 'Үнэ', icon: <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    other: { label: 'Бусад', icon: <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} /> },
};

const severityLabels: Record<string, { label: string }> = {
    low: { label: 'Бага' },
    medium: { label: 'Дунд' },
    high: { label: 'Өндөр' },
};

const statusLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    new: { label: 'Шинэ', icon: <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    in_progress: { label: 'Шийдвэрлэж байна', icon: <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    resolved: { label: 'Шийдэгдсэн', icon: <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> },
    dismissed: { label: 'Хаагдсан', icon: <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> },
};

export default function ComplaintsPage() {
    const { shop } = useAuth();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
        queryKey: ['complaints', shop?.id],
        queryFn: async () => {
            const res = await fetch('/api/dashboard/complaints', {
                headers: { 'x-shop-id': shop?.id || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch complaints');
            const data = await res.json();
            return data.complaints || [];
        },
        enabled: !!shop?.id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, resolution_notes }: { id: string; status: string; resolution_notes?: string }) => {
            const res = await fetch('/api/dashboard/complaints', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shop?.id || ''
                },
                body: JSON.stringify({ id, status, resolution_notes })
            });
            if (!res.ok) throw new Error('Failed to update');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['complaints'] });
        }
    });

    const filteredComplaints = complaints.filter(c => {
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesSearch = !searchQuery ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const stats = {
        total: complaints.length,
        new: complaints.filter(c => c.status === 'new').length,
        inProgress: complaints.filter(c => c.status === 'in_progress').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
    };

    const statCards = [
        { label: 'Нийт гомдол', value: stats.total, tone: 'neutral' as const },
        { label: 'Шинэ', value: stats.new, tone: 'danger' as const, highlight: stats.new > 0 },
        { label: 'Шийдвэрлэж буй', value: stats.inProgress, tone: 'info' as const },
        { label: 'Шийдэгдсэн', value: stats.resolved, tone: 'success' as const },
    ];

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="Харилцагчийн санал"
                title="Гомдол & хүсэлт"
                subtitle="Харилцагчдаас ирсэн гомдлыг хүлээн авч, шийдвэрлэсэн төлөвт шилжүүлнэ."
                actions={
                    <Button variant="ghost" size="md" leftIcon={<Filter className="h-4 w-4" strokeWidth={1.5} />}>
                        Шүүлтүүр
                    </Button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {statCards.map((stat) => (
                    <div key={stat.label} className={cn(stat.highlight ? 'card-featured' : 'card-outlined', 'p-5')}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {stat.label}
                        </p>
                        <p
                            className={cn(
                                'mt-2 text-3xl font-bold tabular-nums tracking-[-0.02em]',
                                stat.tone === 'danger' && stat.highlight
                                    ? 'text-[var(--destructive)]'
                                    : stat.tone === 'success'
                                        ? 'text-[var(--success)]'
                                        : stat.tone === 'info'
                                            ? 'text-[var(--brand-indigo-400)]'
                                            : 'text-foreground'
                            )}
                        >
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card-outlined p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Хайх..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 h-10 border border-white/[0.08] rounded-lg text-[13px] bg-white/[0.02] focus:outline-none focus:border-[var(--brand-indigo)] focus:bg-white/[0.04] transition-colors tracking-[-0.01em] placeholder:text-white/30"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-10 px-3 border border-white/[0.08] rounded-lg text-[13px] bg-white/[0.02] focus:outline-none focus:border-[var(--brand-indigo)] transition-colors tracking-[-0.01em]"
                    >
                        <option value="all">Бүх төлөв</option>
                        <option value="new">Шинэ</option>
                        <option value="in_progress">Шийдвэрлэж буй</option>
                        <option value="resolved">Шийдэгдсэн</option>
                        <option value="dismissed">Хаагдсан</option>
                    </select>
                </div>
            </div>

            {/* Complaints List */}
            <div className="card-outlined overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                    <AlertTriangle className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Гомдлын жагсаалт</span>
                    <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                        {filteredComplaints.length} бичлэг
                    </span>
                </div>
                <div>
                    {isLoading ? (
                        <div className="text-center py-10 text-[13px] text-white/40">Уншиж байна...</div>
                    ) : filteredComplaints.length === 0 ? (
                        <div className="text-center py-14 px-6">
                            <MessageSquare className="w-10 h-10 text-white/10 mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-[13px] text-white/50 tracking-[-0.01em]">Гомдол байхгүй байна</p>
                            <p className="text-[11px] text-white/30 mt-1">AI чатбот харилцагчдаас гомдол хүлээн авахад энд харагдана</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/[0.04]">
                            {filteredComplaints.map((complaint) => {
                                const typeInfo = complaintTypeLabels[complaint.complaint_type] || complaintTypeLabels.other;
                                const severityInfo = severityLabels[complaint.severity] || severityLabels.medium;
                                const statusInfo = statusLabels[complaint.status] || statusLabels.new;

                                return (
                                    <li
                                        key={complaint.id}
                                        className="px-5 py-4 hover:bg-white/[0.03] transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-foreground">
                                                        {typeInfo.icon}
                                                        {typeInfo.label}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'px-2 py-0.5 rounded-md text-[11px] font-medium',
                                                            complaint.severity === 'high'
                                                                ? 'bg-[color-mix(in_oklab,var(--destructive)_20%,transparent)] text-[var(--destructive)]'
                                                                : complaint.severity === 'medium'
                                                                    ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_20%,transparent)] text-[var(--brand-indigo-400)]'
                                                                    : 'bg-white/[0.06] text-white/50'
                                                        )}
                                                    >
                                                        {severityInfo.label}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium',
                                                            complaint.status === 'new'
                                                                ? 'bg-[color-mix(in_oklab,var(--destructive)_20%,transparent)] text-[var(--destructive)]'
                                                                : complaint.status === 'resolved'
                                                                    ? 'bg-[color-mix(in_oklab,var(--success)_20%,transparent)] text-[var(--success)]'
                                                                    : complaint.status === 'in_progress'
                                                                        ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_20%,transparent)] text-[var(--brand-indigo-400)]'
                                                                        : 'bg-white/[0.06] text-white/50'
                                                        )}
                                                    >
                                                        {statusInfo.icon}
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                                <p className="text-[13.5px] text-foreground mb-1.5 tracking-[-0.01em] leading-relaxed">
                                                    {complaint.description}
                                                </p>
                                                <div className="flex items-center gap-3 text-[12px] text-white/40">
                                                    <span className="font-medium text-white/60">
                                                        {complaint.customers?.name || 'Үл мэдэгдэх'}
                                                    </span>
                                                    <span>·</span>
                                                    <span className="tabular-nums">
                                                        {new Date(complaint.created_at).toLocaleDateString('mn-MN')}
                                                    </span>
                                                </div>
                                            </div>
                                            {complaint.status !== 'resolved' && complaint.status !== 'dismissed' && (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {complaint.status === 'new' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => updateStatusMutation.mutate({
                                                                id: complaint.id,
                                                                status: 'in_progress'
                                                            })}
                                                            disabled={updateStatusMutation.isPending}
                                                        >
                                                            Хүлээн авах
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => updateStatusMutation.mutate({
                                                            id: complaint.id,
                                                            status: 'resolved',
                                                            resolution_notes: 'Шийдэгдсэн'
                                                        })}
                                                        disabled={updateStatusMutation.isPending}
                                                    >
                                                        Шийдсэн
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
