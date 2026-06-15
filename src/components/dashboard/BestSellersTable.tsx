'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/utils/format';

interface BestSellerProduct {
    id: string;
    name: string;
    image: string | null;
    quantity: number;
    revenue: number;
    rank: number;
    percent: number;
}

interface BestSellersTableProps {
    products: BestSellerProduct[];
    loading?: boolean;
}

function rankClass(rank: number): string {
    if (rank === 1) return 'bg-[color-mix(in_oklab,var(--gold)_22%,transparent)] text-[var(--gold)]';
    if (rank === 2) return 'bg-[color-mix(in_oklab,var(--brand-indigo)_20%,transparent)] text-[var(--brand-indigo-400)]';
    if (rank === 3) return 'bg-[color-mix(in_oklab,var(--brand-violet-500)_20%,transparent)] text-[var(--brand-violet-500)]';
    return 'bg-white/[0.05] text-white/55';
}

export function BestSellersTable({ products, loading }: BestSellersTableProps) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-white/[0.02] rounded-lg">
                        <div className="w-8 h-8 bg-white/[0.05] rounded-full" />
                        <div className="w-12 h-12 bg-white/[0.05] rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/[0.05] rounded w-3/4" />
                            <div className="h-3 bg-white/[0.05] rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center py-12">
                <Package className="w-10 h-10 mx-auto mb-3 text-white/25" strokeWidth={1.2} />
                <p className="text-[13px] text-white/55">Борлуулалтын өгөгдөл алга</p>
                <p className="text-[11.5px] text-white/35 mt-1">Захиалга баталгаажмагц шилдэг бараа эндээс харагдана.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {products.map((product) => (
                <div
                    key={product.id}
                    className="flex items-center gap-4 p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors"
                >
                    {/* Rank */}
                    <div
                        className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 tabular-nums',
                            rankClass(product.rank)
                        )}
                    >
                        {product.rank}
                    </div>

                    {/* Image */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.08] flex-shrink-0">
                        {product.image ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-white/40" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate tracking-[-0.01em]">{product.name}</p>
                        <p className="text-xs text-white/50">{product.quantity} ширхэг борлуулсан</p>
                        {/* Progress bar */}
                        <div className="mt-1.5 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${product.percent}%`, background: 'var(--brand-indigo)' }}
                            />
                        </div>
                    </div>

                    {/* Revenue */}
                    <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm text-foreground tabular-nums">{formatCurrencyFull(product.revenue)}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
