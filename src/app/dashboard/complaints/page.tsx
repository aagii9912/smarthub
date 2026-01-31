'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    AlertTriangle,
    MessageSquare,
    CheckCircle,
    Clock,
    Filter,
    Search,
    XCircle,
    Package,
    Truck,
    HeadphonesIcon,
    DollarSign,
    MoreHorizontal
} from 'lucide-react';

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

const complaintTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    product_quality: { label: 'Барааны чанар', icon: <Package className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
    delivery: { label: 'Хүргэлт', icon: <Truck className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
    service: { label: 'Үйлчилгээ', icon: <HeadphonesIcon className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
    price: { label: 'Үнэ', icon: <DollarSign className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
    other: { label: 'Бусад', icon: <MoreHorizontal className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50' },
};

const severityLabels: Record<string, { label: string; color: string }> = {
    low: { label: 'Бага', color: 'text-gray-600 bg-gray-100' },
    medium: { label: 'Дунд', color: 'text-yellow-600 bg-yellow-50' },
    high: { label: 'Өндөр', color: 'text-red-600 bg-red-50' },
};

const statusLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    new: { label: 'Шинэ', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
    in_progress: { label: 'Шийдвэрлэж байна', icon: <Clock className="w-4 h-4" />, color: 'text-yellow-600 bg-yellow-50' },
    resolved: { label: 'Шийдэгдсэн', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
    dismissed: { label: 'Хаагдсан', icon: <XCircle className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' },
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Гомдлууд</h1>
                <p className="text-gray-500 mt-1">Харилцагчдын санал хүсэлт, гомдлууд</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.total}</p>
                                <p className="text-sm text-gray-500">Нийт</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-600">{stats.new}</p>
                                <p className="text-sm text-gray-500">Шинэ</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-50 rounded-lg">
                                <Clock className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                                <p className="text-sm text-gray-500">Шийдвэрлэж буй</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                                <p className="text-sm text-gray-500">Шийдэгдсэн</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Хайх..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            >
                                <option value="all">Бүгд</option>
                                <option value="new">Шинэ</option>
                                <option value="in_progress">Шийдвэрлэж буй</option>
                                <option value="resolved">Шийдэгдсэн</option>
                                <option value="dismissed">Хаагдсан</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Complaints List */}
            <Card>
                <CardHeader>
                    <CardTitle>Гомдлын жагсаалт</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Уншиж байна...</div>
                    ) : filteredComplaints.length === 0 ? (
                        <div className="text-center py-8">
                            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">Гомдол байхгүй байна</p>
                            <p className="text-sm text-gray-400 mt-1">AI чатбот харилцагчдаас гомдол хүлээн авахад энд харагдана</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredComplaints.map((complaint) => {
                                const typeInfo = complaintTypeLabels[complaint.complaint_type] || complaintTypeLabels.other;
                                const severityInfo = severityLabels[complaint.severity] || severityLabels.medium;
                                const statusInfo = statusLabels[complaint.status] || statusLabels.new;

                                return (
                                    <div key={complaint.id} className="py-4 first:pt-0 last:pb-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                                                        {typeInfo.icon}
                                                        {typeInfo.label}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityInfo.color}`}>
                                                        {severityInfo.label}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                                                        {statusInfo.icon}
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                                <p className="text-gray-900 mb-1">{complaint.description}</p>
                                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                                    <span>{complaint.customers?.name || 'Үл мэдэгдэх'}</span>
                                                    <span>{new Date(complaint.created_at).toLocaleDateString('mn-MN')}</span>
                                                </div>
                                            </div>
                                            {complaint.status !== 'resolved' && complaint.status !== 'dismissed' && (
                                                <div className="flex items-center gap-2">
                                                    {complaint.status === 'new' && (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
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
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
