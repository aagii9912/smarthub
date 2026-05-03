"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type {
    LandingContent,
    PlanCard,
    PlanAccent,
    BannerVariant,
    FeatureRow,
    FeaturePillVariant,
} from "@/lib/landing/types";

interface PricingSectionProps {
    content: LandingContent;
}

type Mode = "monthly" | "annual";

const PLAN_KEYS = ["lite", "starter", "pro", "business"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];

// CSS variables per plan accent (matches design's --plan-accent / --plan-accent-fg / --plan-glow)
const ACCENT_VARS: Record<PlanAccent, CSSProperties> = {
    warm: {
        ["--plan-accent" as string]: "#f5f1e8",
        ["--plan-accent-fg" as string]: "#0c0c14",
        ["--plan-glow" as string]: "rgba(245,241,232,0.18)",
    },
    lime: {
        ["--plan-accent" as string]: "var(--p-lime)",
        ["--plan-accent-fg" as string]: "#0c0c14",
        ["--plan-glow" as string]: "rgba(200,255,61,0.25)",
    },
    pink: {
        ["--plan-accent" as string]: "var(--p-pink)",
        ["--plan-accent-fg" as string]: "#fff",
        ["--plan-glow" as string]: "rgba(236,72,153,0.30)",
    },
    indigo: {
        ["--plan-accent" as string]: "var(--p-indigo)",
        ["--plan-accent-fg" as string]: "#fff",
        ["--plan-glow" as string]: "rgba(74,124,231,0.30)",
    },
};

function bannerClass(variant: BannerVariant): string {
    if (variant === "muted") return "bg-white/[0.05] text-white/60";
    if (variant === "indigo") return "bg-[var(--p-indigo)] text-white";
    return "bg-[var(--plan-accent)] text-[var(--plan-accent-fg)]";
}

function pillClass(variant: FeaturePillVariant): string {
    return variant === "lime"
        ? "bg-[var(--p-lime)] text-[#0c0c14]"
        : "bg-[rgba(232,213,183,0.12)] text-[var(--p-warm)]";
}

function FeatureItem({ row }: { row: FeatureRow }) {
    if (row.kind === "section") {
        return (
            <li className="basis-full mt-3 pt-3 border-t border-white/[0.06] text-[10.5px] font-bold tracking-[0.12em] text-white/60 uppercase">
                {row.text}
            </li>
        );
    }
    const isOk = row.kind === "ok";
    return (
        <li
            className={`flex items-start gap-2.5 text-[12.5px] leading-[1.45] flex-wrap ${
                isOk ? "text-white" : "text-white/40"
            }`}
        >
            <span
                className={`mt-[2px] w-[14px] shrink-0 text-[11px] font-bold ${
                    isOk ? "text-[var(--plan-accent)]" : "text-white/40"
                }`}
            >
                {isOk ? "✓" : "×"}
            </span>
            <span className="flex-1">{row.text}</span>
            {isOk && row.pill && (
                <span
                    className={`ml-auto whitespace-nowrap rounded-[4px] px-1.5 py-[2px] font-mono text-[9.5px] font-bold tracking-[0.06em] ${pillClass(
                        row.pill.variant
                    )}`}
                >
                    {row.pill.text}
                </span>
            )}
        </li>
    );
}

