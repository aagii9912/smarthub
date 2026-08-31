'use client';

/**
 * CommentAutomationReport
 *
 * Lead-collection report for comment automations (live + post). Renders the
 * funnel a Mongolian shop cares about: how many people commented, how many left
 * a phone number ("авна 99XXXXXX"), and how many of those turned into orders.
 *
 * Data source: GET /api/dashboard/comment-automations/analytics
 * Strings are hard-coded Mongolian to match the rest of this page.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    MessageSquareMore,
    Phone,
    Wallet,
    TrendingUp,
    Radio,
    FileText,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';

type Analytics = {
    range: { from: string; to: string; days: number };
    totals: {
        leads: number;
        captured: number;
        missed: number;
        uniqueCommenters: number;
        phonesCaptured: number;
        dmSent: number;
        replySent: number;
    };
    /** Лид бизнес (үл хөдлөх / авто) — орлого, захиалга гэж хэмжигдэхгүй. */
    isLeadShop?: boolean;
    funnel: {
        qualifiedPhones: number;
        convertedPhones: number;
        ordersAttributed: number | null;
        revenue: number | null;
        conversionRate: number;
    };
    missed: {
        leads: number;
        phones: number;
        converted: number;
        revenue: number | null;
    };
    bySource: {
        live: { leads: number; phones: number };
        post: { leads: number; phones: number };
    };
    byAutomation: Array<{
        automationId: string | null;
        name: string;
        leads: number;
        phones: number;
        converted: number;
        revenue: number | null;
    }>;
    timeSeries: Array<{ date: string; leads: number; phones: number }>;
    recentLeads: Array<{
        id: string;
        commenter_name: string | null;
        extracted_phone: string | null;
        comment_text: string | null;
        source_type: 'live' | 'post';
        capture_type: 'automation' | 'missed';
        platform: 'facebook' | 'instagram';
        matched_keyword: string | null;
        dm_sent: boolean;
        reply_sent: boolean;
        status: string;
        created_at: string;
    }>;
};

const RANGES = [
    { days: 7, label: '7 хоног' },
    { days: 30, label: '30 хоног' },
    { days: 90, label: '90 хоног' },
];

const SOURCES = [
    { value: '', label: 'Бүгд' },
    { value: 'live', label: 'Live' },
    { value: 'post', label: 'Пост' },
];

const CAPTURES = [
    { value: '', label: 'Бүгд' },
    { value: 'automation', label: 'Барьсан' },
    { value: 'missed', label: 'Алдсан' },
];

function fmt(n: number): string {
    return new Intl.NumberFormat('mn-MN').format(n);
}

function fmtMoney(n: number): string {
    return `${new Intl.NumberFormat('mn-MN').format(Math.round(n))}₮`;
}

