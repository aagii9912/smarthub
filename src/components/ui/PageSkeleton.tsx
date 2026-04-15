'use client';

interface PageSkeletonProps {
    /** Number of stat cards to show */
    statCards?: number;
    /** Whether to show a table/list skeleton */
    showTable?: boolean;
    /** Whether to show a chart area */
    showChart?: boolean;
}

function SkeletonBlock({ className }: { className?: string }) {
    return (
        <div className={`bg-[#0F0B2E] rounded-lg animate-pulse border border-white/[0.08] ${className || ''}`} />
    );
}

export function PageSkeleton({ statCards = 0, showTable = true, showChart = false }: PageSkeletonProps) {
    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Title skeleton */}
            <div className="flex items-center gap-3">
                <SkeletonBlock className="w-10 h-10 !rounded-lg" />
                <div className="space-y-2">
                    <SkeletonBlock className="h-5 w-40" />
                    <SkeletonBlock className="h-3 w-56" />
                </div>
            </div>

            {/* Stat cards */}
            {statCards > 0 && (
                <div className={`grid grid-cols-2 lg:grid-cols-${Math.min(statCards, 4)} gap-3`}>
                    {Array.from({ length: statCards }).map((_, i) => (
                        <SkeletonBlock key={i} className="h-28" />
                    ))}
                </div>
            )}

            {/* Chart area */}
            {showChart && <SkeletonBlock className="h-80" />}

            {/* Table/List area */}
            {showTable && <SkeletonBlock className="h-96" />}
        </div>
    );
}
