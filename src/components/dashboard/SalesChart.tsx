'use client';

import { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

interface ChartDataPoint {
    date: string;
    revenue: number;
    label: string;
}

interface SalesChartProps {
    data: ChartDataPoint[];
    type?: 'line' | 'bar';
    height?: number;
}

export function SalesChart({ data, type = 'line', height = 300 }: SalesChartProps) {
    const formatRevenue = (value: number) => {
        if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        }
        if (value >= 1000) {
            return `${(value / 1000).toFixed(0)}K`;
        }
        return value.toString();
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="font-medium text-sm text-gray-900">{label}</p>
                    <p className="text-primary font-semibold">
                        ₮{Number(payload[0].value).toLocaleString()}
                    </p>
                </div>
            );
        }
        return null;
    };

    const chartData = useMemo(() => data || [], [data]);

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg">
                <p className="text-gray-500">Өгөгдөл байхгүй</p>
            </div>
        );
    }

    const commonProps = {
        data: chartData,
        margin: { top: 5, right: 20, left: 10, bottom: 5 },
    };

    return (
        <ResponsiveContainer width="100%" height={height}>
            {type === 'line' ? (
                <LineChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                        tickFormatter={formatRevenue}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#65c51a"
                        strokeWidth={2}
                        dot={{ fill: '#65c51a', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#65c51a' }}
                    />
                </LineChart>
            ) : (
                <BarChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                        tickFormatter={formatRevenue}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                        dataKey="revenue"
                        fill="#65c51a"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            )}
        </ResponsiveContainer>
    );
}
