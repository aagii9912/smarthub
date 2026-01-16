'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatTimeAgo } from '@/lib/utils/date';
import {
    AlertTriangle,
    MessageSquare,
    Clock,
    Package,
    ArrowRight,
    CheckCircle2,
    XCircle,
} from 'lucide-react';

interface Conversation {
    customerId: string;
    customerName: string;
    messageCount: number;
    lastMessage: string;
    lastMessageAt: string;
    lastIntent: string | null;
    isAnswered: boolean;
}

interface LowStockProduct {
    id: string;
    name: string;
    stock: number;
    images: string[];
}

interface PendingOrder {
    id: string;
    total_amount: number;
    created_at: string;
    customers: { name: string } | null;
}

interface ActionCenterProps {
    conversations: Conversation[];
    lowStockProducts: LowStockProduct[];
    pendingOrders: PendingOrder[];
    unansweredCount: number;
}

export function ActionCenter({
    conversations,
    lowStockProducts,
    pendingOrders,
    unansweredCount,
}: ActionCenterProps) {
    const hasIssues = unansweredCount > 0 || lowStockProducts.length > 0 || pendingOrders.length > 0;

    // Calculate urgency based on time
    const getUrgencyColor = (dateString: string) => {
        const minutes = (Date.now() - new Date(dateString).getTime()) / 60000;
        if (minutes > 30) return 'text-red-500';
        if (minutes > 10) return 'text-amber-500';
        return 'text-muted-foreground';
    };

    const getUrgencyBg = (dateString: string) => {
        const minutes = (Date.now() - new Date(dateString).getTime()) / 60000;
        if (minutes > 30) return 'bg-red-50 border-red-200';
        if (minutes > 10) return 'bg-amber-50 border-amber-200';
        return 'bg-secondary/50 border-border';
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3 md:py-4">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 ${hasIssues ? 'text-amber-500' : 'text-emerald-500'}`} />
                    Анхаарал хэрэгтэй
                </CardTitle>
                {hasIssues && (
                    <Badge variant="danger" className="text-[10px] md:text-xs">
                        {unansweredCount + lowStockProducts.length + pendingOrders.length}
                    </Badge>
                )}
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
                {/* Хариулаагүй харилцагчид */}
                {unansweredCount > 0 && (
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-foreground">
                                Хариулаагүй ({unansweredCount})
                            </span>
                        </div>
                        <div className="space-y-2">
                            {conversations
                                .filter(c => !c.isAnswered)
                                .slice(0, 3)
                                .map(conv => (
                                    <Link
                                        key={conv.customerId}
                                        href="/dashboard/customers"
                                        className={`block p-3 rounded-xl border transition-colors hover:bg-secondary/30 ${getUrgencyBg(conv.lastMessageAt)}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-medium text-violet-600">
                                                        {conv.customerName.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm text-foreground truncate">
                                                            {conv.customerName}
                                                        </p>
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
                                                            {conv.messageCount} мессеж
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                        "{conv.lastMessage}"
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className={`text-[10px] ${getUrgencyColor(conv.lastMessageAt)}`}>
                                                    {formatTimeAgo(conv.lastMessageAt)}
                                                </span>
                                                <XCircle className="w-4 h-4 text-red-500" />
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                        </div>
                    </div>
                )}

                {/* Pending Orders */}
                {pendingOrders.length > 0 && (
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-medium text-foreground">
                                    Хүлээгдэж буй ({pendingOrders.length})
                                </span>
                            </div>
                            <Link href="/dashboard/orders" className="text-xs text-primary hover:underline">
                                Бүгдийг <ArrowRight className="w-3 h-3 inline" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {pendingOrders.slice(0, 3).map(order => (
                                <Link
                                    key={order.id}
                                    href="/dashboard/orders"
                                    className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm text-foreground">
                                            {order.customers?.name || 'Захиалга'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-foreground">
                                            ₮{Number(order.total_amount).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-amber-600">
                                            {formatTimeAgo(order.created_at)}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Low Stock */}
                {lowStockProducts.length > 0 && (
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-rose-500" />
                                <span className="text-sm font-medium text-foreground">
                                    Нөөц багатай ({lowStockProducts.length})
                                </span>
                            </div>
                            <Link href="/dashboard/products" className="text-xs text-primary hover:underline">
                                Засах <ArrowRight className="w-3 h-3 inline" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {lowStockProducts.slice(0, 3).map(product => (
                                <div
                                    key={product.id}
                                    className="flex items-center justify-between p-2 rounded-lg bg-rose-50 border border-rose-200"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-rose-200 flex items-center justify-center overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-4 h-4 text-rose-400" />
                                            )}
                                        </div>
                                        <span className="text-sm text-foreground truncate max-w-[120px]">
                                            {product.name}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-bold ${product.stock === 0 ? 'text-red-600' : 'text-rose-600'}`}>
                                        {product.stock === 0 ? 'Дууссан' : `${product.stock} ш`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!hasIssues && (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                        <p className="text-sm text-muted-foreground">
                            Бүгд хэвийн байна! 🎉
                        </p>
                    </div>
                )}

                {/* Хариулсан харилцагчид preview */}
                {conversations.filter(c => c.isAnswered).length > 0 && unansweredCount === 0 && (
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium text-foreground">
                                Сүүлийн харилцаанууд
                            </span>
                        </div>
                        <div className="space-y-2">
                            {conversations
                                .filter(c => c.isAnswered)
                                .slice(0, 3)
                                .map(conv => (
                                    <Link
                                        key={conv.customerId}
                                        href="/dashboard/customers"
                                        className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-medium text-emerald-600">
                                                    {conv.customerName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm text-foreground truncate">
                                                    {conv.customerName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatTimeAgo(conv.lastMessageAt)}
                                            </span>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        </div>
                                    </Link>
                                ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
