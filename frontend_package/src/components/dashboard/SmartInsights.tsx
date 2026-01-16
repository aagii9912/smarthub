'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Lightbulb, AlertTriangle, Award, Package } from 'lucide-react';

interface SmartInsightsProps {
    bestSellers: Array<{
        name: string;
        quantity: number;
        revenue: number;
        percent: number;
    }>;
    revenue: {
        total: number;
        growth: number;
        orderCount: number;
    };
    period: string;
}

interface Insight {
    type: 'success' | 'warning' | 'tip' | 'info';
    icon: React.ReactNode;
    message: string;
}

export function SmartInsights({ bestSellers, revenue, period }: SmartInsightsProps) {
    const insights = useMemo<Insight[]>(() => {
        const result: Insight[] = [];

        // Revenue growth insight
        if (revenue.growth > 20) {
            result.push({
                type: 'success',
                icon: <TrendingUp className="w-4 h-4" />,
                message: `🎉 Борлуулалт ${revenue.growth}% өссөн байна! Маш сайн ажиллаж байна.`,
            });
        } else if (revenue.growth < -10) {
            result.push({
                type: 'warning',
                icon: <TrendingDown className="w-4 h-4" />,
                message: `⚠️ Борлуулалт ${Math.abs(revenue.growth)}% буурсан. Хямдрал эсвэл маркетинг хийх цаг боллоо.`,
            });
        }

        // Best seller insights
        if (bestSellers.length > 0) {
            const topProduct = bestSellers[0];
            if (topProduct.percent > 40) {
                result.push({
                    type: 'info',
                    icon: <Award className="w-4 h-4" />,
                    message: `🏆 "${topProduct.name}" нь нийт борлуулалтын ${topProduct.percent.toFixed(0)}%-ийг эзэлж байна!`,
                });
            }

            // Product diversity warning
            if (bestSellers.length >= 3) {
                const topThreePercent = bestSellers.slice(0, 3).reduce((sum, p) => sum + p.percent, 0);
                if (topThreePercent > 80) {
                    result.push({
                        type: 'tip',
                        icon: <Lightbulb className="w-4 h-4" />,
                        message: `💡 Топ 3 бараа ${topThreePercent.toFixed(0)}% эзэлж байна. Бусад бараагаа идэвхжүүлэхийг санал болгое.`,
                    });
                }
            }
        }

        // Order count insights
        if (revenue.orderCount > 0) {
            const avgOrderValue = revenue.total / revenue.orderCount;
            if (avgOrderValue < 50000) {
                result.push({
                    type: 'tip',
                    icon: <Package className="w-4 h-4" />,
                    message: `💡 Дундаж захиалга ₮${avgOrderValue.toLocaleString()}. Bundle хямдрал санал болговол дундаж дүнг нэмэгдүүлж болно.`,
                });
            }
        }

        // If no insights, add a default message
        if (result.length === 0) {
            result.push({
                type: 'info',
                icon: <Lightbulb className="w-4 h-4" />,
                message: `📊 ${getPeriodLabel(period)} борлуулалт хэвийн түвшинд байна.`,
            });
        }

        return result;
    }, [bestSellers, revenue, period]);

    if (insights.length === 0) return null;

    return (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4 border border-violet-100">
            <h3 className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-violet-600" />
                Ухаалаг Зөвлөгөө
            </h3>
            <div className="space-y-2">
                {insights.map((insight, idx) => (
                    <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg ${insight.type === 'success' ? 'bg-green-50 text-green-800' :
                                insight.type === 'warning' ? 'bg-orange-50 text-orange-800' :
                                    insight.type === 'tip' ? 'bg-blue-50 text-blue-800' :
                                        'bg-white text-gray-700'
                            }`}
                    >
                        <span className={`mt-0.5 ${insight.type === 'success' ? 'text-green-600' :
                                insight.type === 'warning' ? 'text-orange-600' :
                                    insight.type === 'tip' ? 'text-blue-600' :
                                        'text-gray-500'
                            }`}>
                            {insight.icon}
                        </span>
                        <p className="text-sm">{insight.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function getPeriodLabel(period: string): string {
    switch (period) {
        case 'today': return 'Өнөөдрийн';
        case 'week': return '7 хоногийн';
        case 'month': return 'Сарын';
        case 'year': return 'Жилийн';
        default: return '';
    }
}
