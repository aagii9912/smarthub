import React from 'react';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return <div className={`skeleton ${className}`} />;
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
    return (
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-2xl" />
            </div>
        </div>
    );
}

// Order List Item Skeleton
export function OrderItemSkeleton() {
    return (
        <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4 flex-1">
                <Skeleton className="w-9 h-9 md:w-10 md:h-10 rounded-xl" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-14 rounded-full" />
            </div>
        </div>
    );
}

// Table Skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full max-w-[200px]" />
                        <Skeleton className="h-3 w-full max-w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
            ))}
        </div>
    );
}

// Dashboard Loading State
export function DashboardSkeleton() {
    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatsCardSkeleton />
                <StatsCardSkeleton />
                <StatsCardSkeleton />
                <StatsCardSkeleton />
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card rounded-2xl border border-border">
                    <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border">
                        <Skeleton className="h-5 w-32" />
                    </div>
                    <div className="divide-y divide-border">
                        <OrderItemSkeleton />
                        <OrderItemSkeleton />
                        <OrderItemSkeleton />
                    </div>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
                    <Skeleton className="h-5 w-32 mb-4" />
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    );
}