function PlanCardView({
    plan,
    mode,
    discountBadge,
}: {
    plan: PlanCard;
    mode: Mode;
    discountBadge: string;
}) {
    const accentStyle = ACCENT_VARS[plan.accent];
    const priceFace = mode === "annual" ? plan.price.annual : plan.price.monthly;
    const showStrike = mode === "annual" && !!priceFace.strike;
    const showDiscount = !!plan.showDiscountBadge && mode === "annual" && !!discountBadge;
    const saveText = mode === "annual" ? plan.save?.annual : plan.save?.monthly;
    const isCustom = !plan.accent || plan.accent === "warm";

    return (
        <article
            className={`reveal-on-scroll relative flex flex-col overflow-hidden rounded-[18px] border bg-[#14141d] transition-[transform,border-color] duration-300 hover:-translate-y-[3px] ${
                plan.featured
                    ? "border-[color-mix(in_oklab,var(--plan-accent)_40%,transparent)] shadow-[0_30px_70px_-22px_var(--plan-glow)]"
                    : "border-white/[0.06] hover:border-white/[0.10]"
            }`}
            style={accentStyle}
        >
            {plan.banner && (
                <div
                    className={`px-3 py-[9px] text-center text-[11px] font-bold tracking-[0.12em] ${bannerClass(
                        plan.banner.variant
                    )}`}
                >
                    <span className="inline-flex items-center gap-1.5">{plan.banner.text}</span>
                </div>
            )}

            <div className="border-b border-white/[0.06] px-[22px] pt-6 pb-[22px]">
                {/* Tag + optional discount badge */}
                <div className="mb-1">
                    <span className="font-display inline-flex items-center gap-2 text-[24px] font-bold tracking-[-0.01em] text-white">
                        {plan.tag}
                        {showDiscount && (
                            <span className="rounded-[5px] bg-[var(--plan-accent)] px-[7px] py-[3px] font-mono text-[10px] font-bold tracking-[0.05em] text-[var(--plan-accent-fg)]">
                                {discountBadge}
                            </span>
                        )}
                    </span>
                </div>

                {/* Description */}
                <p className="mt-0 mb-[18px] text-[12.5px] leading-[1.45] text-white/60">{plan.desc}</p>

                {/* Credit block */}
                <div className="mb-[22px] rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-[12px] text-white/60">
                    <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-white">
                        <span className="text-[13px]">{plan.credit.icon}</span>
                        {plan.credit.headline}
                    </div>
                    {plan.credit.lines.map((line, i) => (
                        <div
                            key={i}
                            className="relative pl-3 leading-[1.7] text-white/60 before:absolute before:left-0 before:top-0 before:font-mono before:text-[11px] before:text-white/40 before:content-['=']"
                        >
                            {line}
                        </div>
                    ))}
                    {plan.credit.fixed && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[11.5px] text-white/60">
                            <span className="text-[var(--plan-accent)]">{plan.credit.fixed.icon}</span>
                            {plan.credit.fixed.text}
                        </div>
                    )}
                </div>

                {/* Price */}
                <div className="font-display mb-4 flex flex-wrap items-baseline gap-2.5">
                    {showStrike && (
                        <span className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--plan-accent)] line-through decoration-2 opacity-70 [font-feature-settings:'tnum']">
                            {priceFace.strike}
                        </span>
                    )}
                    <span className="text-[36px] leading-none font-bold tracking-[-0.04em] text-white [font-feature-settings:'tnum']">
                        {priceFace.value}
                    </span>
                    {priceFace.per && (
                        <span className="basis-full -mt-0.5 font-sans text-[12px] font-medium text-white/60">
                            {priceFace.per}
                        </span>
                    )}
                </div>

                {/* CTA */}
                {isCustom ? (
                    <Link
                        href={plan.cta.href}
                        className="flex w-full items-center justify-center rounded-[10px] border border-white/[0.10] bg-white/[0.06] px-4 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/[0.10]"
                    >
                        {plan.cta.text}
                    </Link>
                ) : (
                    <Link
                        href={plan.cta.href}
                        className="flex w-full items-center justify-center rounded-[10px] bg-[var(--plan-accent)] px-4 py-3.5 text-[14px] font-bold text-[var(--plan-accent-fg)] transition-all hover:-translate-y-px hover:brightness-105 hover:shadow-[0_12px_28px_-8px_var(--plan-glow)]"
                    >
                        {plan.cta.text}
                    </Link>
                )}

                {/* Save text */}
                <p className="mt-3 min-h-[16px] text-center font-sans text-[11.5px] text-white/60">
                    {saveText ?? ""}
                </p>
            </div>

            {/* Feature list */}
            <ul className="m-0 flex flex-col gap-2.5 px-[22px] pt-[22px] pb-6 list-none">
                {plan.features.map((row, i) => (
                    <FeatureItem key={i} row={row} />
                ))}
            </ul>
        </article>
    );
}

