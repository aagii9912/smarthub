'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';

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

export function BestSellersTable({ products, loading }: BestSellersTableProps) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-gray-200 rounded-full" />
                        <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Борлуулалтын өгөгдөл байхгүй</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {products.map((product) => (
                <div
                    key={product.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    {/* Rank */}
                    <div className={`
            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
            ${product.rank === 1 ? 'bg-yellow-100 text-yellow-700' : ''}
            ${product.rank === 2 ? 'bg-gray-200 text-gray-700' : ''}
            ${product.rank === 3 ? 'bg-orange-100 text-orange-700' : ''}
            ${product.rank > 3 ? 'bg-gray-100 text-gray-600' : ''}
          `}>
                        {product.rank}
                    </div>

                    {/* Image */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                        {product.image ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                <Package className="w-5 h-5 text-gray-400" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">
                            {product.quantity} ширхэг борлуулсан
                        </p>
                        {/* Progress bar */}
                        <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${product.percent}%` }}
                            />
                        </div>
                    </div>

                    {/* Revenue */}
                    <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-sm text-gray-900">
                            ₮{product.revenue.toLocaleString()}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
