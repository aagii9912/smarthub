import { cn } from '@/lib/utils';

interface ChartBarProps {
    data: number[];
    height?: number;
    color?: string;
    className?: string;
}

export function ChartBar({ data, height = 120, color = 'var(--brand-indigo)', className }: ChartBarProps) {
    const max = Math.max(...data, 1);
    return (
        <div
            className={cn('flex items-end gap-1 w-full', className)}
            style={{ height }}
            role="img"
            aria-label="hourly bar chart"
        >
            {data.map((v, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all duration-300"
                    style={{
                        height: `${Math.max((v / max) * 100, 2)}%`,
                        background: `linear-gradient(to top, ${color}, color-mix(in oklab, ${color} 40%, transparent))`,
                    }}
                    title={String(v)}
                />
            ))}
        </div>
    );
}
