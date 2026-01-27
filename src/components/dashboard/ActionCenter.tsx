'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
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
        if (minutes > 30) return 'text-red-400';
        if (minutes > 10) return 'text-amber-400';
        return 'text-zinc-500';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="rounded-2xl overflow-hidden"
            style={{
                background: 'rgba(24, 24, 27, 0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-zinc-800/50">
                <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold text-white">
                    <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 ${hasIssues ? 'text-amber-400' : 'text-emerald-400'}`} />
                    Анхаарал хэрэгтэй
                </h3>
                {hasIssues && (
                    <span className="px-2 py-0.5 text-[10px] md:text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        {unansweredCount + lowStockProducts.length + pendingOrders.length}
                    </span>
                )}
            </div>

            <div className="divide-y divide-zinc-800/50">
                {/* Хариулаагүй харилцагчид */}
                {unansweredCount > 0 && (
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-medium text-white">
                                Хариулаагүй ({unansweredCount})
                            </span>
                        </div>
                        <div className="space-y-2">
                            {conversations
                                .filter(c => !c.isAnswered)
                                .slice(0, 3)
                                .map((conv, index) => (
                                    <motion.div
                                        key={conv.customerId}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + index * 0.05 }}
                                    >
                                        <Link
                                            href="/dashboard/customers"
                                            className="block p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                                                        <span className="text-xs font-medium text-indigo-400">
                                                            {conv.customerName.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm text-white truncate">
                                                                {conv.customerName}
                                                            </p>
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-400">
                                                                {conv.messageCount} мессеж
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                                                            "{conv.lastMessage}"
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <span className={`text-[10px] ${getUrgencyColor(conv.lastMessageAt)}`}>
                                                        {formatTimeAgo(conv.lastMessageAt)}
                                                    </span>
                                                    <XCircle className="w-4 h-4 text-red-400" />
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Pending Orders */}
                {pendingOrders.length > 0 && (
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-white">
                                    Хүлээгдэж буй ({pendingOrders.length})
                                </span>
                            </div>
                            <Link href="/dashboard/orders" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                Бүгдийг <ArrowRight className="w-3 h-3 inline" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {pendingOrders.slice(0, 3).map((order, index) => (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.6 + index * 0.05 }}
                                >
                                    <Link
                                        href="/dashboard/orders"
                                        className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-amber-400" />
                                            <span className="text-sm text-white">
                                                {order.customers?.name || 'Захиалга'}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-white">
                                                ₮{Number(order.total_amount).toLocaleString()}
                                            </p>
                                            <p className="text-[10px] text-amber-400">
                                                {formatTimeAgo(order.created_at)}
                                            </p>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Low Stock */}
                {lowStockProducts.length > 0 && (
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-rose-400" />
                                <span className="text-sm font-medium text-white">
                                    Нөөц багатай ({lowStockProducts.length})
                                </span>
                            </div>
                            <Link href="/dashboard/products" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                                Засах <ArrowRight className="w-3 h-3 inline" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {lowStockProducts.slice(0, 3).map((product, index) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.6 + index * 0.05 }}
                                    className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-rose-500/30 flex items-center justify-center overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-4 h-4 text-rose-400" />
                                            )}
                                        </div>
                                        <span className="text-sm text-white truncate max-w-[120px]">
                                            {product.name}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-bold ${product.stock === 0 ? 'text-red-400' : 'text-rose-400'}`}>
                                        {product.stock === 0 ? 'Дууссан' : `${product.stock} ш`}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!hasIssues && (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                        <p className="text-sm text-zinc-400">
                            Бүгд хэвийн байна! 🎉
                        </p>
                    </div>
                )}

                {/* Хариулсан харилцагчид preview */}
                {conversations.filter(c => c.isAnswered).length > 0 && unansweredCount === 0 && (
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-medium text-white">
                                Сүүлийн харилцаанууд
                            </span>
                        </div>
                        <div className="space-y-2">
                            {conversations
                                .filter(c => c.isAnswered)
                                .slice(0, 3)
                                .map((conv, index) => (
                                    <motion.div
                                        key={conv.customerId}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + index * 0.05 }}
                                    >
                                        <Link
                                            href="/dashboard/customers"
                                            className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                                                    <span className="text-xs font-medium text-emerald-400">
                                                        {conv.customerName.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white truncate">
                                                        {conv.customerName}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-500">
                                                    {formatTimeAgo(conv.lastMessageAt)}
                                                </span>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
