'use client';

import { Wallet, Info, Truck, CreditCard } from 'lucide-react';
import { PaymentStatusBadge } from '@/components/ui/Badge';
import { formatCurrencyFull } from '@/lib/utils/format';

interface RevenuePaymentBreakdownProps {
    grossTotal: number;
    paidTotal: number;
    paymentBreakdown: { paid: number; pending: number; failed: number; refunded: number };
    paymentCounts: { paid: number; pending: number; failed: number; refunded: number };
    codTotal: number;
    prepaidTotal: number;
}

const STATUS_ORDER: Array<{ key: keyof RevenuePaymentBreakdownProps['paymentBreakdown']; color: string }> = [
    { key: 'paid', color: 'var(--success)' },
    { key: 'pending', color: 'var(--warning)' },
    { key: 'failed', color: 'var(--destructive)' },
    { key: 'refunded', color: 'rgba(255,255,255,0.45)' },
];

export function RevenuePaymentBreakdown({
    grossTotal,
    paidTotal,
    paymentBreakdown,
    paymentCounts,
    codTotal,
    prepaidTotal,
}: RevenuePaymentBreakdownProps) {
    const segments = STATUS_ORDER
        .map(({ key, color }) => ({
            key,
            color,
            amount: paymentBreakdown[key],
            count: paymentCounts[key],
            pct: grossTotal > 0 ? (paymentBreakdown[key] / grossTotal) * 100 : 0,
        }))
        .filter((s) => s.amount > 0);

    return (
        <div className="card-outlined overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                <Wallet className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">Орлогын задаргаа</span>
                <span className="ml-auto text-[12px] text-white/45 tabular-nums">
                    Нийт захиалга {formatCurrencyFull(grossTotal)}
                </span>
            </div>

            <div className="p-5 space-y-4">
                {/* Stacked proportion bar */}
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    {segments.map((s) => (
                        <div key={s.key} style={{ width: `${s.pct}%`, background: s.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
                    ))}
                </div>

                {/* Status rows */}
                <div className="space-y-2.5">
                    {STATUS_ORDER.map(({ key }) => (
                        <div key={key} className="flex items-center justify-between">
                            <PaymentStatusBadge status={key} />
                            <div className="flex items-center gap-2.5">
                                <span className="text-[11px] text-white/40 tabular-nums">{paymentCounts[key]} захиалга</span>
                                <span className="text-[13px] font-semibold text-foreground tabular-nums w-24 text-right">
                                    {formatCurrencyFull(paymentBreakdown[key])}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* COD vs prepaid */}
                {(codTotal > 0 || prepaidTotal > 0) && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                                <Truck className="h-3.5 w-3.5" strokeWidth={1.8} /> Хүргэлтээр (COD)
                            </div>
                            <p className="mt-1 text-[15px] font-semibold text-foreground tabular-nums">{formatCurrencyFull(codTotal)}</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                                <CreditCard className="h-3.5 w-3.5" strokeWidth={1.8} /> Урьдчилсан төлбөр
                            </div>
                            <p className="mt-1 text-[15px] font-semibold text-foreground tabular-nums">{formatCurrencyFull(prepaidTotal)}</p>
                        </div>
                    </div>
                )}

                {/* Disclosure footnote */}
                <div className="flex items-start gap-2 rounded-lg bg-white/[0.02] p-2.5">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" strokeWidth={1.8} />
                    <p className="text-[11.5px] leading-relaxed text-white/40">
                        «Нийт орлого» нь зөвхөн <span className="text-white/60">төлөгдсөн</span> захиалгыг ({formatCurrencyFull(paidTotal)}) тооцдог. Хүлээгдэж буй төлбөр баталгаажмагц орлогод нэмэгдэнэ.
                    </p>
                </div>
            </div>
        </div>
    );
}
