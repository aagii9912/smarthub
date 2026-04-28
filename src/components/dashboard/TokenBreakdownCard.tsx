'use client';

import { Layers, Info } from 'lucide-react';
import type { BreakdownDailyRow, BreakdownFeatureRow } from '@/hooks/useAIStats';

interface Props {
    currentPeriod: BreakdownFeatureRow[];
    last30Days: BreakdownDailyRow[];
}

const FEATURE_COLORS: Record<string, string> = {
    chat_reply:        'var(--brand-indigo)',
    ai_memo:           'var(--brand-violet-500)',
    vision:            'var(--brand-cyan)',
    system_prompt_gen: 'var(--gold)',
    product_parse:     'var(--success)',
    lead_qualify:      'var(--warning)',
    comment_auto:      '#a78bfa',
    tool_call:         '#34d399',
    unknown_legacy:    'rgba(255,255,255,0.35)',
};

function colorFor(feature: string): string {
    return FEATURE_COLORS[feature] ?? 'rgba(255,255,255,0.5)';
}

export function TokenBreakdownCard({ currentPeriod, last30Days }: Props) {
    const totalCurrent = currentPeriod.reduce((sum, r) => sum + r.tokens, 0);
    const totalCalls = currentPeriod.reduce((sum, r) => sum + r.calls, 0);

    const allFeatures = Array.from(
        new Set(currentPeriod.map(r => r.feature))
    );

    const dailyMax = last30Days.reduce((max, day) => {
        const dayTotal = Object.values(day.by_feature).reduce((s, v) => s + v, 0);
        return Math.max(max, dayTotal);
    }, 0);

    return (
        <div className="card-outlined overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                <Layers className="w-4 h-4 text-[var(--brand-violet-400)]" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">
                    Токен зарцуулалт төрлөөр
                </span>
            </div>

            <div className="p-5 space-y-5">
                <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 text-white/40 shrink-0" strokeWidth={1.5} />
                    <p className="text-[12px] text-white/55 tracking-[-0.01em] leading-relaxed">
                        Та чат хариулахаас гадна доорх AI үйлчилгээнүүдээс <strong className="text-white/75">бүгдээс</strong> токен зарцуулдаг.
                        Хаанаас зарцуулагдаж байгааг харж, төлөвлөхөд тань туслана.
                    </p>
                </div>

                {totalCurrent === 0 ? (
                    <p className="text-[12px] text-white/30 text-center py-8">
                        Энэ хугацаанд токен зарцуулагдаагүй байна
                    </p>
                ) : (
                    <>
                        <div>
                            <div className="flex justify-between items-baseline mb-3">
                                <p className="text-[11px] text-white/45 tracking-[-0.01em]">
                                    Энэ үе нийт
                                </p>
                                <p className="text-[12px] text-white/65 tabular-nums">
                                    {totalCurrent.toLocaleString()} token · {totalCalls.toLocaleString()} дуудлага
                                </p>
                            </div>

                            <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
                                {currentPeriod.map(row => {
                                    const pct = totalCurrent > 0 ? (row.tokens / totalCurrent) * 100 : 0;
                                    if (pct < 0.5) return null;
                                    return (
                                        <div
                                            key={row.feature}
                                            style={{ width: `${pct}%`, background: colorFor(row.feature) }}
                                            title={`${row.label_mn}: ${row.tokens.toLocaleString()} token (${pct.toFixed(1)}%)`}
                                        />
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                                {currentPeriod.map(row => {
                                    const pct = totalCurrent > 0 ? (row.tokens / totalCurrent) * 100 : 0;
                                    return (
                                        <div
                                            key={row.feature}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-white/[0.02] border border-white/[0.04]"
                                        >
                                            <span
                                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                                style={{ background: colorFor(row.feature) }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] text-white/75 truncate tracking-[-0.01em]">
                                                    {row.label_mn}
                                                </p>
                                                <p className="text-[10px] text-white/35 tabular-nums">
                                                    {row.calls.toLocaleString()} дуудлага
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[12px] text-white/85 tabular-nums tracking-[-0.01em]">
                                                    {row.tokens.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-white/40 tabular-nums">
                                                    {pct.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {last30Days.length > 0 && dailyMax > 0 && (
                            <div>
                                <p className="text-[11px] text-white/45 mb-2 tracking-[-0.01em]">
                                    Сүүлийн 30 хоног
                                </p>
                                <div className="flex items-end gap-[2px] h-28">
                                    {last30Days.map(day => {
                                        const dayTotal = Object.values(day.by_feature).reduce((s, v) => s + v, 0);
                                        const heightPct = (dayTotal / dailyMax) * 100;
                                        return (
                                            <div
                                                key={day.date}
                                                className="flex-1 flex flex-col-reverse min-w-0"
                                                title={`${day.date}: ${dayTotal.toLocaleString()} token`}
                                            >
                                                {allFeatures.map(feature => {
                                                    const value = day.by_feature[feature] ?? 0;
                                                    if (value === 0) return null;
                                                    const segmentPct = dayTotal > 0 ? (value / dayTotal) * heightPct : 0;
                                                    return (
                                                        <div
                                                            key={feature}
                                                            style={{
                                                                height: `${segmentPct}%`,
                                                                background: colorFor(feature),
                                                                minHeight: segmentPct > 0 ? '1px' : 0,
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-[10px] text-white/30 mt-2 tabular-nums">
                                    <span>{last30Days[0]?.date}</span>
                                    <span>{last30Days[last30Days.length - 1]?.date}</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