export function PricingSection({ content: c }: PricingSectionProps) {
    const p = c.pricing;
    const [mode, setMode] = useState<Mode>(p.toggle?.defaultMode ?? "annual");

    const plans: PlanCard[] = PLAN_KEYS.map((k) => p[k as PlanKey]);

    return (
        <section id="pricing" className="relative overflow-hidden px-6 pt-20 pb-[120px]">
            {/* Section-scoped atmospheric blobs (mirrors design .atm) */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
                <div className="absolute -top-[240px] -left-[120px] h-[720px] w-[720px] rounded-full bg-[var(--p-indigo)] opacity-30 mix-blend-screen blur-[140px] motion-safe:animate-[pricingDrift1_32s_ease-in-out_infinite_alternate]" />
                <div className="absolute top-[80px] -right-[180px] h-[600px] w-[600px] rounded-full bg-[var(--p-violet)] opacity-[0.24] mix-blend-screen blur-[140px] motion-safe:animate-[pricingDrift2_36s_ease-in-out_infinite_alternate]" />
                <div className="absolute top-[760px] left-[32%] h-[520px] w-[520px] rounded-full bg-[var(--p-pink)] opacity-[0.14] mix-blend-screen blur-[140px] motion-safe:animate-[pricingDrift3_40s_ease-in-out_infinite_alternate]" />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px)",
                        backgroundSize: "80px 80px",
                        WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 0%, black 30%, transparent 80%)",
                        maskImage: "radial-gradient(ellipse 70% 80% at 50% 0%, black 30%, transparent 80%)",
                    }}
                />
            </div>

            <style jsx global>{`
                @keyframes pricingDrift1 {
                    from { transform: translate(0, 0) scale(1); }
                    to   { transform: translate(140px, 80px) scale(1.1); }
                }
                @keyframes pricingDrift2 {
                    from { transform: translate(0, 0) scale(1); }
                    to   { transform: translate(-100px, 60px) scale(0.95); }
                }
                @keyframes pricingDrift3 {
                    from { transform: translate(0, 0) scale(1); }
                    to   { transform: translate(80px, -100px) scale(1.15); }
                }
            `}</style>

            <div className="relative z-10 mx-auto max-w-[1280px]">
                {/* Header */}
                <header className="mb-14 text-center reveal-on-scroll">
                    <div className="mb-7 inline-flex items-baseline gap-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-white/60 before:h-px before:w-7 before:self-center before:bg-white/60 before:content-['']">
                        <span className="font-semibold text-[var(--p-warm)]">{p.eyebrowNum}</span>
                        {p.sectionLabel}
                    </div>
                    <h1 className="font-display m-0 mb-5 text-balance text-[clamp(48px,6.5vw,88px)] font-medium leading-[0.94] tracking-[-0.05em]">
                        {p.headlineLines.line1}
                        <br />
                        <em className="font-light italic text-[var(--p-warm)]">{p.headlineLines.emphasis}</em>{" "}
                        <span className="bg-[linear-gradient(120deg,var(--p-indigo),var(--p-violet)_50%,var(--p-cyan))] bg-clip-text text-transparent">
                            {p.headlineLines.gradient}
                        </span>
                    </h1>
                    <p className="mx-auto mb-9 max-w-[540px] text-[16px] leading-[1.55] text-white/60">{p.lede}</p>

                    {/* Toggle */}
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/[0.10] bg-white/[0.025] py-1.5 pr-3 pl-4 text-[13.5px] font-medium backdrop-blur-md">
                        <button
                            type="button"
                            onClick={() => setMode("monthly")}
                            className={`cursor-pointer py-1.5 transition-colors duration-200 ${
                                mode === "monthly" ? "text-white" : "text-white/60 hover:text-white"
                            }`}
                        >
                            Сар бүр
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode(mode === "annual" ? "monthly" : "annual")}
                            aria-label="Toggle billing period"
                            className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-300 ${
                                mode === "annual"
                                    ? "bg-[linear-gradient(135deg,var(--p-indigo),var(--p-violet))]"
                                    : "bg-white/10"
                            }`}
                        >
                            <span
                                className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                                style={{ transform: mode === "annual" ? "translateX(20px)" : "translateX(0)" }}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("annual")}
                            className={`cursor-pointer py-1.5 transition-colors duration-200 ${
                                mode === "annual" ? "text-white" : "text-white/60 hover:text-white"
                            }`}
                        >
                            Жилээр
                        </button>
                        {p.toggle.savePill && (
                            <span
                                className="whitespace-nowrap rounded-md bg-[var(--p-pink)] px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-white transition-opacity duration-200"
                                style={{ opacity: mode === "annual" ? 1 : 0.3 }}
                            >
                                {p.toggle.savePill}
                            </span>
                        )}
                    </div>
                </header>

                {/* Plans */}
                <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 min-[1100px]:grid-cols-4">
                    {plans.map((plan, i) => (
                        <PlanCardView
                            key={`${plan.tag}-${i}`}
                            plan={plan}
                            mode={mode}
                            discountBadge={p.toggle.discountBadge ?? ""}
                        />
                    ))}
                </div>

                {/* Trust line */}
                {p.trustLine.length > 0 && (
                    <div className="mt-10 flex flex-wrap items-center justify-center font-mono text-[11.5px] tracking-[0.04em] text-white/60">
                        {p.trustLine.map((label, i) => (
                            <span
                                key={i}
                                className={`relative inline-flex items-center gap-2 px-[18px] before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[var(--p-warm)] before:opacity-70 before:content-[''] ${
                                    i > 0
                                        ? "after:absolute after:left-0 after:top-1/2 after:h-3 after:w-px after:-translate-y-1/2 after:bg-white/10 after:content-['']"
                                        : ""
                                }`}
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
