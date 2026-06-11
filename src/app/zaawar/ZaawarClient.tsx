"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronRight,
    ExternalLink,
    Lightbulb,
    Play,
    X,
} from "lucide-react";
import { CANVAS, ZAAWAR_TOPICS, type ZaawarTopic } from "./content";

const STORAGE_KEY = "syncly_zaawar_visited";
const VISITED_EVENT = "syncly-zaawar-visited";

/** Хүчинтэй сэдвийн id-ууд — localStorage-аас уншсан утгыг үүгээр шүүнэ */
const TOPIC_IDS = new Set(ZAAWAR_TOPICS.map((t) => t.id));

/**
 * Үзсэн сэдвүүдийг localStorage-д хадгалж, useSyncExternalStore-оор уншина.
 * Snapshot-ын reference тогтвортой байх ёстой тул raw утгаар кэшилнэ.
 * localStorage хаалттай орчинд (private mode г.м.) кэш нь session доторх
 * in-memory төлөв болж ажиллана.
 */
const EMPTY_VISITED: Set<string> = new Set();
let visitedCacheRaw: string | null = null;
let visitedCache: Set<string> = EMPTY_VISITED;

function parseVisited(raw: string | null): Set<string> {
    if (!raw) return EMPTY_VISITED;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return EMPTY_VISITED;
        return new Set(
            parsed.filter(
                (v): v is string => typeof v === "string" && TOPIC_IDS.has(v)
            )
        );
    } catch {
        return EMPTY_VISITED;
    }
}

function readVisited(): Set<string> {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Storage хаалттай — session доторх in-memory төлвөө буцаана
        return visitedCache;
    }
    if (raw !== visitedCacheRaw) {
        visitedCacheRaw = raw;
        visitedCache = parseVisited(raw);
    }
    return visitedCache;
}

