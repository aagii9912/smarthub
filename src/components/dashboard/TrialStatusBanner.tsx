'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

/**
 * Global, persistent trial + token reminder (#1/#2). Rendered in the dashboard
 * shell so it shows on every dashboard page ("нүүрэн дээр"):
 *   - Active trial  → days remaining + token usage + upgrade CTA.
 *   - Expired trial → clear red "trial ended" notice + upgrade CTA.
 * Hidden on /dashboard/subscription, which has its own detailed trial cards.
 */
export function TrialStatusBanner() {
    const pathname = usePathname();
    const { data } = useSubscriptionStatus();

    if (!data) return null;
    if (pathname?.startsWith('/dashboard/subscription')) return null;
    if (!data.trialActive && !data.trialExpired) return null;

    const tokenPct = data.tokensMax > 0 ? Math.min((data.tokensUsed / data.tokensMax) * 100, 100) : 0;
    const tokenLabel =
        data.tokensMax > 0
            ? `${data.tokensUsed.toLocaleString()} / ${data.tokensMax.toLocaleString()}`
            : `${data.tokensUsed.toLocaleString()}`;

    // ── Expired ──────────────────────────────────────────────────────────────
    if (data.trialExpired) {
        return (
            <div
                role="alert"
                className="mx-4 md:mx-6 lg:mx-8 mt-3 mb-1 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
            >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" strokeWidth={1.75} />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 tracking-[-0.01em]">
                            Туршилтын хугацаа дууссан байна
                        </p>
                        <p className="mt-0.5 text-xs text-slate-300/80">
                            AI түр зогссон. Үргэлжлүүлэхийн тулд багц сонгож төлбөрөө төлнө үү.
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard/subscription?expired=1"
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-red-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                >
                    Багц сонгох
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </Link>
            </div>
        );
    }

    // ── Active trial ─────────────────────────────────────────────────────────
    const urgent = data.daysLeft <= 1;
    const accent = urgent
        ? { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: 'text-amber-400', btn: 'bg-amber-500 hover:bg-amber-600' }
        : { border: 'border-violet-500/30', bg: 'bg-violet-500/10', icon: 'text-violet-300', btn: 'bg-violet-500 hover:bg-violet-600' };

    return (
        <div
            role="status"
            className={`mx-4 md:mx-6 lg:mx-8 mt-3 mb-1 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border ${accent.border} ${accent.bg} px-4 py-3`}
        >
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <Clock className={`w-5 h-5 mt-0.5 shrink-0 ${accent.icon}`} strokeWidth={1.75} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 tracking-[-0.01em]">
                        Туршилтын хугацаа дуусахад {data.remainingText} үлдлээ
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300/80">
                            <Zap className="w-3.5 h-3.5 text-slate-300/60" strokeWidth={1.75} />
                            Токен: <span className="tabular-nums text-slate-200">{tokenLabel}</span>
                        </span>
                        {data.tokensMax > 0 && (
                            <span className="inline-flex items-center gap-1.5 min-w-[90px]">
                                <span className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                                    <span
                                        className="block h-full rounded-full"
                                        style={{
                                            width: `${tokenPct}%`,
                                            background: tokenPct > 85 ? 'var(--destructive)' : tokenPct > 65 ? 'var(--warning)' : 'var(--brand-indigo-400)',
                                        }}
                                    />
                                </span>
                                <span className="text-[11px] tabular-nums text-slate-400">{Math.round(tokenPct)}%</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <Link
                href="/dashboard/subscription"
                className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md ${accent.btn} px-3.5 py-2 text-xs font-semibold text-white transition-colors`}
            >
                Багц сонгох
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
        </div>
    );
}
