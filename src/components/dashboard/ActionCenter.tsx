'use client';

import Link from 'next/link';
import { formatTimeAgo } from '@/lib/utils/date';
import {
    AlertTriangle,
    MessageSquare,
    Clock,
    Package,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Sparkles,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const totalIssues = unansweredCount + lowStockProducts.length + pendingOrders.length;

    return (
        <div className="rounded-2xl bg-[#0F0B2E] backdrop-blur-sm border border-white/[0.08] overflow-hidden transition-all duration-300 hover:border-[#4A7CE7]/20">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center',
                        hasIssues
                            ? 'bg-gradient-to-br from-blue-500/10 to-violet-500/10'
                            : 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10'
                    )}>
                        {hasIssues ? (
                            <Zap className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                        ) : (
                            <Sparkles className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                        )}
                    </div>
                    <span className="text-[14px] font-bold text-foreground tracking-[-0.02em]">Анхаарал</span>
                </div>
                {hasIssues && (
                    <span className="text-[11px] font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 w-6 h-6 rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(239,68,68,0.3)]">
                        {totalIssues}
                    </span>
                )}
            </div>

            <div className="divide-y divide-white/[0.06]">
                {/* Unanswered conversations */}
                {unansweredCount > 0 && (
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                            <span className="text-[12px] font-semibold text-foreground tracking-[-0.01em]">
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
                                        className="block p-3 rounded-xl bg-[#0F0B2E] border border-white/[0.04] hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all duration-200"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/10 to-rose-500/10 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[12px] font-bold text-red-500">
                                                        {conv.customerName.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-[13px] text-foreground truncate tracking-[-0.01em]">
                                                        {conv.customerName}
                                                    </p>
                                                    <p className="text-[11px] text-white/40 truncate mt-0.5">
                                                        &ldquo;{conv.lastMessage}&rdquo;
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-white/30 flex-shrink-0 font-medium">
                                                {formatTimeAgo(conv.lastMessageAt)}
                                            </span>
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
                                <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
                                <span className="text-[12px] font-semibold text-foreground tracking-[-0.01em]">
                                    Хүлээгдэж буй ({pendingOrders.length})
                                </span>
                            </div>
                            <Link href="/dashboard/orders" className="text-[11px] text-white/40 hover:text-blue-500 transition-colors flex items-center gap-1 font-medium">
                                Бүгдийг <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {pendingOrders.slice(0, 3).map(order => (
                                <Link
                                    key={order.id}
                                    href="/dashboard/orders"
                                    className="flex items-center justify-between p-3 rounded-xl bg-[#0F0B2E] border border-white/[0.04] hover:border-blue-500/20 transition-all duration-200"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center">
                                            <Package className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                                            {order.customers?.name || 'Захиалга'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[13px] font-bold text-foreground tabular-nums tracking-[-0.02em]">
                                            ₮{Number(order.total_amount).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-white/30 mt-0.5">
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
                                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                                <span className="text-[12px] font-semibold text-foreground tracking-[-0.01em]">
                                    Нөөц багатай ({lowStockProducts.length})
                                </span>
                            </div>
                            <Link href="/dashboard/products" className="text-[11px] text-white/40 hover:text-blue-500 transition-colors flex items-center gap-1 font-medium">
                                Засах <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {lowStockProducts.slice(0, 3).map(product => (
                                <div
                                    key={product.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-[#0F0B2E] border border-white/[0.04]"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.04] from-white/[0.08] to-white/[0.04] flex items-center justify-center overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <Package className="w-3.5 h-3.5 text-black/20 dark:text-white/20" strokeWidth={1.5} />
                                            )}
                                        </div>
                                        <span className="text-[13px] font-medium text-foreground truncate max-w-[120px] tracking-[-0.01em]">
                                            {product.name}
                                        </span>
                                    </div>
                                    <span className={cn(
                                        'text-[12px] font-bold px-2 py-0.5 rounded-lg',
                                        product.stock === 0
                                            ? 'text-red-500 bg-red-500/10'
                                            : 'text-blue-500 bg-blue-500/10'
                                    )}>
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
                        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={1.5} />
                        </div>
                        <p className="text-[14px] font-semibold text-foreground mb-1">Бүгд хэвийн! 🎉</p>
                        <p className="text-[12px] text-white/40">
                            Анхаарал шаардлагатай зүйл байхгүй
                        </p>
                    </div>
                )}

                {/* Answered conversations preview */}
                {conversations.filter(c => c.isAnswered).length > 0 && unansweredCount === 0 && (
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[12px] font-semibold text-foreground tracking-[-0.01em]">
                                Сүүлийн харилцаанууд
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {conversations
                                .filter(c => c.isAnswered)
                                .slice(0, 3)
                                .map(conv => (
                                    <Link
                                        key={conv.customerId}
                                        href="/dashboard/customers"
                                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/[0.02] dark:hover:bg-[#0D0928] transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-[10px] font-bold text-emerald-500">
                                                    {conv.customerName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-[13px] font-medium text-foreground truncate tracking-[-0.01em]">
                                                {conv.customerName}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-white/30">
                                                {formatTimeAgo(conv.lastMessageAt)}
                                            </span>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
                                        </div>
                                    </Link>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