function subscribeVisited(onChange: () => void) {
    window.addEventListener(VISITED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(VISITED_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
}

function markVisited(id: string) {
    const current = readVisited();
    if (current.has(id)) return;
    const next = new Set(current).add(id);
    visitedCache = next;
    try {
        const raw = JSON.stringify([...next]);
        localStorage.setItem(STORAGE_KEY, raw);
        visitedCacheRaw = raw;
    } catch {
        // Storage хаалттай орчинд явц зөвхөн энэ session-д in-memory хадгалагдана
    }
    window.dispatchEvent(new Event(VISITED_EVENT));
}

/** Төвөөс bubble руу татах зөөлөн муруй холбоос */
function connectorPath(topic: ZaawarTopic): string {
    const { cx, cy } = CANVAS;
    const { x, y } = topic.pos;
    const mx = (cx + x) / 2;
    const my = (cy + y) / 2;
    // Муруйлтын хяналтын цэгийг шугамын перпендикуляр чиглэлд бага зэрэг хазайлгана
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const bend = 28;
    const qx = mx + (-dy / len) * bend;
    const qy = my + (dx / len) * bend;
    return `M ${cx} ${cy} Q ${qx} ${qy} ${x} ${y}`;
}

export default function ZaawarClient() {
    const topics = ZAAWAR_TOPICS;
    const [activeId, setActiveId] = useState<string | null>(null);
    const visited = useSyncExternalStore(
        subscribeVisited,
        readVisited,
        () => EMPTY_VISITED
    );

    const activeIndex = topics.findIndex((t) => t.id === activeId);
    const active = activeIndex === -1 ? null : topics[activeIndex];
    // Хадгалагдсан id-уудыг одоогийн сэдвүүдтэй огтлолцуулж тоолно
    const visitedCount = topics.reduce(
        (n, t) => n + (visited.has(t.id) ? 1 : 0),
        0
    );

    const panelRef = useRef<HTMLDivElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);

    const openTopic = (id: string) => {
        if (!activeId) {
            // Panel шинээр нээгдэхэд фокусыг буцаах элементийг санана
            restoreFocusRef.current =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
        }
        setActiveId(id);
        markVisited(id);
    };

    // Panel нээгдэхэд фокусыг дотогш нь шилжүүлж, хаагдахад буцаана
    useEffect(() => {
        if (active) {
            panelRef.current?.focus();
        } else if (restoreFocusRef.current) {
            restoreFocusRef.current.focus();
            restoreFocusRef.current = null;
        }
    }, [active]);

    // Panel нээлттэй үед: Escape-ээр хаах, ар талын scroll-ыг түгжих
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActiveId(null);
        };
        window.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [active]);

    return (
        <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[#06060f] text-white antialiased overflow-x-hidden">
            {/* Background effects — landing-тэй ижил хэв маяг */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-600/[0.15] via-violet-600/[0.08] to-transparent blur-3xl" />
                <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-3xl" />
                <div className="absolute top-[60%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.04] blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
            </div>

            {/* Panel нээлттэй үед ар талын агуулгыг фокус болон AT-аас бүрэн хаана */}
            <div inert={!!active}>
                {/* Header */}
                <header className="relative z-10 max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-5">
                    <Link href="/" className="flex items-center gap-2.5">
                        <Image src="/logo.png" alt="Syncly" width={28} height={28} />
                        <span className="font-semibold tracking-tight">Syncly</span>
                        <span className="text-white/30">/</span>
                        <span className="text-white/60 text-sm">Заавар</span>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="text-sm px-4 py-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10 transition-colors"
                    >
                        Хяналтын самбар
                    </Link>
                </header>

                {/* Hero */}
                <section className="relative z-10 max-w-3xl mx-auto text-center px-4 sm:px-6 pt-6 pb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] ring-1 ring-white/10 text-xs text-white/60 mb-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Интерактив заавар
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                        Syncly-г{" "}
                        <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                            алхам алхмаар
                        </span>{" "}
                        эзэмшээрэй
                    </h1>
                    <p className="mt-4 text-white/55 text-sm sm:text-base max-w-xl mx-auto">
                        Бөмбөлөг бүр дээр дарж тухайн сэдвийн заавартай танилцаарай. Эсвэл
                        хөтөчөөр бүгдийг нь дэс дарааллаар нь үзээрэй.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
                        <button
                            onClick={() => openTopic(topics[0].id)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                            <Play className="w-4 h-4" />
                            Хөтөчөөр эхлэх
                        </button>
                        <div className="flex items-center gap-2.5 text-xs text-white/50">
                            <div
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={topics.length}
                                aria-valuenow={visitedCount}
                                aria-label="Үзсэн сэдвийн явц"
                                className="w-28 h-1.5 rounded-full bg-white/10 overflow-hidden"
                            >
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 transition-all duration-500"
                                    style={{ width: `${(visitedCount / topics.length) * 100}%` }}
                                />
                            </div>
                            {visitedCount}/{topics.length} сэдэв үзсэн
                        </div>
                    </div>
                </section>

                {/* ───── Desktop: Mind map ───── */}
                <section className="relative z-10 hidden md:block max-w-5xl mx-auto px-6 pb-20">
                    <div
                        className="relative w-full"
                        style={{ aspectRatio: `${CANVAS.w} / ${CANVAS.h}` }}
                    >
                        {/* Холбоос шугамууд */}
                        <svg
                            className="absolute inset-0 w-full h-full"
                            viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
                            fill="none"
                            aria-hidden
                        >
                            {topics.map((t) => (
                                <path
                                    key={t.id}
                                    d={connectorPath(t)}
                                    stroke={t.color.stroke}
                                    strokeWidth={1.5}
                                    strokeDasharray="5 7"
                                    className="zw-dash"
                                />
                            ))}
                        </svg>

                        {/* Төв bubble — дарвал хөтөч эхэлнэ */}
                        <div
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{
                                left: `${(CANVAS.cx / CANVAS.w) * 100}%`,
                                top: `${(CANVAS.cy / CANVAS.h) * 100}%`,
                            }}
                        >
                            <button
                                onClick={() => openTopic(topics[0].id)}
                                className="relative w-36 h-36 rounded-full bg-gradient-to-b from-indigo-500/30 to-violet-500/10 backdrop-blur ring-1 ring-indigo-400/40 flex flex-col items-center justify-center gap-1.5 hover:scale-105 transition-transform shadow-2xl shadow-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                                aria-label="Хөтөчөөр эхлэх"
                            >
                                <span className="absolute inset-0 rounded-full ring-1 ring-indigo-400/20 animate-ping [animation-duration:3s]" />
                                <Image src="/logo.png" alt="" width={36} height={36} />
                                <span className="font-bold text-sm">Syncly</span>
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">
                                    Заавар
                                </span>
                            </button>
                        </div>

                        {/* Сэдвийн bubble-ууд */}
                        {topics.map((t, i) => {
                            const Icon = t.icon;
                            const isVisited = visited.has(t.id);
                            return (
                                <div
                                    key={t.id}
                                    className="absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        left: `${(t.pos.x / CANVAS.w) * 100}%`,
                                        top: `${(t.pos.y / CANVAS.h) * 100}%`,
                                    }}
                                >
                                    <div
                                        className="zw-float"
                                        style={{
                                            animationDelay: `${i * -0.9}s`,
                                            animationDuration: `${6 + (i % 3)}s`,
                                        }}
                                    >
                                        <button
                                            onClick={() => openTopic(t.id)}
                                            aria-label={`${i + 1}. ${t.title}${isVisited ? " — үзсэн" : ""}`}
                                            className={`relative w-[118px] h-[118px] rounded-full bg-gradient-to-b ${t.color.bubble} backdrop-blur ring-1 ${t.color.ring} flex flex-col items-center justify-center gap-1.5 px-3 hover:scale-110 transition-transform shadow-xl shadow-transparent ${t.color.glow} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
                                        >
                                            <span
                                                aria-hidden
                                                className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${isVisited ? "bg-emerald-500" : t.color.badge} text-[11px] font-bold flex items-center justify-center ring-2 ring-[#06060f]`}
                                            >
                                                {isVisited ? <Check className="w-3.5 h-3.5" /> : i + 1}
                                            </span>
                                            <Icon className={`w-7 h-7 ${t.color.text}`} />
                                            <span className="text-[11px] font-semibold leading-tight text-center text-white/85">
                                                {t.label ?? t.title}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ───── Mobile: Аяллын зам ───── */}
                <section className="relative z-10 md:hidden max-w-md mx-auto px-4 pb-16">
                    <div className="relative">
                        <div className="absolute left-10 top-8 bottom-8 w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/25 to-transparent" />
                        <div className="space-y-3">
                            {topics.map((t, i) => {
                                const Icon = t.icon;
                                const isVisited = visited.has(t.id);
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => openTopic(t.id)}
                                        aria-label={`${i + 1}. ${t.title}${isVisited ? " — үзсэн" : ""}`}
                                        className="relative z-10 w-full flex items-center gap-4 p-4 rounded-2xl bg-[#0c0c1a] ring-1 ring-white/[0.07] hover:ring-white/15 transition-all text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                    >
                                        <span
                                            className={`relative shrink-0 w-12 h-12 rounded-full bg-gradient-to-b ${t.color.bubble} ring-1 ${t.color.ring} flex items-center justify-center`}
                                        >
                                            <Icon className={`w-5 h-5 ${t.color.text}`} />
                                            <span
                                                aria-hidden
                                                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${isVisited ? "bg-emerald-500" : t.color.badge} text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0c0c1a]`}
                                            >
                                                {isVisited ? <Check className="w-3 h-3" /> : i + 1}
                                            </span>
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-semibold text-sm">{t.title}</span>
                                            <span className="block text-xs text-white/45 mt-0.5 line-clamp-2">
                                                {t.short}
                                            </span>
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ───── Бүрэн заавар (текстээр) — хайлтын систем болон JS-гүй орчинд уншигдана ───── */}
                <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-16">
                    <h2 className="text-lg font-bold mb-1">Бүх заавар нэг дор</h2>
                    <p className="text-sm text-white/45 mb-5">
                        Сэдэв бүрийн дэлгэрэнгүй алхмуудыг жагсаалтаар уншаарай.
                    </p>
                    <div className="space-y-2">
                        {topics.map((t, i) => (
                            <details
                                key={t.id}
                                className="group rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] overflow-hidden"
                            >
                                <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none text-sm font-semibold hover:bg-white/[0.02] transition-colors">
                                    <span
                                        className={`shrink-0 w-6 h-6 rounded-full ${t.color.badge} text-[11px] font-bold flex items-center justify-center`}
                                        aria-hidden
                                    >
                                        {i + 1}
                                    </span>
                                    {t.title}
                                    <ChevronRight className="ml-auto w-4 h-4 text-white/30 shrink-0 transition-transform group-open:rotate-90" />
                                </summary>
                                <div className="px-4 pb-4 pt-1">
                                    <p className="text-[13px] text-white/55 mb-3">{t.short}</p>
                                    <ol className="space-y-2.5 list-none">
                                        {t.steps.map((step, j) => (
                                            <li key={j} className="text-[13px] leading-relaxed">
                                                <span className="font-semibold text-white/80">
                                                    {j + 1}. {step.title}.
                                                </span>{" "}
                                                <span className="text-white/50">{step.desc}</span>
                                            </li>
                                        ))}
                                    </ol>
                                    {t.tip && (
                                        <p className="mt-3 text-[13px] text-amber-100/80 leading-relaxed">
                                            💡 {t.tip}
                                        </p>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>

                {/* CTA footer */}
                <section className="relative z-10 max-w-3xl mx-auto text-center px-4 pb-16">
                    <p className="text-white/45 text-sm mb-4">Бэлэн үү? Дэлгүүрээ нээгээд эхлээрэй.</p>
                    <Link
                        href="/auth/register"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#06060f] text-sm font-semibold hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                        Үнэгүй эхлэх
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </section>
            </div>

            {/* ───── Зааврын panel ───── */}
            <AnimatePresence>
                {active && (
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setActiveId(null)}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            key={active.id}
                            ref={panelRef}
                            tabIndex={-1}
                            initial={{ opacity: 0, y: 48 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 48 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="fixed z-50 inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-3xl bg-[#0b0b18] ring-1 ring-white/10 flex flex-col outline-none"
                            role="dialog"
                            aria-modal="true"
                            aria-label={active.title}
                        >
                            {/* Panel толгой */}
                            <div className="flex items-start gap-4 p-5 sm:p-6 border-b border-white/[0.06]">
                                <span
                                    className={`shrink-0 w-12 h-12 rounded-full bg-gradient-to-b ${active.color.bubble} ring-1 ${active.color.ring} flex items-center justify-center`}
                                >
                                    <active.icon className={`w-5 h-5 ${active.color.text}`} />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${active.color.text}`}>
                                        Сэдэв {activeIndex + 1}/{topics.length}
                                    </div>
                                    <h2 className="text-lg font-bold leading-snug mt-0.5">
                                        {active.title}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setActiveId(null)}
                                    className="shrink-0 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                    aria-label="Хаах"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Алхамууд */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                                <p className="text-sm text-white/55 mb-6">{active.short}</p>
                                <div className="relative">
                                    <span className="absolute left-[13px] top-2 bottom-2 w-px bg-white/[0.08]" aria-hidden />
                                    <ol className="space-y-5">
                                        {active.steps.map((step, i) => (
                                            <li key={i} className="relative flex gap-4">
                                                <span
                                                    className={`relative z-10 shrink-0 w-7 h-7 rounded-full bg-[#0b0b18] ring-1 ${active.color.ring} ${active.color.text} text-xs font-bold flex items-center justify-center`}
                                                >
                                                    {i + 1}
                                                </span>
                                                <div className="pt-0.5">
                                                    <div className="text-sm font-semibold">{step.title}</div>
                                                    <div className="text-[13px] text-white/50 mt-1 leading-relaxed">
                                                        {step.desc}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                                {active.tip && (
                                    <div className="mt-6 flex gap-3 p-4 rounded-2xl bg-amber-400/[0.06] ring-1 ring-amber-400/15">
                                        <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                                        <p className="text-[13px] text-amber-100/80 leading-relaxed">
                                            {active.tip}
                                        </p>
                                    </div>
                                )}

                                {active.href && active.hrefLabel && (
                                    <Link
                                        href={active.href}
                                        className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${active.color.text} hover:underline underline-offset-4`}
                                    >
                                        {active.hrefLabel}
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                )}
                            </div>

                            {/* Хөтөчийн навигаци */}
                            <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5 pb-safe border-t border-white/[0.06]">
                                <button
                                    onClick={() => {
                                        if (activeIndex > 0) openTopic(topics[activeIndex - 1].id);
                                    }}
                                    disabled={activeIndex <= 0}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Өмнөх
                                </button>
                                <div className="flex items-center gap-1.5" aria-hidden>
                                    {topics.map((t, i) => (
                                        <span
                                            key={t.id}
                                            className={`rounded-full transition-all ${
                                                i === activeIndex
                                                    ? "w-4 h-1.5 bg-white/80"
                                                    : visited.has(t.id)
                                                      ? "w-1.5 h-1.5 bg-emerald-400/70"
                                                      : "w-1.5 h-1.5 bg-white/20"
                                            }`}
                                        />
                                    ))}
                                </div>
                                {activeIndex < topics.length - 1 ? (
                                    <button
                                        onClick={() => openTopic(topics[activeIndex + 1].id)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                                    >
                                        Дараах
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setActiveId(null)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                    >
                                        Дууслаа
                                        <Check className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
        </MotionConfig>
    );
}
