import { useId } from 'react';

interface SparklineProps {
    data: number[];
    height?: number;
    color?: string;
    fillOpacity?: number;
    className?: string;
}

export function Sparkline({
    data,
    height = 40,
    color = 'var(--brand-indigo)',
    fillOpacity = 0.3,
    className,
}: SparklineProps) {
    const gradientId = useId();
    if (!data.length) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data
        .map((v, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * 100;
            const y = height - ((v - min) / range) * height;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
    const area = `0,${height} ${points} 100,${height}`;

    return (
        <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            className={className}
            style={{ width: '100%', height }}
            role="img"
            aria-label="sparkline"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