export default function CommentAutomationReport({ shopId }: { shopId: string }) {
    const [days, setDays] = useState(30);
    const [source, setSource] = useState('');
    const [capture, setCapture] = useState('');
    const [data, setData] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);
    // Дуудсаны дараа тухайн мөрийг шууд шинэчилж харуулах (сервер эргэж
    // ирэхийг хүлээхгүй). Хоосон бол серверийн утга хүчинтэй.
    const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ days: String(days) });
            if (source) params.set('source_type', source);
            if (capture) params.set('capture_type', capture);
            const res = await fetch(`/api/dashboard/comment-automations/analytics?${params}`, {
                headers: { 'x-shop-id': shopId },
            });
            if (res.ok) {
                setData(await res.json());
            } else {
                setData(null);
            }
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [days, source, capture, shopId]);

    /**
     * «Алдсан»-г гар аргаар холбогдсоны дараа тэмдэглэх. Үүнгүйгээр тайлангийн
     * өөрийнх нь зөвлөсөн ажил (жагсаалтаас утасдах) хаана ч бүртгэгддэггүй тул
     * маргааш нь ижил 30 дугаар «Алдсан» хэвээр эргэж ирдэг байсан.
     */
    const markLead = useCallback(async (leadId: string, status: 'contacted' | 'converted') => {
        setStatusOverride((prev) => ({ ...prev, [leadId]: status }));
        try {
            const res = await fetch(`/api/dashboard/comment-automations/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error('failed');
        } catch {
            setStatusOverride((prev) => {
                const next = { ...prev };
                delete next[leadId];
                return next;
            });
        }
    }, [shopId]);

    useEffect(() => {
        load();
    }, [load]);

    const maxSeries = data ? Math.max(1, ...data.timeSeries.map((d) => d.leads)) : 1;

    return (
        <div className="space-y-6">
            {/* Toolbar: range + source filter */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
                    {RANGES.map((r) => (
                        <button
                            key={r.days}
                            onClick={() => setDays(r.days)}
                            className={`px-3 py-1.5 text-[12px] rounded-md transition-colors tracking-[-0.01em] ${
                                days === r.days ? 'bg-white/[0.08] text-foreground' : 'text-white/45 hover:text-white/70'
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
                    {SOURCES.map((s) => (
                        <button
                            key={s.value}
                            onClick={() => setSource(s.value)}
                            className={`px-3 py-1.5 text-[12px] rounded-md transition-colors tracking-[-0.01em] ${
                                source === s.value ? 'bg-white/[0.08] text-foreground' : 'text-white/45 hover:text-white/70'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <div className="inline-flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
                    {CAPTURES.map((s) => (
                        <button
                            key={s.value}
                            onClick={() => setCapture(s.value)}
                            className={`px-3 py-1.5 text-[12px] rounded-md transition-colors tracking-[-0.01em] ${
                                capture === s.value ? 'bg-white/[0.08] text-foreground' : 'text-white/45 hover:text-white/70'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-24 card-outlined animate-pulse" />
                        ))}
                    </div>
                    <div className="h-64 card-outlined animate-pulse" />
                </div>
            ) : !data || data.totals.leads === 0 ? (
                <div className="card-outlined p-10 md:p-14 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                        <MessageSquareMore className="w-7 h-7 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-[16px] font-semibold text-foreground mb-1 tracking-[-0.02em]">
                        Одоогоор lead алга
                    </h3>
                    <p className="text-[13px] text-white/45 max-w-sm tracking-[-0.01em]">
                        Автомат дүрэм тань пост болон live дээрх сэтгэгдлийг барьж эхлэхэд цугларсан lead, утасны дугаар энд харагдана.
                    </p>
                </div>
            ) : (
                <>
                    {/* KPI cards */}
                    <div className={data.isLeadShop ? 'grid grid-cols-2 lg:grid-cols-4 gap-3' : 'grid grid-cols-2 lg:grid-cols-5 gap-3'}>
                        <KpiCard icon={<MessageSquareMore className="w-4 h-4" />} label="Нийт lead" value={fmt(data.totals.leads)} hint={`${fmt(data.totals.uniqueCommenters)} хүн`} />
                        <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Барьсан" value={fmt(data.totals.captured)} tone="green" hint="дүрэм DM илгээсэн" />
                        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Алдсан" value={fmt(data.totals.missed)} tone="amber" hint={`${fmt(data.missed.phones)} утас`} />
                        <KpiCard icon={<Phone className="w-4 h-4" />} label="Цугларсан утас" value={fmt(data.totals.phonesCaptured)} tone="indigo" />
                        {!data.isLeadShop && (
                            <KpiCard icon={<Wallet className="w-4 h-4" />} label="Орлого" value={fmtMoney(data.funnel.revenue ?? 0)} tone="indigo" />
                        )}
                    </div>

                    {/* Missed opportunities banner */}
                    {data.missed.leads > 0 && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3">
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13px] text-foreground font-medium tracking-[-0.01em]">
                                    {fmt(data.missed.phones)} утасны дугаар дүрэмд ороогүй өнгөрчээ
                                </p>
                                <p className="text-[12px] text-white/50 mt-0.5 tracking-[-0.01em]">
                                    Эдгээр хүмүүс сэтгэгдэлдээ дугаараа үлдээсэн ч таны автомат дүрэм барьж аваагүй тул DM хүлээж аваагүй. Доорх жагсаалтаас «Алдсан»-г шүүж гар аргаар холбогдох, эсвэл тэдний хэрэглэсэн түлхүүр үгээр шинэ дүрэм нэмээрэй.
                                    {data.missed.converted > 0 && (data.isLeadShop
                                        ? ` (${fmt(data.missed.converted)} нь эцэстээ хөрвөсөн байна.)`
                                        : ` (${fmt(data.missed.converted)} нь өөрсдөө захиалга хийсэн байна.)`)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Funnel + source split */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="card-outlined p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">Хөрвөлтийн жим</h3>
                            </div>
                            <FunnelRow label="Сэтгэгдэл бичсэн" value={data.totals.uniqueCommenters} max={data.totals.uniqueCommenters} />
                            <FunnelRow label="Утсаа үлдээсэн" value={data.funnel.qualifiedPhones} max={data.totals.uniqueCommenters} />
                            <FunnelRow label={data.isLeadShop ? 'Хөрвүүлсэн' : 'Захиалга хийсэн'} value={data.funnel.convertedPhones} max={data.totals.uniqueCommenters} accent />
                            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                                <span className="text-[12px] text-white/45 tracking-[-0.01em]">{data.isLeadShop ? 'Утас → хөрвөлт' : 'Утас → захиалга хөрвөлт'}</span>
                                <span className="text-[15px] font-semibold text-foreground tabular-nums">
                                    {(data.funnel.conversionRate * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="card-outlined p-5">
                            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-4">Эх сурвалж</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <SourceCard icon={<Radio className="w-4 h-4" />} label="Live" leads={data.bySource.live.leads} phones={data.bySource.live.phones} />
                                <SourceCard icon={<FileText className="w-4 h-4" />} label="Пост" leads={data.bySource.post.leads} phones={data.bySource.post.phones} />
                            </div>
                        </div>
                    </div>

                    {/* Daily time series */}
                    {data.timeSeries.length > 0 && (
                        <div className="card-outlined p-5">
                            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-4">Өдрийн lead</h3>
                            <div className="flex items-end gap-1 h-32">
                                {data.timeSeries.map((d) => (
                                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                                        <div
                                            className="w-full rounded-t-sm bg-[var(--brand-indigo-400)]/30 group-hover:bg-[var(--brand-indigo-400)]/60 transition-colors"
                                            style={{ height: `${(d.leads / maxSeries) * 100}%`, minHeight: d.leads > 0 ? '3px' : '0' }}
                                        />
                                        <div className="absolute -top-7 hidden group-hover:block bg-[var(--surface-2,#1a1a1a)] border border-white/[0.1] rounded px-2 py-1 text-[10px] text-white/80 whitespace-nowrap tabular-nums z-10">
                                            {d.date.slice(5)}: {d.leads} lead
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Per-automation table */}
                    {data.byAutomation.length > 0 && (
                        <div className="card-outlined overflow-hidden">
                            <div className="px-5 py-3 border-b border-white/[0.06]">
                                <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">Дүрэм тус бүрээр</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="text-white/40 text-[11px] uppercase tracking-wider">
                                            <th className="text-left font-medium px-5 py-2.5">Дүрэм</th>
                                            <th className="text-right font-medium px-3 py-2.5">Lead</th>
                                            <th className="text-right font-medium px-3 py-2.5">Утас</th>
                                            <th className="text-right font-medium px-3 py-2.5">{data.isLeadShop ? 'Хөрвүүлсэн' : 'Захиалга'}</th>
                                            {!data.isLeadShop && <th className="text-right font-medium px-5 py-2.5">Орлого</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byAutomation.map((a) => (
                                            <tr key={a.automationId ?? 'none'} className="border-t border-white/[0.04]">
                                                <td className="px-5 py-3 text-foreground tracking-[-0.01em]">{a.name}</td>
                                                <td className="px-3 py-3 text-right tabular-nums text-white/70">{fmt(a.leads)}</td>
                                                <td className="px-3 py-3 text-right tabular-nums text-white/70">{fmt(a.phones)}</td>
                                                <td className="px-3 py-3 text-right tabular-nums text-white/70">{fmt(a.converted)}</td>
                                                {!data.isLeadShop && (
                                                    <td className="px-5 py-3 text-right tabular-nums text-foreground">{fmtMoney(a.revenue ?? 0)}</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Recent leads */}
                    <div className="card-outlined overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/[0.06]">
                            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.01em]">Сүүлийн lead-үүд</h3>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {data.recentLeads.map((lead) => {
                                const l = { ...lead, status: statusOverride[lead.id] ?? lead.status };
                                return (
                                <div key={l.id} className="px-5 py-3 flex items-start gap-3">
                                    <span
                                        className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                            l.source_type === 'live'
                                                ? 'bg-rose-500/15 text-rose-300'
                                                : 'bg-white/[0.06] text-white/55'
                                        }`}
                                    >
                                        {l.source_type === 'live' ? <Radio className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                                        {l.source_type === 'live' ? 'Live' : 'Пост'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                                                {l.commenter_name || 'Хэрэглэгч'}
                                            </span>
                                            {l.extracted_phone && (
                                                <a
                                                    href={`tel:${l.extracted_phone}`}
                                                    className="inline-flex items-center gap-1 text-[12px] text-[var(--brand-indigo-400)] tabular-nums hover:underline"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                    {l.extracted_phone}
                                                </a>
                                            )}
                                            {l.status === 'converted' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300">
                                                    {data.isLeadShop ? 'Хөрвүүлсэн' : 'Захиалсан'}
                                                </span>
                                            )}
                                            {l.status === 'contacted' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.08] text-white/60">
                                                    Холбогдсон
                                                </span>
                                            )}
                                            {l.capture_type === 'missed' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300">
                                                    Алдсан
                                                </span>
                                            )}
                                        </div>
                                        {l.comment_text && (
                                            <p className="text-[12px] text-white/45 truncate mt-0.5 tracking-[-0.01em]">{l.comment_text}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {l.extracted_phone && l.status === 'new' && (
                                            <button
                                                type="button"
                                                onClick={() => markLead(l.id, 'contacted')}
                                                className="rounded-md px-2 py-1 text-[11px] font-medium text-white/60 bg-white/[0.06] hover:bg-white/[0.12] hover:text-foreground transition-colors whitespace-nowrap"
                                            >
                                                Холбогдсон
                                            </button>
                                        )}
                                        {l.extracted_phone && l.status === 'contacted' && (
                                            <button
                                                type="button"
                                                onClick={() => markLead(l.id, 'converted')}
                                                className="rounded-md px-2 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors whitespace-nowrap"
                                            >
                                                Хөрвүүлсэн
                                            </button>
                                        )}
                                        <div className="text-[11px] text-white/30 tabular-nums whitespace-nowrap">
                                            {new Date(l.created_at).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function KpiCard({
    icon,
    label,
    value,
    hint,
    tone = 'default',
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    hint?: string;
    tone?: 'default' | 'indigo' | 'green' | 'amber';
}) {
    const toneClass = {
        default: 'bg-white/[0.04] text-white/55',
        indigo: 'bg-[var(--brand-indigo-400)]/15 text-[var(--brand-indigo-400)]',
        green: 'bg-emerald-500/15 text-emerald-300',
        amber: 'bg-amber-500/15 text-amber-300',
    }[tone];
    return (
        <div className="card-outlined p-4">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-3 ${toneClass}`}>
                {icon}
            </div>
            <div className="text-[20px] font-semibold text-foreground tabular-nums tracking-[-0.02em] leading-none">{value}</div>
            <div className="text-[12px] text-white/45 mt-1.5 tracking-[-0.01em]">{label}</div>
            {hint && <div className="text-[11px] text-white/30 mt-0.5 tabular-nums">{hint}</div>}
        </div>
    );
}

function FunnelRow({ label, value, max, accent }: { label: string; value: number; max: number; accent?: boolean }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-white/55 tracking-[-0.01em]">{label}</span>
                <span className="text-[12px] font-medium text-foreground tabular-nums">{fmt(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                    className={`h-full rounded-full ${accent ? 'bg-emerald-400/70' : 'bg-[var(--brand-indigo-400)]/60'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function SourceCard({ icon, label, leads, phones }: { icon: React.ReactNode; label: string; leads: number; phones: number }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-white/55 mb-2">
                {icon}
                <span className="text-[12px] font-medium tracking-[-0.01em]">{label}</span>
            </div>
            <div className="text-[18px] font-semibold text-foreground tabular-nums tracking-[-0.02em]">{fmt(leads)}</div>
            <div className="text-[11px] text-white/40 mt-0.5 tabular-nums">{fmt(phones)} утас</div>
        </div>
    );
}
